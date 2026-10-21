import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import request from 'supertest';
import bcrypt from 'bcrypt';
import {loadSettings,assertLocalDatabase} from '../server/config.mjs';
const require=createRequire(import.meta.url),{Repository}=require('../JRS Login and profile/server/services/repository.js'),{createApp}=require('../JRS Login and profile/server/app.js'),{hash}=require('../JRS Login and profile/server/utils/tokens.js');
test('real SQL recovery distinguishes missing users, resets candidates and refuses historical HR tokens',async()=>{
 const settings=loadSettings();assertLocalDatabase(settings);const pool=mysql.createPool({...settings.db,database:'jrs_integrated_test_20261019'}),repo=new Repository(pool,{integratedRoot:true});
 const suffix=randomUUID().slice(0,18),candidateEmail='recovery-'+suffix+'@example.test',hrEmail='guidance-'+suffix+'@example.test',oldHash=await bcrypt.hash('Original1!',4),ids=[];let hrId;
 try{
  ids.push(await repo.register(candidateEmail,oldHash,'Recovery','Fixture'));
  const [hr]=await pool.execute("INSERT INTO HR_USER(employee_id,full_name,email,role,department,account_status) VALUES(?,?,?,'HR_MANAGER','Test','ACTIVE')",['TEST-'+suffix,'Guidance fixture',hrEmail]);hrId=hr.insertId;
  const [account]=await pool.execute("INSERT INTO MODULE_ACCOUNT(email,password_hash,role,hr_user_id) VALUES(?,?,'hr',?)",[hrEmail,oldHash,hrId]);ids.push(account.insertId);
  const messages=[],config={origin:'http://localhost:3100',production:false,integratedRoot:true,resetSecret:'r'.repeat(64),sessionMs:3600000,uploadDir:'.local/no-uploads'};
  const app=createApp({repository:repo,config,mailer:{ready:true,sendResetLink:async(to,url)=>messages.push({to,url}),sendHrAssistance:async(to)=>messages.push({to,guidance:true})}});
  await request(app).post('/api/forgot-password').send({email:'absent-'+suffix+'@example.test'}).expect(404);
  const client=request.agent(app);await client.post('/api/login').send({email:candidateEmail,password:'Original1!'}).expect(200);await client.get('/api/me').expect(200);
  await request(app).post('/api/forgot-password').send({email:candidateEmail}).expect(200);
  const token=new URLSearchParams(new URL(messages[0].url).hash.slice(1)).get('token');
  const [[stored]]=await pool.execute('SELECT token_hash FROM JRS_PASSWORD_RESET WHERE account_id=?',[ids[0]]);assert.equal(stored.token_hash,hash(token));
  await request(app).post('/api/set-new-password').send({resetToken:token,newPassword:'Changed1!'}).expect(200);
  await client.get('/api/me').expect(401);await request(app).post('/api/set-new-password').send({resetToken:token,newPassword:'Another1!'}).expect(400);
  assert.equal(await bcrypt.compare('Changed1!',(await repo.findAccount(candidateEmail)).password_hash),true);
  await request(app).post('/api/forgot-password').send({email:hrEmail}).expect(200);assert.equal(messages[1].guidance,true);
  const [[count]]=await pool.execute('SELECT COUNT(*) AS n FROM JRS_PASSWORD_RESET WHERE account_id=?',[ids[1]]);assert.equal(count.n,0);
  const historical='e'.repeat(64),now=new Date();await repo.saveReset(ids[1],hash(historical),new Date(now.getTime()+600000),now,true);
  await request(app).post('/api/set-new-password').send({resetToken:historical,newPassword:'MustNotChange1!'}).expect(400);
  assert.equal((await repo.findAccount(hrEmail)).password_hash,oldHash);
 }finally{
  for(const id of ids){await pool.execute("DELETE FROM MODULE_SESSION WHERE JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(data),data,'{}'),'$.account_id'))=?",[String(id)]);await pool.execute('DELETE FROM JRS_PASSWORD_RESET WHERE account_id=?',[id]);await pool.execute('DELETE FROM CANDIDATE WHERE account_id=?',[id]);await pool.execute('DELETE FROM MODULE_ACCOUNT WHERE account_id=?',[id]);}
  if(hrId)await pool.execute('DELETE FROM HR_USER WHERE user_id=?',[hrId]);await pool.end();
 }
});
