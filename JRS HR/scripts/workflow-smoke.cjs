'use strict';
const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');
const {randomBytes,randomUUID}=require('crypto');
const {config}=require('../server/config.cjs');
const {initialize,seedDemo}=require('../scripts/database.cjs');
const {createRepository}=require('../server/repository.cjs');
const {createApp}=require('../server/app.cjs');
const M=require('../dist/state.js');
(async()=>{
  const cfg=config();assert.equal(cfg.team,false);assert.equal(cfg.db.host,'127.0.0.1');
  const database='jrs_hr_http_'+randomBytes(6).toString('hex')+'_test';cfg.db.database=database;cfg.mail.enabled=false;
  let pool,server;
  try{
    const password='Local-smoke-fixture-2026';
    await initialize(cfg,[{id:'smoke-manager',name:'Junye Shen',email:'manager@jrs.local',password,role:'HR_MANAGER',employeeId:'QA-MGR'}, {id:'smoke-staff',name:'QA Staff',email:'staff@jrs.local',password,role:'HR_STAFF',employeeId:'QA-STAFF'}]);
    await seedDemo(cfg);pool=mysql.createPool(cfg.db);const repo=createRepository(pool);
    server=createApp({repo,cfg}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const origin='http://127.0.0.1:'+server.address().port;cfg.origin=origin;
    async function login(email){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email,password})});assert.equal(r.status,200);const d=await r.json();return {Cookie:r.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':d.csrfToken};}
    const auth=await login('manager@jrs.local'),staff=await login('staff@jrs.local');
    let db;
    async function request(path,method='GET',body,headers={},expected=200){const r=await fetch(origin+'/api/'+path,{method,headers:{...auth,Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,expected,d.error?.message);return d;}
    db=await request('hr/workspace');
    async function command(name,p,expected=200,identity={}){const d=await request('hr/commands/'+name,'POST',p,{'If-Match':String(db.revision),'Idempotency-Key':randomUUID(),...identity},expected);if(d.db)db=d.db;return d.result;}
    const job=await command('job-save',{title:'QA Full workflow',department:'Engineering',type:'Full-time',location:'Singapore',mode:'Hybrid',experience:'1 year',education:'Degree',skills:'JavaScript, SQL',requirements:'Build web applications',description:'Local QA fixture',status:'Active'});
    const j=db.jobs.find(x=>x.title==='QA Full workflow');assert.ok(j);
    const received=await command('application-create',{jobId:j.id,priority:'High',candidate:{name:'QA Candidate',email:'candidate@example.com',phone:'123456789',location:'Singapore',experience:2,education:'Degree',skills:'JavaScript, SQL'}});
    const a=received.application,c=db.candidates.find(c=>c.id===a.candidateId);
    const pdf=Buffer.from('%PDF-1.4\nQA fixture PDF data\n%%EOF\n');
    let r=await fetch(origin+'/api/hr/candidates/'+c.id+'/resume',{method:'PUT',headers:{...auth,Origin:origin,'Content-Type':'application/pdf','X-Filename':'qa-resume.pdf','If-Match':String(db.revision)},body:pdf});assert.equal(r.status,200);db=(await r.json()).db;
    r=await fetch(origin+'/api/hr/candidates/'+c.id+'/resume',{headers:auth});assert.equal(r.status,200);assert.ok(Buffer.from(await r.arrayBuffer()).equals(pdf));
    await command('move-interview',{applicationId:a.id,notify:true,notes:'Local QA only'});
    const booking=await command('schedule',{applicationId:a.id,date:M.day(2),time:'10:00',duration:45,format:'Video',location:'QA meeting',interviewer:'Junye Shen',notes:'QA',notify:true});
    const feedback={applicationId:a.id,interviewId:booking.interview.id,rating:4,recommendation:'Proceed',notes:'QA feedback'};
    await command('feedback',feedback,422);
    // Only this disposable test database is moved into the past to test post-interview feedback.
    await pool.execute('UPDATE hr_interview SET interview_date=? WHERE id=?',[M.day(-1),booking.interview.id]);
    await command('feedback',feedback);
    await command('offer',{applicationId:a.id,salary:5000,startDate:M.day(30),expiry:M.day(7),terms:'QA terms'});
    await command('approve-offer',{applicationId:a.id},403,staff);
    await command('approve-offer',{applicationId:a.id});
    await command('offer-message',{applicationId:a.id});
    await command('accept-offer',{applicationId:a.id,notes:'Fictional QA acceptance'});
    assert.equal(db.applications.find(x=>x.id===a.id).stage,'Hired');
    const second=await command('application-create',{jobId:db.jobs.find(x=>x.id!==j.id&&x.status==='Active').id,candidateId:c.id});
    await command('reject',{applicationId:second.application.id,reason:'QA rejection',notify:true});
    const notice=db.notifications.find(n=>n.applicationId===second.application.id&&n.status==='Draft');assert.equal(notice.kind,'Rejected');
    await command('message',{applicationId:second.application.id,notificationId:notice.id,subject:'QA edited draft',body:'QA draft remains local.'});
    assert.equal(db.notifications.find(n=>n.id===notice.id).subject,'QA edited draft');
    const task=await command('task',{applicationId:second.application.id,title:'QA follow-up',assignee:'Junye Shen',due:M.day(1),notes:''});
    await command('complete-task',{id:db.tasks.find(t=>t.title==='QA follow-up').id});
    await command('profile-save',{phone:'123456789',officeLocation:'QA office'});assert.equal(db.currentUser.officeLocation,'QA office');
    await command('system-read-all',{});assert.ok(db.systemNotifications.every(n=>n.read));
    const final=await request('hr/workspace');assert.equal(final.applications.length,117);
    console.log('PASS: login, job creation, new/existing candidate applications, PDF round-trip, review, scheduling, early feedback guard, results, staff permissions, offer approval/acceptance, rejection/drafts, tasks, profile, read status and persistence. No SMTP or shared database used.');
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();
    assert.match(database,/^jrs_hr_http_[0-9a-f]{12}_test$/);
    const {database:ignored,...opts}=cfg.db;const admin=await mysql.createConnection(opts);try{await admin.query('DROP DATABASE IF EXISTS `'+database+'`');}finally{await admin.end();}
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
