import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcrypt';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const require = createRequire(import.meta.url);
const {createApp} = require('../JRS Login and profile/server/app.js');
const {MemoryRepository} = require('../JRS Login and profile/tests/memory-repository.js');
const {hash} = require('../JRS Login and profile/server/utils/tokens.js');
const config = {origin:'http://localhost:3100', production:false, integratedRoot:true,
  resetSecret:'r'.repeat(64), sessionMs:3600000, uploadDir:'.local/no-uploads'};
const invalid = ['lowercase1!', 'UPPERCASE1!', 'NoDigitsHere!', '1111111as', 'Chinese1!\u4e2d\u6587', 'Emoji1!\u{1f600}', 'Hidden1!\n', 'Aa1!', 'Aa1!'+'x'.repeat(69)];
const {passwordPolicyError} = require('../JRS Login and profile/client/utils/password-policy.js');
test('creation reports every missing condition and accepts passwords without symbols', () => {
  assert.equal(passwordPolicyError('1111111as'), 'Add at least one uppercase letter.');
  assert.equal(passwordPolicyError('abc'), 'Use at least 8 characters. Add at least one uppercase letter. Add at least one number.');
  assert.equal(passwordPolicyError('NoSymbols123'), '');
  assert.ok(passwordPolicyError('Aa1'+'x'.repeat(70)));
});
test('registration and reset accept a password without a special symbol', async () => {
  const repo = new MemoryRepository();
  const app = createApp({repository:repo,config,mailer:{ready:false}});
  await request(app).post('/api/register').send({email:'plain@example.test',first_name:'Example',password:'NoSymbols123'}).expect(201);
  const token='b'.repeat(64), instant=new Date(), expiry=new Date(instant.getTime()+600000);
  await repo.saveReset(1,'fixture',expiry,instant);
  await repo.verifyCode(1,'fixture',hash(token),expiry,instant);
  await request(app).post('/api/set-new-password').send({resetToken:token,newPassword:'Updated123'}).expect(200);
  assert.equal(await bcrypt.compare('Updated123',repo.accounts[0].password_hash),true);
});
for (const password of invalid) test('server registration refuses invalid new passwords: '+JSON.stringify(password), async () => {
  const repo = new MemoryRepository();
  const app = createApp({repository:repo,config,mailer:{ready:false}});
  await request(app).post('/api/register').send({email:'new@example.test', first_name:'Example',password}).expect(400);
  assert.equal(repo.accounts.length,0);
});
test('valid password is hashed without trimming and an existing non-ASCII password can still log in', async () => {
  const repo = new MemoryRepository();
  const app = createApp({repository:repo,config,mailer:{ready:false}});
  await request(app).post('/api/register').send({email:'new@example.test',first_name:'Example',password:' Example1! '}).expect(201);
  assert.equal(await bcrypt.compare(' Example1! ',repo.accounts[0].password_hash),true);
  await repo.register('legacy@example.test',await bcrypt.hash('Legacy\u4e2d\u6587',4),'Legacy','');
  await request(app).post('/api/login').send({email:'legacy@example.test',password:'Legacy\u4e2d\u6587'}).expect(200);
});
test('reset enforces the creation policy without consuming the token on invalid input', async () => {
  const instant = new Date('2026-10-21T04:00:00Z'), repo = new MemoryRepository(()=>instant);
  await repo.register('reset@example.test',await bcrypt.hash('Original1!',4),'Example','');
  const token = 'a'.repeat(64), oldHash = repo.accounts[0].password_hash;
  const expiry = new Date(instant.getTime()+600000);
  await repo.saveReset(1,'fixture-code',expiry,instant);
  await repo.verifyCode(1,'fixture-code',hash(token),expiry,instant);
  const app = createApp({repository:repo,config,now:()=>instant,mailer:{ready:false}});
  for (const newPassword of invalid.slice(0,6)) {
    await request(app).post('/api/set-new-password').send({resetToken:token,newPassword}).expect(400);
    assert.equal(repo.accounts[0].password_hash,oldHash);
  }
  await request(app).post('/api/set-new-password').send({resetToken:token,newPassword:'Updated1!'}).expect(200);
});
test('password reset form blocks invalid creation passwords before transport', async () => {
  const base = new URL('../JRS Login and profile/client/', import.meta.url);
  const dom = new JSDOM(await fs.readFile(new URL('pages/set-new-password/set-new-password.html',base),'utf8'), {
    url:'http://localhost/pages/set-new-password/set-new-password.html', runScripts:'outside-only'
  });
  const w = dom.window;
  try {
    await new Promise(resolve => w.addEventListener('load',resolve,{once:true}));
    let requests = 0;
    w.sessionStorage.setItem('reset_token','a'.repeat(64));
    w.JRS = {request:async () => {requests++; throw new Error('Unexpected request');}};
    w.eval(await fs.readFile(new URL('utils/password-policy.js',base),'utf8'));
    w.eval(await fs.readFile(new URL('pages/set-new-password/set-new-password.js',base),'utf8'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    for (const value of invalid.slice(0,6)) {
      w.document.getElementById('newPassword').value = value;
      w.document.getElementById('confirmPassword').value = value;
      w.document.getElementById('resetPasswordForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
      await new Promise(resolve=>setTimeout(resolve,0));
      assert.equal(requests,0);
      assert.equal(w.document.activeElement.id,'newPassword');
      assert.ok(w.document.getElementById('newPasswordError').textContent);
    }
  } finally {w.close();}
});
