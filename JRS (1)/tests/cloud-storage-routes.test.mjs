import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import request from 'supertest';
import candidateApp from '../JRS Login and profile/server/app.js';import {submittedMaterialsRouter} from '../server/submitted-materials.mjs';import {mountReadiness} from '../server/readiness.mjs';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
test('candidate and HR resume routes use shared private storage while preserving account guards',async()=>{
 const saved=new Map(),bytes=Buffer.from('%PDF-private fixture');let file,hrAllowed=false;
 const store={kind:'supabase',put:async(key,value)=>saved.set(key,value),get:async key=>saved.get(key),remove:async key=>saved.delete(key)};
 const csrf='b'.repeat(64),repo={rateLimit:async()=>true,session:async()=>({account_id:7,role:'candidate',csrf}),candidate:async()=>({candidate_id:3}),addResume:async(id,value)=>{assert.equal(id,3);file={file_name:value.name,storage_key:value.key,file_type:value.type};return 101;},resume:async(id,fileId)=>id===3&&fileId===101?file:null};
 const config={origin:'http://localhost',production:false,integratedRoot:true,secret:'s'.repeat(64),resetSecret:'r'.repeat(64),uploadDir:path.join(os.tmpdir(),'jrs-cloud-unused'),fileStore:store};
 const app=express();app.use('/hr-documents',submittedMaterialsRouter({pool:{execute:async()=>[[file]]},fileStore:store,requireUser:(req,res,next)=>hrAllowed?next():res.sendStatus(401)}));app.use(candidateApp.createApp({repository:repo,config,mailer:{ready:false},inspectFile:async()=> 'application/pdf'}));
 const cookie='jrs_candidate_session='+'a'.repeat(64);
 await request(app).post('/api/profile/resume').set('Cookie',cookie).set('X-CSRF-Token',csrf).attach('resume',bytes,'private.pdf').expect(201);assert.equal(saved.size,1);
 await request(app).get('/api/profile/resume/101').expect(401);
 const download=await request(app).get('/api/profile/resume/101').set('Cookie',cookie).expect(200);assert.deepEqual(download.body,bytes);assert.match(download.headers['content-disposition'],/attachment/);
 await request(app).get('/api/profile/resume/102').set('Cookie',cookie).expect(404);
 await request(app).get('/hr-documents/app-1/submitted-resume').expect(401);hrAllowed=true;const preview=await request(app).get('/hr-documents/app-1/submitted-resume').expect(200);assert.deepEqual(preview.body,bytes);assert.match(preview.headers['content-disposition'],/inline/);assert.equal(preview.headers['cache-control'],'no-store');
});
test('readiness fails closed on private storage outage and never returns provider errors',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jrs-cloud-ready-'));let ready=false;const app=express();mountReadiness(app,{pool:{query:async()=>[[{version:12}]]},uploadDir:directory,fileStore:{check:async()=>{if(!ready)throw Error('private provider detail');}}});
 try{const unavailable=await request(app).get('/health/ready').expect(503);assert.deepEqual(unavailable.body,{status:'not-ready'});ready=true;await request(app).get('/health/ready').expect(200);}finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('HR cloud photos preserve image normalization, private reads, replacement checks and rollback',async()=>{
 const {createApp}=await import('../jrs-hr-module/server/src/app.js');const {teamIdentityFixture}=await import('../jrs-hr-module/server/tests/helpers/team-identity.js');const {default:session}=await import('express-session');const {default:sharp}=await import('sharp');
 const team=teamIdentityFixture(),sessions=new session.MemoryStore(),saved=new Map();let name='',fail=false;
 const profile={userId:1,employeeId:'QA-HR',fullName:'Fictional HR',email:'hr@example.test',role:'HR Manager',department:'HR',accountStatus:'ACTIVE'};
 const store={put:async(key,bytes)=>saved.set(key,bytes),get:async key=>saved.get(key),remove:async key=>saved.delete(key)};
 const services={authorize:async()=>profile,profile:async()=>profile,photo:async()=>name,photoInUse:async()=>false,updatePhoto:async(id,value)=>{assert.equal(id,1);if(fail)throw Object.assign(Error('Rejected'),{status:409});const previousPhoto=name;name=value;return {profile,previousPhoto};}};
 const app=createApp({services,identity:team.adapter,sessionStore:sessions,config:{secret:'fixture-secret-'.repeat(4),origin:'http://localhost',production:false,mode:'standalone',uploadDir:path.join(os.tmpdir(),'unused-cloud-photo'),fileStore:store}});
 const agent=request.agent(app),issued=team.issue(1);agent.set('Cookie',issued.name+'='+issued.value);const csrf=(await agent.get('/api/auth/me').expect(200)).body.csrfToken;
 try{const png=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();await request(app).get('/api/hr/profile/photo').expect(401);
  await agent.post('/api/hr/profile/photo').set('X-CSRF-Token',csrf).attach('photo',png,'photo.png').expect(200);assert.equal(saved.size,1);const first=name;assert.equal((await sharp(saved.get(name)).metadata()).format,'jpeg');
  const photo=await agent.get('/api/hr/profile/photo').expect(200);assert.equal(photo.headers['cache-control'],'no-store');assert.deepEqual(photo.body,saved.get(name));
  await agent.post('/api/hr/profile/photo').set('X-CSRF-Token',csrf).attach('photo',png,'photo.png').expect(200);assert.equal(saved.size,1);assert(!saved.has(first));
  fail=true;await agent.post('/api/hr/profile/photo').set('X-CSRF-Token',csrf).attach('photo',png,'photo.png').expect(409);assert.equal(saved.size,1);
 }finally{await new Promise(resolve=>sessions.clear(resolve));}
});
