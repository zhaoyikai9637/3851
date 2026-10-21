import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcrypt';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createApp} = require('../JRS Login and profile/server/app.js');
const {MemoryRepository} = require('../JRS Login and profile/tests/memory-repository.js');
const {hash} = require('../JRS Login and profile/server/utils/tokens.js');
const config = {origin:'http://localhost:3100',production:false,integratedRoot:true,resetSecret:'r'.repeat(64),sessionMs:3600000,uploadDir:'.local/no-uploads'};
async function fixture(role='candidate',eligible=true) {
 const repo=new MemoryRepository();await repo.register('person@example.test',await bcrypt.hash('Original1!',4),'Example','Person');
 repo.accounts[0].role=role;repo.accounts[0].recovery_eligible=eligible;
 const messages=[];
 const mailer={ready:true,sendResetLink:async(to,url)=>messages.push({kind:'reset',to,url}),sendHrAssistance:async(to)=>messages.push({kind:'assistance',to})};
 return {repo,messages,mailer,app:createApp({repository:repo,config,mailer})};
}
test('unknown and ineligible accounts show explicit errors without sending email',async()=>{
 const f=await fixture();
 const absent=await request(f.app).post('/api/forgot-password').send({email:'missing@example.test'}).expect(404);
 assert.equal(absent.body.error,'Account not found.');assert.equal(f.messages.length,0);
 const blocked=await fixture('candidate',false);
 const unavailable=await request(blocked.app).post('/api/forgot-password').send({email:'person@example.test'}).expect(403);
 assert.equal(unavailable.body.error,'Password recovery is unavailable for this account.');assert.equal(blocked.messages.length,0);
});
test('HR receives supervisor guidance without a token and shares the public success response',async()=>{
 const hr=await fixture('hr'),candidate=await fixture();
 const h=await request(hr.app).post('/api/forgot-password').send({email:'person@example.test'}).expect(200);
 const c=await request(candidate.app).post('/api/forgot-password').send({email:'person@example.test'}).expect(200);
 assert.deepEqual(h.body,c.body);assert.equal(h.body.recoveryMode,'email');
 assert.deepEqual(hr.messages,[{kind:'assistance',to:'person@example.test'}]);assert.equal(hr.repo.resets.size,0);
 assert.equal(candidate.messages[0].kind,'reset');
 await request(hr.app).post('/api/forgot-password').send({email:'person@example.test'}).expect(429);
 assert.equal(hr.messages.length,1);
});
test('a historical HR reset credential cannot change its password',async()=>{
 const f=await fixture('hr'),token='f'.repeat(64),now=new Date();
 await f.repo.saveReset(1,'code',new Date(now.getTime()+600000),now);
 await f.repo.verifyCode(1,'code',hash(token),new Date(now.getTime()+600000),now);
 const before=f.repo.accounts[0].password_hash;
 await request(f.app).post('/api/set-new-password').send({resetToken:token,newPassword:'Changed1!'}).expect(400);
 assert.equal(f.repo.accounts[0].password_hash,before);
});
test('SMTP failure does not claim success or leave a usable reset credential',async()=>{
 const f=await fixture();f.mailer.sendResetLink=async()=>{throw new Error('fixture delivery failure');};
 await request(f.app).post('/api/forgot-password').send({email:'person@example.test'}).expect(503);
 assert.equal(f.repo.resets.size,0);
});
