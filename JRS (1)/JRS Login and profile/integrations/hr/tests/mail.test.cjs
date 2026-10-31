const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const M=require('../dist/state.js');
const {createMailer}=require('../server/mail.cjs');
const {applyCommand}=require('../server/service.cjs');
const {recoverStaleSends}=require('../server/recovery.cjs');
const user={id:'hr-test',name:'HR Test',role:'HR_MANAGER'};
function fixture(enabled=true){
  let db={...M.seed(),templates:[],systemNotifications:[],mailLogs:[]};db.candidates[0].email='recipient@jrs.local';
  const {notification}=applyCommand(db,'message',{applicationId:db.applications[0].id,subject:'Test',body:'Test message'},user);
  let queue=Promise.resolve();
  const repo={load:async()=>M.clone(db),save:async(c,b,a)=>{db=M.clone(a);},transaction:async fn=>{const before=queue;let release;queue=new Promise(r=>release=r);await before;try{return await fn({});}finally{release();}}};
  return {repo,id:notification.id,db:()=>M.clone(db),cfg:{mail:{enabled,host:'smtp.test',from:'hr@jrs.local'}}};
}
test('disabled SMTP keeps a draft and successful handoff records exactly one log',async()=>{
  const f=fixture(false);await assert.rejects(createMailer(f.repo,f.cfg).send(f.id,user,0),/not enabled/);assert.equal(f.db().notifications[0].status,'Draft');assert.equal(f.db().mailLogs.length,0);
  f.cfg.mail.enabled=true;let calls=0;const sender=createMailer(f.repo,f.cfg,{sendMail:async message=>{calls++;return {accepted:[message.to],messageId:'test-id'};}});
  await sender.send(f.id,user,0);await sender.send(f.id,user,0);assert.equal(calls,1);assert.equal(f.db().notifications[0].status,'Sent');assert.equal(f.db().mailLogs.length,1);assert.equal(f.db().mailLogs[0].body,'Test message');
});
test('ambiguous SMTP failure never creates a success log or automatically retries',async()=>{
  const f=fixture(),sender=createMailer(f.repo,f.cfg,{sendMail:async()=>{throw Error('Connection ended before acknowledgement');}});
  await assert.rejects(sender.send(f.id,user,0),e=>e.code==='MAIL_UNCERTAIN');assert.equal(f.db().notifications[0].status,'Uncertain');assert.equal(f.db().mailLogs.length,0);await assert.rejects(sender.send(f.id,user,1),/current draft/);
});
test('parallel send requests cannot submit the same message twice',async()=>{
  const f=fixture();let release;const gate=new Promise(r=>release=r);let started;const hasStarted=new Promise(r=>started=r);let calls=0;
  const sender=createMailer(f.repo,f.cfg,{sendMail:async m=>{calls++;started();await gate;return {accepted:[m.to],messageId:'parallel-test'};}});
  const first=sender.send(f.id,user,0);await hasStarted;await assert.rejects(sender.send(f.id,user,0),/current draft/);release();await first;assert.equal(calls,1);
});
test('crashed sends become uncertain without fabricating delivery history',async()=>{
  const f=fixture();await f.repo.transaction(async conn=>{const old=await f.repo.load(conn),next=M.clone(old);next.notifications[0].status='Sending';next.notifications[0].sendingAt=new Date(Date.now()-6*60000).toISOString();await f.repo.save(conn,old,next);});
  await recoverStaleSends(f.repo);assert.equal(f.db().notifications[0].status,'Uncertain');assert.equal(f.db().mailLogs.length,0);
});
