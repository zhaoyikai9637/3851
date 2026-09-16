import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import session from 'express-session';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { teamIdentityFixture } from './helpers/team-identity.js';
import { HttpError } from '../src/validation.js';

describe('Express API with mock services and an isolated MemoryStore', () => {
  let app, services, store, uploadDir, agent, csrf, team, teamCookie;
  const profile={userId:1,employeeId:'DEMO-1',fullName:'Riley',email:'hr@example.test',role:'HR Manager',department:'HR',accountStatus:'ACTIVE',phone:'',officeLocation:''};
  beforeEach(async () => {
    uploadDir=await fs.mkdtemp(path.join(os.tmpdir(),'jrs-api-test-'));
    services={authorize:vi.fn().mockResolvedValue(profile),profile:vi.fn().mockResolvedValue(profile),updateProfile:vi.fn().mockResolvedValue(profile),updatePhoto:vi.fn().mockResolvedValue({profile,previousPhoto:null}),photoInUse:vi.fn().mockResolvedValue(false),photo:vi.fn().mockResolvedValue(''),notifications:vi.fn().mockResolvedValue({items:[],total:0,page:1,pageSize:10,unread:0,all:0}),markRead:vi.fn(),markAllRead:vi.fn().mockResolvedValue({updated:0,notificationIds:[]}),restoreUnread:vi.fn().mockResolvedValue({updated:0}),templates:vi.fn().mockResolvedValue([]),createTemplate:vi.fn(),updateTemplate:vi.fn(),deleteTemplate:vi.fn(),logs:vi.fn().mockResolvedValue({items:[],total:0,page:1,pageSize:10}),log:vi.fn(),attachment:vi.fn(),application:vi.fn()};
    store=new session.MemoryStore();
    team=teamIdentityFixture();
    app=createApp({identity:team.adapter,services,sessionStore:store,config:{secret:'test-only-session-secret-never-used-outside-tests',origin:'http://localhost:5173',production:false,mode:'standalone',uploadDir}});
    agent=request.agent(app);
  });
  afterEach(async () => {
    store.clear();
    // Only remove this test's own mkdtemp output, never a configured uploads directory.
    if (path.dirname(path.resolve(uploadDir)) !== path.resolve(os.tmpdir()) || !path.basename(uploadDir).startsWith('jrs-api-test-')) throw new Error('Unsafe test cleanup path');
    await fs.rm(uploadDir,{recursive:true,force:true});
  });
  const enter = async () => {
    const initial=await agent.get('/api/auth/csrf').expect(200);
    const issued=team.issue(1); teamCookie=issued.name+'='+issued.value;
    agent.set('Cookie',teamCookie);
    const res=await agent.get('/api/auth/me').expect(200);
    csrf=res.body.csrfToken; return {initial,res};
  };
  it('loads health, OpenAPI and Swagger without a database', async () => {
    const health=await agent.get('/api/health').expect(200).expect('Cache-Control','no-store');
    expect(health.headers['content-security-policy']).toContain("img-src 'self' data: blob:");
    expect(health.headers['content-security-policy']).toContain("script-src 'self'");
    const spec=await agent.get('/api/openapi.json').expect(200);
    expect(spec.body.openapi).toBe('3.0.3'); expect(spec.body.paths['/api/hr/logs']).toBeTruthy();
    await agent.get('/api/docs/').expect(200).expect('Content-Type',/html/);
  });
  it('returns 401 for protected reads without a session', async () => {await agent.get('/api/hr/profile').expect(401);expect(services.profile).not.toHaveBeenCalled();});
  it('rotates module CSRF and cookie on upstream sign-in and rejects the previous session', async () => {
    const {initial,res}=await enter();
    expect(csrf).toMatch(/^[a-f0-9]{64}$/); expect(csrf).not.toBe(initial.body.csrfToken);
    expect(res.headers['set-cookie'][0]).not.toBe(initial.headers['set-cookie'][0]);
    await agent.patch('/api/hr/notifications/read-all').set('x-csrf-token',initial.body.csrfToken).expect(403);
    await request(app).get('/api/auth/me').set('Cookie',initial.headers['set-cookie'][0].split(';')[0]).expect(401);
    await agent.get('/api/auth/me').expect(200);
  });
  it.each([undefined,'','a'.repeat(63),'a'.repeat(65),'A'.repeat(64),'g'.repeat(64),'é'.repeat(64),'0'.repeat(64)])('rejects malformed, Unicode, missing and incorrect tokens with 403: %s', async token => {
    await enter(); let req=agent.patch('/api/hr/notifications/read-all'); if(token!==undefined) req=req.set('x-csrf-token',token);
    await req.expect(403); expect(services.markAllRead).not.toHaveBeenCalled();
  });
  it('checks Origin even with a valid token', async () => {
    await enter(); await agent.patch('/api/hr/notifications/read-all').set('x-csrf-token',csrf).set('Origin','https://other.example.test').expect(403);
    await agent.patch('/api/hr/notifications/read-all').set('x-csrf-token',csrf).set('Origin','http://localhost:5173').expect(200);
  });
  it('destroys the stored session on logout and rejects replay', async () => {
    const {res}=await enter(); const cookie=res.headers['set-cookie'][0].split(';')[0];
    await agent.post('/api/auth/logout').set('x-csrf-token',csrf).expect(204);
    await request(app).get('/api/auth/me').set('Cookie',cookie).expect(401);
    await request(app).patch('/api/hr/notifications/read-all').set('Cookie',cookie).set('x-csrf-token',csrf).expect(403);
  });
  it('rejects browser role assignment and honors backend revocation', async () => {
    await enter(); await agent.post('/api/auth/login').set('x-csrf-token',csrf).send({email:'hr@example.test',password:'test-only',role:'HR'}).expect(404);
    services.authorize.mockRejectedValue(new HttpError(403,'Revoked'));
    await agent.get('/api/hr/notifications').expect(403); expect(services.notifications).not.toHaveBeenCalled();
  });
  it('denies a non-HR session independent of frontend visibility', async () => {
    const issued=team.issue(1,'CANDIDATE'); agent.set('Cookie',issued.name+'='+issued.value);
    await agent.get('/api/auth/me').expect(403); await agent.get('/api/hr/profile').expect(403);
  });
  it('does not trust a browser-provided HR ID or bearer string when no adapter is connected', async () => {
    const closed=createApp({services,sessionStore:store,config:{secret:'test-only-session-secret-never-used-outside-tests',origin:'http://localhost:5173',uploadDir}});
    await request(closed).get('/api/hr/profile?hrUserId=1').set('x-user-id','1').set('x-role','HR').set('Authorization','Bearer unverified').expect(401);
    expect((await request(closed).get('/api/auth/config')).body).toEqual({loginUrl:null,adapterConfigured:false});
    expect(services.profile).not.toHaveBeenCalled();
  });
  it('rejects old CSRF after changing upstream accounts until me is refreshed', async () => {
    await enter(); const previous=csrf, other=team.issue(2); agent.set('Cookie',other.name+'='+other.value);
    await agent.patch('/api/hr/notifications/read-all').set('x-csrf-token',previous).expect(403);
    const me=await agent.get('/api/auth/me').expect(200);
    expect(me.body.csrfToken).not.toBe(previous);
    await agent.patch('/api/hr/notifications/read-all').set('x-csrf-token',me.body.csrfToken).expect(200);
    expect(services.markAllRead).toHaveBeenCalledWith(2);
  });
  it('retains the session and reports failure when upstream logout fails', async () => {
    await enter(); const logout=team.adapter.logout;
    team.adapter.logout=vi.fn().mockRejectedValue(new HttpError(503,'Team logout unavailable.'));
    await agent.post('/api/auth/logout').set('x-csrf-token',csrf).expect(503);
    await agent.get('/api/auth/me').expect(200);
    team.adapter.logout=logout;
    const cookie=teamCookie;
    await agent.post('/api/auth/logout').set('x-csrf-token',csrf).expect(204);
    await request(app).get('/api/hr/profile').set('Cookie',cookie).expect(401);
  });
  it('forwards the authenticated HR ID and bounded filters', async () => {
    await enter(); await agent.get('/api/hr/notifications?read=unread&page=2&search=Casey').expect(200);
    expect(services.notifications).toHaveBeenCalledWith(1,expect.objectContaining({read:'unread',page:2,pageSize:10,search:'Casey'}));
    await agent.get('/api/hr/notifications?recipientUserId=2').expect(422);
  });
  it('validates and restores only explicitly supplied notification IDs', async () => {
    await enter();
    await agent.patch('/api/hr/notifications/restore-unread').set('x-csrf-token',csrf).send({notificationIds:[]}).expect(422);
    await agent.patch('/api/hr/notifications/restore-unread').set('x-csrf-token',csrf).send({notificationIds:[7,8]}).expect(200);
    expect(services.restoreUnread).toHaveBeenCalledWith(1,[7,8]);
  });
  it('rejects future dates before notification or log services are called', async () => {
    await enter();
    await agent.get('/api/hr/notifications?from=9999-12-31').expect(422);
    await agent.get('/api/hr/logs?to=9999-12-31').expect(422);
    expect(services.notifications).not.toHaveBeenCalled();
    expect(services.logs).not.toHaveBeenCalled();
  });
  it('rejects profile mass assignment, then saves allowed fields', async () => {
    await enter(); const allowed={fullName:'Riley',phone:'',officeLocation:'Office'};
    await agent.patch('/api/hr/profile').set('x-csrf-token',csrf).send({...allowed,email:'other@example.test'}).expect(422);
    expect(services.updateProfile).not.toHaveBeenCalled();
    await agent.patch('/api/hr/profile').set('x-csrf-token',csrf).send(allowed).expect(200);
    expect(services.updateProfile).toHaveBeenCalledWith(1,allowed);
  });
  it.each(['/api/hr/logs/99','/api/hr/applications/99','/api/hr/attachments/99/download'])('uses 404 for inaccessible records: %s', async url => {
    await enter(); for(const key of ['log','application','attachment']) services[key].mockRejectedValue(new HttpError(404,'Record not found or not accessible.'));
    await agent.get(url).expect(404);
  });
  it('returns 404 for another HR notification and 422 for malformed IDs', async () => {
    await enter(); services.markRead.mockRejectedValue(new HttpError(404,'Record not found or not accessible.'));
    await agent.patch('/api/hr/notifications/99/read').set('x-csrf-token',csrf).expect(404);
    expect(services.markRead).toHaveBeenCalledWith(1,99);
    await agent.patch('/api/hr/notifications/-1/read').set('x-csrf-token',csrf).expect(422);
  });
  it('returns 409 for duplicate template names', async () => {
    await enter(); services.createTemplate.mockRejectedValue(Object.assign(new Error('private DB details'),{name:'SequelizeUniqueConstraintError'}));
    await agent.post('/api/hr/templates').set('x-csrf-token',csrf).send({templateName:'Accepted',subject:'Hi',body:'Hi [CandidateName]',usageType:'ACCEPTED'}).expect(409);
  });
  it('rejects non-success statuses on the public history endpoint', async () => {
    await enter(); for(const status of ['PREVIEW','PENDING','FAILED']) await agent.get(`/api/hr/logs?status=${status}`).expect(422);
    expect(services.logs).not.toHaveBeenCalled();
  });
  it('removes a superseded generated avatar only after successful persistence', async () => {
    await enter();
    const previous='11111111-1111-4111-8111-111111111111.jpg';
    await fs.writeFile(path.join(uploadDir,previous),'old avatar');
    services.updatePhoto.mockResolvedValue({profile,previousPhoto:previous});
    const png=await sharp({create:{width:16,height:16,channels:3,background:'#3366ee'}}).png().toBuffer();
    await agent.post('/api/hr/profile/photo').set('x-csrf-token',csrf).attach('photo',png,'photo.png').expect(200);
    expect(await fs.readdir(uploadDir)).toHaveLength(1);
    await expect(fs.access(path.join(uploadDir,previous))).rejects.toMatchObject({code:'ENOENT'});
  });
  it('preserves a previous avatar referenced by another profile or attachment', async () => {
    await enter();
    const previous='11111111-1111-4111-8111-111111111111.jpg';
    await fs.writeFile(path.join(uploadDir,previous),'shared avatar');
    services.updatePhoto.mockResolvedValue({profile,previousPhoto:previous});services.photoInUse.mockResolvedValue(true);
    const png=await sharp({create:{width:16,height:16,channels:3,background:'#3366ee'}}).png().toBuffer();
    await agent.post('/api/hr/profile/photo').set('x-csrf-token',csrf).attach('photo',png,'photo.png').expect(200);
    expect(await fs.readdir(uploadDir)).toHaveLength(2);
  });
  it('downloads an authorized real stored file with its original filename', async () => {
    await enter();
    const name='33333333-3333-4333-8333-333333333333.txt';
    const contents='Fictional attachment fixture. No real offer is issued.';
    await fs.writeFile(path.join(uploadDir,name),contents);
    services.attachment.mockResolvedValue({fileUrl:name,fileName:'Demo note.txt'});
    const response=await agent.get('/api/hr/attachments/1/download').expect(200);
    expect(response.headers['content-disposition']).toContain('Demo note.txt');
    expect(response.text).toBe(contents);
  });
  it('rejects invalid calendar dates and malformed JSON', async () => {
    await enter(); await agent.get('/api/hr/logs?from=2026-02-30').expect(422);
    await agent.patch('/api/hr/profile').set('x-csrf-token',csrf).set('Content-Type','application/json').send('{').expect(400);
  });
  it('returns documented parser errors without echoing submitted fragments', async () => {
    const malformed=await agent.patch('/api/hr/profile').set('Content-Type','application/json').send('{"private-note":DO_NOT_ECHO}').expect(400);
    expect(malformed.body).toEqual({error:{message:'Malformed JSON body.'}});
    const tooLarge=await agent.patch('/api/hr/profile').send({fullName:'x'.repeat(101*1024)}).expect(413);
    expect(tooLarge.body).toEqual({error:{message:'Request body is too large.'}});
    expect(services.updateProfile).not.toHaveBeenCalled();
  });
  it('validates photo bytes and rejects oversized or unsupported files', async () => {
    await enter(); await agent.post('/api/hr/profile/photo').set('x-csrf-token',csrf).attach('photo',Buffer.from('not an image'),'photo.png').expect(422);
    await agent.post('/api/hr/profile/photo').set('x-csrf-token',csrf).attach('photo',Buffer.alloc(2*1024*1024+1),'photo.png').expect(422);
    expect(services.updatePhoto).not.toHaveBeenCalled();
  });
  it('normalizes a valid photo to JPEG and removes new file if persistence fails', async () => {
    await enter(); const png=await sharp({create:{width:10,height:20,channels:3,background:'#3366ff'}}).png().toBuffer();
    await agent.post('/api/hr/profile/photo').set('x-csrf-token',csrf).attach('photo',png,'photo.png').expect(200);
    const files=await fs.readdir(uploadDir); expect(files).toHaveLength(1);
    expect(await sharp(path.join(uploadDir,files[0])).metadata()).toMatchObject({format:'jpeg',width:384,height:384});
    services.updatePhoto.mockRejectedValue(new HttpError(409,'Test persistence failure'));
    await agent.post('/api/hr/profile/photo').set('x-csrf-token',csrf).attach('photo',png,'photo.png').expect(409);
    expect(await fs.readdir(uploadDir)).toEqual(files);
  });
  it('does not permit arbitrary storage paths and reports missing files', async () => {
    await enter(); services.photo.mockResolvedValue('../outside.jpg'); await agent.get('/api/hr/profile/photo').expect(404);
    services.attachment.mockResolvedValue({fileUrl:'../outside.txt',fileName:'file.txt'}); await agent.get('/api/hr/attachments/1/download').expect(404);
    services.attachment.mockResolvedValue({fileUrl:'11111111-1111-1111-1111-111111111111.pdf',fileName:'file.pdf'}); await agent.get('/api/hr/attachments/1/download').expect(404);
  });
});
