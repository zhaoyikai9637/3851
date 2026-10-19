const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {once}=require('node:events');
const {config}=require('../server/config.cjs');
const {createApp}=require('../server/app.cjs');
const {initialize,seedDemo}=require('../scripts/database.cjs');
const ca=fs.readFileSync(path.join(__dirname,'../certs/jrs-ca.pem'),'utf8');
const team={INTEGRATION_MODE:'team',DB_HOST:'database.example.invalid',DB_NAME:'team_test',DB_USER:'personal_developer',DB_SSL_CA:ca,MAIL_ENABLED:'true',MAIL_ALLOW_SMTP:'true'};
test('team CA accepts inline and portable file forms and enforces chain plus hostname verification',()=>{
  const inline=config(team),file=config({...team,DB_SSL_CA:'certs/jrs-ca.pem'});
  assert.equal(inline.db.ssl.ca,file.db.ssl.ca);assert.equal(file.db.ssl.rejectUnauthorized,true);assert.equal(file.db.ssl.verifyIdentity,true);
  assert.throws(()=>config({...team,DB_SSL_CA:''}),/requires/);
  assert.throws(()=>config({...team,DB_SSL_CA:'-----BEGIN CERTIFICATE-----\nbroken\n-----END CERTIFICATE-----'}));
});
test('team write policy fails closed, preview email cannot send, and coordinator credentials are not runtime credentials',()=>{
  assert.equal(config(team).writesEnabled,false);assert.equal(config(team).mail.enabled,false);
  assert.equal(config({...team,DB_WRITE_CONFIRMED:'true',DB_SHARED_INTEGRATION_CONFIRMED:'true'}).writesEnabled,false);
  const approved={...team,DB_WRITE_CONFIRMED:'team_test',DB_SHARED_INTEGRATION_CONFIRMED:'team_test'};
  assert.equal(config(approved).writesEnabled,true);assert.equal(config({...approved,MAIL_MODE:'preview'}).mail.enabled,false);
  assert.throws(()=>config({...team,DB_USER:'jrs_migration_owner'}),/personal developer/);
  assert.throws(()=>config({...team,TEAM_AUTH_ADAPTER:'unimplemented-module'}),/not implemented/);
});
test('shared read-only policy blocks login and every mutation before SQL writes',async()=>{
  let writes=0;
  const repo={pool:{query:async()=>[[{ok:1}]],execute:async()=>{writes++;throw Error('Unexpected write');}}};
  const server=createApp({repo,cfg:config(team)}).listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const base='http://127.0.0.1:'+server.address().port;
    for(const [route,method] of [['auth/login','POST'],['auth/password','POST'],['hr/commands/reject','POST'],['hr/candidates/sample/resume','PUT']]){
      const r=await fetch(base+'/api/'+route,{method,headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(r.status,503);assert.equal((await r.json()).error.code,'TEAM_READ_ONLY');
    }
    assert.equal((await fetch(base+'/api/health')).status,200);assert.equal(writes,0);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('shared database cannot be initialized or seeded with local convenience commands',async()=>{
  await assert.rejects(initialize(config(team)),/local-only/);
  await assert.rejects(seedDemo(config(team)),/disabled/);
  await assert.rejects(initialize(config({DB_HOST:'remote.example.invalid'})),/local-only/);
});
