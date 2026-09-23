// Real MySQL integration gate. Separate from npm test; never uses a production DB.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');
const {randomBytes,randomUUID}=require('node:crypto');
const {config}=require('../server/config.cjs');
const {initialize,seedDemo}=require('../scripts/database.cjs');
const {createRepository}=require('../server/repository.cjs');
const {createService}=require('../server/service.cjs');
const {createMailer}=require('../server/mail.cjs');
const M=require('../dist/state.js');
test('real MySQL: schema, round-trip, rollback, concurrency, idempotency, mail and attachments',async()=>{
  const cfg=config(),database='jrs_hr_it_'+randomBytes(6).toString('hex')+'_test';cfg.db.database=database;
  assert.ok(!cfg.team&&['127.0.0.1','localhost','::1'].includes(cfg.db.host),'Integration tests are local-only; never use the team database configuration.');
  assert.match(database,/^jrs_hr_it_[0-9a-f]{12}_test$/);
  const user={id:'hr-integration',name:'Integration HR',role:'HR_MANAGER'},password='Integration-password-123';let pool,created=false;
  try {
    // Initialization is repeated to verify that it preserves existing data/accounts.
    created=true;await initialize(cfg,[{...user,email:'integration@jrs.local',password,employeeId:'HR-TEST-001'}]);await initialize(cfg,[]);await seedDemo(cfg);
    pool=mysql.createPool(cfg.db);const repo=createRepository(pool),service=createService(repo);
    let d=await repo.snapshot(user.id);assert.equal(d.applications.length,115);assert.equal(d.interviews.length,24);assert.equal(d.applications.filter(a=>a.stage==='Offer').length,18);M.validate(d);
    await assert.rejects(seedDemo(cfg),/already contains/);
    const id=d.applications[0].id,key=randomUUID(),p={applicationId:id,notify:true,notes:'PRIVATE'};
    const moved=await service.execute('move-interview',p,user,d.revision,key);const repeat=await service.execute('move-interview',p,user,d.revision,key);assert.equal(moved.result.activity.id,repeat.result.activity.id);
    await assert.rejects(service.execute('reject',{applicationId:id,reason:'Mismatch'},user,d.revision,randomUUID()),e=>e.status===409);
    d=await repo.snapshot(user.id);assert.equal(d.notifications.length,1);const before=JSON.stringify(d);
    await assert.rejects(service.execute('reject',{applicationId:id,reason:''},user,d.revision,randomUUID()));assert.equal(JSON.stringify(await repo.snapshot(user.id)),before);
    const second=d.applications.find(a=>a.stage==='Pending Review').id;await service.execute('move-interview',{applicationId:second},user,d.revision,randomUUID());
    d=await repo.snapshot(user.id);const schedule=applicationId=>({applicationId,date:M.day(2),time:'10:00',duration:60,format:'On-site',location:'Room A',interviewer:'Integration HR',notify:true});
    const race=await Promise.allSettled([service.execute('schedule',schedule(id),user,d.revision,randomUUID()),service.execute('schedule',schedule(second),user,d.revision,randomUUID())]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
    d=await repo.snapshot(user.id);const scheduled=d.interviews.find(i=>i.status==='Scheduled'),other=scheduled.applicationId===id?second:id;
    await assert.rejects(service.execute('schedule',schedule(other),user,d.revision,randomUUID()),/overlaps/);
    await service.execute('schedule',{...schedule(other),time:'11:00'},user,d.revision,randomUUID());
    // Real SQL parameterization: apostrophes remain ordinary text.
    d=await repo.snapshot(user.id);const c=d.candidates.find(c=>c.id===d.applications.find(a=>a.id===id).candidateId);
    await service.execute('candidate-save',{id:c.id,name:"O'Connor",email:'recipient@jrs.local',phone:c.phone,location:c.location,experience:c.experience,education:c.education,skills:c.skills.join(', ')},user,d.revision,randomUUID());
    d=await repo.snapshot(user.id);assert.equal(d.candidates.find(x=>x.id===c.id).name,"O'Connor");
    const msg=await service.execute('message',{applicationId:id,subject:'Integration message',body:'No real email will be sent.'},user,d.revision,randomUUID());
    const content=Buffer.from('%PDF-1.4\nIntegration test fixture\n%%EOF\n');await pool.execute('INSERT INTO hr_resume(candidate_id,filename,size_bytes,content,uploaded_at) VALUES (?,?,?,?,?)',[c.id,'test.pdf',content.length,content,new Date().toISOString()]);
    cfg.mail={enabled:true,host:'test.invalid',from:'hr@jrs.local'};let sends=0;
    const mailer=createMailer(repo,cfg,{sendMail:async data=>{sends++;assert.equal(data.attachments[0].filename,'test.pdf');return {accepted:[data.to],messageId:'integration-message'};}});
    d=await repo.snapshot(user.id);await mailer.send(msg.result.notification.id,user,d.revision,true);await mailer.send(msg.result.notification.id,user,d.revision,true);
    d=await repo.snapshot(user.id);assert.equal(sends,1);assert.equal(d.mailLogs.length,1);assert.equal(d.notifications.find(n=>n.id===msg.result.notification.id).status,'Sent');
    const [[attachment]]=await pool.query('SELECT filename,content FROM hr_notification_attachment');assert.equal(attachment.filename,'test.pdf');assert.ok(attachment.content.equals(content));
    // A failed handoff cannot create a successful-send log.
    const next=await service.execute('message',{applicationId:id,subject:'Timeout fixture',body:'No network is used.'},user,d.revision,randomUUID());d=await repo.snapshot(user.id);
    const broken=createMailer(repo,cfg,{sendMail:async()=>{throw Error('Simulated timeout');}});await assert.rejects(broken.send(next.result.notification.id,user,d.revision),e=>e.code==='MAIL_UNCERTAIN');
    d=await repo.snapshot(user.id);assert.equal(d.mailLogs.length,1);assert.equal(d.notifications.find(n=>n.id===next.result.notification.id).status,'Uncertain');
  } finally {
    if(pool)await pool.end();
    if(created){const {database:ignored,...settings}=cfg.db;let admin;try{admin=await mysql.createConnection(settings);await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);}finally{if(admin)await admin.end();}}
  }
});
