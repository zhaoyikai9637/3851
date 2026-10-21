import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import mysql from 'mysql2/promise';
import request from 'supertest';
import {loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {resetTestLoginBuckets} from './helpers/isolated-auth.mjs';
process.env.DB_NAME='jrs_integrated_test_20261019';process.env.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL='true';
test('a template selected after review reaches a draft, one SMTP handoff and the same immutable Notifications log',async()=>{
 const settings=loadSettings();assertLocalDatabase(settings);const pool=mysql.createPool(settings.db);
 let record;try{[[record]]=await pool.query("SELECT a.id,c.email FROM recruiting_application a JOIN recruiting_candidate c ON c.id=a.candidate_id WHERE a.stage<>'Rejected' AND c.email LIKE '%@example.test' LIMIT 1");}finally{await pool.end();}
 assert.ok(record,'Run the isolated applicant workflow first');
 Object.assign(process.env,{SMTP_ENABLED:'true',SMTP_HOST:'smtp.example.test',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'fixture@example.test',SMTP_PASSWORD:'fixture-only',SMTP_FROM:'fixture@example.test',SMTP_MODE:'sandbox',SMTP_RECIPIENT_ALLOWLIST:record.email});
 const {createRuntime}=await import('../server/runtime.mjs');
 const handedOff=[];
 const site=await createRuntime({mailTransport:{sendMail:async mail=>{handedOff.push(mail);return {accepted:[mail.to],messageId:'fixture-'+randomUUID()};}}});
 try{
  await resetTestLoginBuckets(site);const accounts=JSON.parse(await fs.readFile(new URL('../.local/accounts-test.json',import.meta.url)));
  const hr=request.agent(site.app),login=await hr.post('/api/login').send({email:accounts[0].email,password:accounts[0].password}).expect(200),csrf=login.body.csrfToken;
  const communicationCsrf=(await hr.get('/api/auth/me').expect(200)).body.csrfToken;
  const tpl=await hr.post('/api/hr/templates').set('X-CSRF-Token',communicationCsrf).send({templateName:'Loop '+randomUUID(),usageType:'IN_PROGRESS',subject:'Application update: [JobTitle]',body:'Dear [CandidateName], your application is under review. Regards, [HRName] at [CompanyName].'}).expect(201);
  const ws=await hr.get('/recruitment/api/hr/workspace').expect(200),templateId='canonical-template-'+tpl.body.templateId;
  assert.ok(ws.body.templates.some(template=>template.id===templateId));
  const preview=await hr.post('/recruitment/api/hr/templates/'+templateId+'/preview').set('X-CSRF-Token',csrf).send({applicationId:record.id}).expect(200);
  assert.ok(!preview.body.body.includes('[CandidateName]'));assert.equal(handedOff.length,0);
  const draftResponse=await hr.post('/recruitment/api/hr/commands/message').set('X-CSRF-Token',csrf).set('If-Match',String(ws.body.revision)).set('Idempotency-Key',randomUUID()).send({applicationId:record.id,templateId}).expect(200);
  const draft=draftResponse.body.db.notifications.find(item=>item.applicationId===record.id&&item.templateId===templateId&&item.status==='Draft');assert.ok(draft);assert.equal(handedOff.length,0);
  const send=()=>hr.post('/recruitment/api/hr/notifications/'+draft.id+'/send').set('X-CSRF-Token',csrf).set('If-Match',String(draftResponse.body.db.revision)).send({attachResume:false});
  await send().expect(200);await send().expect(200);assert.equal(handedOff.length,1);
  const logs=await hr.get('/api/hr/logs?page=1&pageSize=50').expect(200),log=logs.body.items.find(item=>item.templateName===tpl.body.templateName);assert.ok(log,'Accepted business email must appear in Notifications Logs');
  const detail=await hr.get('/api/hr/logs/'+log.logId).expect(200);assert.equal(detail.body.emailBody,preview.body.body);
  await hr.delete('/api/hr/templates/'+tpl.body.templateId).set('X-CSRF-Token',communicationCsrf).expect(204);
  assert.equal((await hr.get('/api/hr/logs/'+log.logId).expect(200)).body.emailBody,preview.body.body);
 }finally{await site.close();}
});
