const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const M=require('../dist/state.js');
const {applyCommand,fillTemplate,email}=require('../server/service.cjs');
const {passwordHash,verify}=require('../server/auth.cjs');
const {templates}=require('../scripts/database.cjs');
const user={id:'test-hr',name:'Junye Shen',role:'HR_MANAGER'};
function setup(){return {...M.seed(),templates:templates(),systemNotifications:[],mailLogs:[],currentUser:user};}
function run(db,cmd,p,u=user){const next=M.clone(db);const result=applyCommand(next,cmd,p,u);return {db:next,result};}
test('authenticated actor owns the audit and status notifications omit internal notes',()=>{
  const d=setup(),id=d.applications[0].id;const {db,result}=run(d,'move-interview',{applicationId:id,notes:'PRIVATE REVIEW',notify:true});
  assert.equal(result.activity.actor,user.name);assert.equal(result.activity.actorId,user.id);assert.equal(db.applications[0].notes[0].actor,user.name);
  assert.equal(db.systemNotifications.length,1);assert.ok(!JSON.stringify(db.systemNotifications).includes('PRIVATE REVIEW'));
  assert.ok(result.notification.body.includes(user.name));assert.ok(!result.notification.body.includes('PRIVATE REVIEW'));
});
test('manager approval cannot be forged by a staff payload',()=>{
  const d=setup(),a=d.applications.find(a=>a.stage==='Offer'&&a.offer.approval!=='Approved');
  assert.throws(()=>run(d,'approve-offer',{applicationId:a.id,role:'HR_MANAGER'},{...user,role:'HR_STAFF'}),/HR Manager/);
  assert.equal(a.offer.approval,'Awaiting approval');
});
test('receiving an application creates candidate, application and one internal update',()=>{
  const d=setup(),payload={jobId:d.jobs[0].id,candidate:{name:'Test Applicant',email:'test@jrs.local',phone:'+65 8000 1111',location:'Singapore',experience:3,education:'Diploma',skills:'SQL, JavaScript'}};
  const {db,result}=run(d,'application-create',payload);assert.equal(db.applications.length,116);assert.equal(db.candidates.length,116);assert.equal(result.application.stage,'Pending Review');assert.equal(db.systemNotifications.length,1);
  assert.throws(()=>run(db,'application-create',payload),/email already exists/);
  assert.throws(()=>run(db,'application-create',{jobId:d.jobs[0].id,candidateId:result.application.candidateId}),/already has an application/);
});
test('invalid candidate fields and multiple recipients cannot enter the database',()=>{
  for(const address of ['a,b@jrs.local','a@jrs.local\r\nBcc:evil@test.local','a(comment)@jrs.local','a@jrs.local,b@test.local'])assert.throws(()=>email(address));
  const d=setup();assert.throws(()=>run(d,'candidate-save',{id:d.candidates[0].id,name:'X',email:'x@jrs.local',phone:'1',location:'SG',experience:-1,education:'Degree',skills:'SQL'}),/Experience/);
});
test('templates validate variables, keep snapshots and respect workflow stage',()=>{
  const d=setup(),a=d.applications[0],t=d.templates.find(t=>t.kind==='In Progress');
  const filled=fillTemplate(d,a,user,t);assert.ok(filled.body.includes(d.candidates[0].name));assert.ok(!filled.body.includes('{{'));
  assert.throws(()=>run(d,'template-save',{name:'Unsafe',kind:'In Progress',subject:'Test',body:'{{internalNotes}}'}),/Unknown template variable/);
  const offer=d.templates.find(t=>t.kind==='Offer Letter');assert.throws(()=>run(d,'message',{applicationId:a.id,templateId:offer.id,subject:'Offer',body:'Terms'}),/Approve a valid offer/);
  const {db,result}=run(d,'message',{applicationId:a.id,templateId:t.id,subject:filled.subject,body:filled.body+'\nAdditional details'});
  const snapshot=result.notification.body;run(db,'template-save',{...t,body:'Updated wording'});assert.equal(db.notifications[0].body,snapshot);assert.ok(snapshot.endsWith('Additional details'));
});
test('template permissions and archive preserve existing draft references',()=>{
  const d=setup(),t=d.templates[0];assert.throws(()=>run(d,'template-delete',{id:t.id},{...user,role:'HR_STAFF'}),/HR Manager/);
  const {db}=run(d,'template-delete',{id:t.id});assert.equal(db.templates[0].active,false);assert.throws(()=>run(db,'message',{applicationId:d.applications[0].id,templateId:t.id}),/archived/);
});
test('feedback waits until the meeting ends, not just its start',()=>{
  let d=setup(),a=d.applications[0];d=run(d,'move-interview',{applicationId:a.id}).db;
  const sg=new Date(Date.now()+8*3600000-60000),date=sg.toISOString().slice(0,10),time=sg.toISOString().slice(11,16);
  d.interviews.push({id:'ongoing',applicationId:a.id,date,time,duration:60,format:'Video',location:'Link',interviewer:'HR',notes:'',status:'Scheduled',feedback:null});
  assert.throws(()=>run(d,'feedback',{applicationId:a.id,interviewId:'ongoing',rating:4,recommendation:'Proceed',notes:'Good'}),/after the interview ends/);
});
test('sending locks related workflow changes; sent drafts cannot be edited',()=>{
  let d=setup(),a=d.applications[0];d=run(d,'move-interview',{applicationId:a.id,notify:true}).db;d.notifications[0].status='Sending';
  assert.throws(()=>run(d,'reject',{applicationId:a.id,reason:'Mismatch'}),/being sent/);
  d.notifications[0].status='Sent';assert.throws(()=>run(d,'message',{applicationId:a.id,notificationId:d.notifications[0].id,subject:'Changed',body:'Changed'}));
});
test('strict values reject string notification flags, object text and fractional cents',()=>{
  const d=setup();assert.throws(()=>run(d,'move-interview',{applicationId:d.applications[0].id,notify:'false'}),/true or false/);
  assert.throws(()=>run(d,'reject',{applicationId:d.applications[0].id,reason:{value:'x'}}),/Invalid reason/);
  const a=d.applications.find(a=>a.stage==='Interview Results');assert.throws(()=>run(d,'offer',{applicationId:a.id,salary:5000.999,startDate:M.day(30),expiry:M.day(7),terms:'Terms'}),/two decimal places/);
});
test('passwords use random salts and verify without storing plaintext',async()=>{
  const password='Test-password-12345',a=await passwordHash(password),b=await passwordHash(password);assert.notEqual(a,b);assert.ok(!a.includes(password));assert.ok(await verify(password,a));assert.equal(await verify('Wrong-password',a),false);await assert.rejects(passwordHash('short'));
});
test('new HR routes escape candidate, template and profile data',()=>{
  const context={console,Blob,HRModel:M,window:{}};context.window=context;vm.createContext(context);
  for(const f of ['icons.js','resume.js','views.js','hr-extra.js'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+f),'utf8'),context);
  const d=setup();d.currentUser={...user,name:'<script>alert(1)</script>',email:'hr@jrs.local'};d.templates[0].body='<script>alert(1)</script>';
  const ui={q:'',noticeTab:'all',from:'',to:''};
  for(const route of ['notifications','outbox','templates','mail-log','hr-profile']){const html=context.HRViews.render([route],d,ui);assert.ok(html.length>100);assert.ok(!html.includes('<script>'));}
  assert.ok(context.HRViews.render(['templates'],d,ui).includes('&lt;script&gt;'));
});
