// Opt-in real MySQL only: this suite never substitutes SQLite or a mock database.
// The dedicated test DB keeps its rows for diagnosis; no DROP/TRUNCATE/sync is used.
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import request from 'supertest';
import { createDatabase } from '../src/db.js';
import { assertDatabaseWriteAllowed, inspectMigrationTarget, moduleTables, tableNames } from '../src/database-safety.js';
import { migrator } from '../src/migrate.js';
import { defineModels } from '../src/models.js';
import { seedDemo } from '../src/seed.js';
import { createServices } from '../src/services.js';
import { DatabaseSessionStore } from '../src/session-store.js';
import { teamIdentityFixture } from './helpers/team-identity.js';
import { createApp } from '../src/app.js';
import { contractValidator } from './helpers/api-contract.js';

describe('dedicated real MySQL integration', () => {
  let db,models,env,services,hr1,hr2;
  beforeAll(async () => {
    let raw;
    try { raw=await fs.readFile(new URL('../.env.test',import.meta.url),'utf8'); }
    catch { throw new Error('Real MySQL tests not run: configure server/.env.test only after confirming a NEW dedicated test database.'); }
    env=dotenv.parse(raw); // Never inherit the development DB credentials/target.
    assertDatabaseWriteAllowed(env,'test');
    db=createDatabase(env);await db.authenticate();await inspectMigrationTarget(db);
    await migrator(db).up();models=defineModels(db);
    await seedDemo(db,models,{password:env.SEED_PASSWORD});services=createServices(models);
    hr1=await models.HrUser.findOne({where:{employeeId:'DEMO-HR-001'}});
    hr2=await models.HrUser.findOne({where:{employeeId:'DEMO-HR-002'}});
  });
  afterAll(async()=>{if(db) await db.close();});
  it('creates the full schema and makes rerunning the migration a no-op', async () => {
    expect(tableNames(await db.getQueryInterface().showAllTables())).toEqual(expect.arrayContaining(moduleTables));
    expect(await migrator(db).up()).toEqual([]);
    expect((await migrator(db).executed()).map(row=>row.name)).toEqual(['001-module']);
    for(const model of Object.values(models)) {
      const columns=await db.getQueryInterface().describeTable(model.getTableName());
      for(const attr of Object.values(model.rawAttributes)) expect(columns).toHaveProperty(attr.field);
    }
    const indexes=await db.getQueryInterface().showIndex('NOTIFICATION_LOG');
    expect(indexes.some(index=>index.fields.map(field=>field.attribute).join(',')==='sender_user_id,delivery_status,sent_at')).toBe(true);
  });
  it('enforces real foreign keys and unique template names', async () => {
    await expect(models.Notification.create({recipientUserId:2147483647,title:'Test',message:'Test',notificationType:'NEW_APPLICATION'})).rejects.toMatchObject({name:'SequelizeForeignKeyConstraintError'});
    await expect(models.Template.create({templateName:'Interview Invite',subject:'Test',body:'Test',usageType:'INTERVIEW_INVITE',createdBy:hr1.userId})).rejects.toMatchObject({name:'SequelizeUniqueConstraintError'});
  });
  it('matches model types, nullability, primary keys and FK update/delete actions', async () => {
    const [foreignKeys] = await db.query(`SELECT k.TABLE_NAME AS tableName, k.COLUMN_NAME AS columnName,
      k.REFERENCED_TABLE_NAME AS targetTable, k.REFERENCED_COLUMN_NAME AS targetColumn,
      r.DELETE_RULE AS deleteRule, r.UPDATE_RULE AS updateRule
      FROM information_schema.KEY_COLUMN_USAGE k
      JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
      WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL`);
    const normalize = type => type.toUpperCase().replace(/^INTEGER$/, 'INT').replace(/^BOOLEAN$/, 'TINYINT(1)');
    for (const model of Object.values(models)) {
      const columns = await db.getQueryInterface().describeTable(model.getTableName());
      for (const attr of Object.values(model.rawAttributes)) {
        const column = columns[attr.field];
        expect(normalize(column.type), `${model.name}.${attr.field} type`).toBe(normalize(attr.type.toSql()));
        expect(column.allowNull, `${model.name}.${attr.field} nullable`).toBe(attr.primaryKey ? false : attr.allowNull !== false);
        expect(column.primaryKey).toBe(Boolean(attr.primaryKey));
        if (attr.references) {
          const key = foreignKeys.find(k => k.tableName.toUpperCase() === model.getTableName() && k.columnName === attr.field);
          expect(key, `${model.name}.${attr.field} FK`).toBeDefined();
          expect(key.targetTable.toUpperCase()).toBe(attr.references.model);
          expect(key.targetColumn).toBe(attr.references.key);
          expect(key.deleteRule).toBe(attr.onDelete);
          expect(key.updateRule).toBe(attr.onUpdate);
        }
      }
    }
  });
  it('keeps seed reruns stable and excludes all non-success histories', async () => {
    const before=await models.Log.count();await seedDemo(db,models,{password:env.SEED_PASSWORD});expect(await models.Log.count()).toBe(before);
    const result=await services.logs(hr1.userId,{page:1,pageSize:50});expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every(row=>row.senderUserId===hr1.userId && row.deliveryStatus==='SENT' && row.sentAt && row.isDemo)).toBe(true);
    const other=await models.Log.findOne({where:{senderUserId:hr2.userId,deliveryStatus:'SENT'}});
    await expect(services.log(hr1.userId,other.logId)).rejects.toMatchObject({status:404});
    const preview=await models.Log.findOne({where:{senderUserId:hr1.userId,deliveryStatus:'PREVIEW'}});
    await expect(services.log(hr1.userId,preview.logId)).rejects.toMatchObject({status:404});
  });
  it('persists notification reads across a fresh database connection and enforces ownership', async () => {
    const notice=await models.Notification.create({recipientUserId:hr1.userId,title:'Persistence integration check',message:'Test fixture only',notificationType:'NEW_APPLICATION',eventKey:`test:read:${crypto.randomUUID()}`,isRead:false});
    await expect(services.markRead(hr2.userId,notice.notificationId)).rejects.toMatchObject({status:404});
    await services.markRead(hr1.userId,notice.notificationId);
    const second=createDatabase(env);
    try {expect((await defineModels(second).Notification.findByPk(notice.notificationId)).isRead).toBe(true);}
    finally {await second.close();}
  });
  it('retains original sent snapshots after template update and soft deletion', async () => {
    const template=await services.createTemplate(hr1.userId,{templateName:`Integration ${crypto.randomUUID()}`,subject:'Original subject',body:'Original body',usageType:'IN_PROGRESS'});
    const application=await models.Application.findOne({where:{assignedHrUserId:hr1.userId}});
    const history=await models.Log.create({applicationId:application.applicationId,templateId:template.templateId,senderUserId:hr1.userId,triggerEvent:'Test fixture',sourceModule:'Integration test',recipientEmail:'candidate1@example.test',candidateName:'Fictional snapshot test',positionTitle:'Test position',templateName:template.templateName,emailSubject:'Original subject',emailBody:'Original body',deliveryStatus:'SENT',sentAt:new Date(),isDemo:true});
    await services.updateTemplate(hr1.userId,template.templateId,{templateName:template.templateName,subject:'New subject',body:'New body',usageType:'IN_PROGRESS'});
    await services.deleteTemplate(hr1.userId,template.templateId);
    const saved=await services.log(hr1.userId,history.logId);
    expect(saved.emailSubject).toBe('Original subject');expect(saved.emailBody).toBe('Original body');
    expect((await services.templates()).some(t=>t.templateId===template.templateId)).toBe(false);
    const mailer={send:()=>{throw new Error('Should never send');}};
    await expect(services.sendWorkflowEmail({userId:hr1.userId,applicationId:application.applicationId,templateId:template.templateId,eventKey:crypto.randomUUID(),triggerEvent:'Test fixture'},mailer)).rejects.toMatchObject({status:404});
  });
  it('uses sentAt UTC+08 day boundaries and excludes PREVIEW even with matching search', async () => {
    const sample=await models.Log.findOne({where:{senderUserId:hr1.userId,deliveryStatus:'SENT'}});
    const marker=`Boundary ${crypto.randomUUID()}`;
    for(const [index,sentAt] of ['2026-09-08T15:59:59Z','2026-09-08T16:00:00Z','2026-09-09T15:59:59Z','2026-09-09T16:00:00Z'].entries()) {
      const row=sample.get({plain:true});delete row.logId;delete row.createdAt;
      await models.Log.create({...row,eventKey:`test:date:${crypto.randomUUID()}`,candidateName:marker,sentAt,triggerEvent:`Boundary ${index}`,isDemo:true});
    }
    const result=await services.logs(hr1.userId,{page:1,pageSize:50,search:marker,from:'2026-09-09',to:'2026-09-09'});
    expect(result.items.map(row=>row.triggerEvent).sort()).toEqual(['Boundary 1','Boundary 2']);
    expect((await services.logs(hr2.userId,{page:1,pageSize:50,search:marker})).items).toEqual([]);
  });
  it('uses an upstream identity fixture with MySQL module sessions and CSRF/logout through HTTP', async () => {
    const team=teamIdentityFixture();
    const app=createApp({identity:team.adapter,services,sessionStore:new DatabaseSessionStore(models.Session),config:{production:false,secret:crypto.randomBytes(48).toString('hex'),origin:'http://localhost:5173',mode:'standalone',uploadDir:fileURLToPath(new URL('../uploads',import.meta.url))}});
    const agent=request.agent(app);
    const initial=await agent.get('/api/auth/csrf').expect(200);
    const issued=team.issue(hr1.userId); agent.set('Cookie',issued.name+'='+issued.value);
    const current=await agent.get('/api/auth/me').expect(200);
    expect(current.body.csrfToken).not.toBe(initial.body.csrfToken);
    await agent.get('/api/hr/notifications').expect(200);
    await agent.post('/api/auth/logout').set('x-csrf-token',current.body.csrfToken).expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
  it('serializes concurrent avatar changes so each superseded reference is recoverable', async () => {
    const suffix=crypto.randomUUID().slice(0,8);
    const hr=await models.HrUser.create({employeeId:`QA-PHOTO-${suffix}`,fullName:'Avatar concurrency fixture',email:`photo-${suffix}@example.test`,role:'HR Manager',department:'Test',accountStatus:'ACTIVE'});
    const svc=createServices(models), first=`${crypto.randomUUID()}.jpg`, second=`${crypto.randomUUID()}.jpg`;
    const results=await Promise.all([svc.updatePhoto(hr.userId,first),svc.updatePhoto(hr.userId,second)]);
    const final=(await hr.reload()).profilePhotoUrl;
    const previous=results.map(r=>r.previousPhoto).filter(Boolean);
    expect(previous).toHaveLength(1);
    expect(new Set([...previous,final])).toEqual(new Set([first,second]));
    expect(await svc.photoInUse(previous[0])).toBe(false);expect(await svc.photoInUse(final)).toBe(true);
  });
  it('deduplicates simultaneous upstream notification events using the real unique index', async () => {
    const application=await models.Application.findOne({where:{assignedHrUserId:hr1.userId}});
    const payload={eventKey:'test:concurrent:notice:'+crypto.randomUUID(),applicationId:application.applicationId,type:'NEW_APPLICATION'};
    const results=await Promise.all(Array.from({length:4},()=>services.recordApplicationEvent(payload)));
    expect(new Set(results.map(row=>row.notificationId)).size).toBe(1);
    expect(await models.Notification.count({where:{eventKey:payload.eventKey}})).toBe(1);
    expect(results[0].recipientUserId).toBe(hr1.userId);
    await expect(services.recordApplicationEvent({...payload,type:'STATUS_UPDATED'})).rejects.toMatchObject({status:409});
  });
  it('makes one mail attempt for concurrent duplicates and keeps a preview out of successful history', async () => {
    const application=await models.Application.findOne({where:{assignedHrUserId:hr1.userId}});
    const template=await models.Template.findOne({where:{templateName:'Interview Invite',isActive:true}});
    const payload={userId:hr1.userId,applicationId:application.applicationId,templateId:template.templateId,eventKey:'test:concurrent:mail:'+crypto.randomUUID(),triggerEvent:'Concurrency preview test'};
    const mailer={send:vi.fn().mockResolvedValue({preview:true})}; // No SMTP or network.
    const results=await Promise.all(Array.from({length:4},()=>services.sendWorkflowEmail(payload,mailer)));
    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(new Set(results.map(row=>row.logId)).size).toBe(1);
    const saved=await models.Log.findOne({where:{eventKey:payload.eventKey}});
    expect(saved.deliveryStatus).toBe('PREVIEW');expect(saved.sentAt).toBeNull();
    await expect(services.log(hr1.userId,saved.logId)).rejects.toMatchObject({status:404});
    await expect(services.sendWorkflowEmail({...payload,triggerEvent:'Different event'},mailer)).rejects.toMatchObject({status:409});
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });
  it('validates real HTTP JSON responses against the published OpenAPI schemas', async () => {
    const contract=await contractValidator(),team=teamIdentityFixture();
    const app=createApp({identity:team.adapter,services,sessionStore:new DatabaseSessionStore(models.Session),config:{production:false,secret:crypto.randomBytes(48).toString('hex'),origin:'http://localhost:5173',mode:'standalone',uploadDir:fileURLToPath(new URL('../uploads-test',import.meta.url))}});
    const agent=request.agent(app);
    const verify=async (route,method,req) => {const response=await req;contract.response(route,method,response);return response;};
    await verify('/api/hr/profile','get',agent.get('/api/hr/profile').expect(401));
    for(const route of ['/api/health','/api/auth/config','/api/auth/csrf']) await verify(route,'get',agent.get(route).expect(200));
    const cookie=team.issue(hr1.userId);agent.set('Cookie',cookie.name+'='+cookie.value);
    const me=await verify('/api/auth/me','get',agent.get('/api/auth/me').expect(200));
    const token=me.body.csrfToken;
    for(const route of ['/api/hr/profile','/api/hr/notifications','/api/hr/templates','/api/hr/logs']) await verify(route,'get',agent.get(route).expect(200));
    const sample=await models.Log.findOne({where:{senderUserId:hr1.userId,deliveryStatus:'SENT'}});
    await verify('/api/hr/logs/{id}','get',agent.get('/api/hr/logs/'+sample.logId).expect(200));
    await verify('/api/hr/applications/{id}','get',agent.get('/api/hr/applications/'+sample.applicationId).expect(200));
    await verify('/api/hr/logs/{id}','get',agent.get('/api/hr/logs/2147483647').expect(404));
    await verify('/api/hr/profile','patch',agent.patch('/api/hr/profile').send({}).expect(403));
    await verify('/api/hr/profile','patch',agent.patch('/api/hr/profile').set('x-csrf-token',token).send({role:'Admin'}).expect(422));
    const fields={templateName:'Contract '+crypto.randomUUID(),subject:'Hello [CandidateName]',body:'Regards, [HRName]',usageType:'IN_PROGRESS'};
    const created=await verify('/api/hr/templates','post',agent.post('/api/hr/templates').set('x-csrf-token',token).send(fields).expect(201));
    await verify('/api/hr/templates','post',agent.post('/api/hr/templates').set('x-csrf-token',token).send(fields).expect(409));
    const target='/api/hr/templates/'+created.body.templateId;
    await verify('/api/hr/templates/{id}','put',agent.put(target).set('x-csrf-token',token).send({...fields,subject:'Updated subject'}).expect(200));
    await verify('/api/hr/templates/{id}','delete',agent.delete(target).set('x-csrf-token',token).expect(204));
    const notice=await models.Notification.create({recipientUserId:hr1.userId,title:'Contract fixture',message:'Fictional local test',notificationType:'NEW_APPLICATION'});
    await verify('/api/hr/notifications/{id}/read','patch',agent.patch('/api/hr/notifications/'+notice.notificationId+'/read').set('x-csrf-token',token).expect(204));
    await verify('/api/hr/notifications/read-all','patch',agent.patch('/api/hr/notifications/read-all').set('x-csrf-token',token).expect(200));
    await verify('/api/auth/logout','post',agent.post('/api/auth/logout').set('x-csrf-token',token).expect(204));
    await verify('/api/auth/me','get',agent.get('/api/auth/me').expect(401));
  });
});
