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
    // Upgrade one unchanged legacy posting in this disposable database only.
    const seededJobs=M.clone(d.jobs),revisionBeforeUpgrade=d.revision;
    const legacyRequirements=['Experience with Java or Spring Boot','Frontend experience with React','SQL database and REST API knowledge','Docker or cloud deployment experience'];
    await pool.execute('UPDATE hr_job_position SET requirements=? WHERE id=?',[JSON.stringify(legacyRequirements),'job-0']);
    d=await repo.snapshot(user.id);const legacySnapshot=JSON.stringify(d);
    const {upgradeDemoRequirements}=require('../scripts/upgrade-demo-requirements.cjs');
    const preview=await upgradeDemoRequirements(cfg,{dryRun:true});
    assert.equal(preview.count,1);assert.deepEqual(preview.updatedIds,['job-0']);
    assert.equal(preview.revisionAfter,revisionBeforeUpgrade);
    assert.equal(JSON.stringify(await repo.snapshot(user.id)),legacySnapshot,'Preview cannot save requirements, audit or revision changes');
    const upgrade=await upgradeDemoRequirements(cfg);
    assert.equal(upgrade.count,1);assert.equal(upgrade.revisionBefore,revisionBeforeUpgrade);assert.equal(upgrade.revisionAfter,revisionBeforeUpgrade+1);
    d=await repo.snapshot(user.id);assert.equal(d.revision,revisionBeforeUpgrade+1);
    assert.deepEqual(d.jobs,seededJobs,'The upgrade must restore all ten requirements without altering any other job fields');
    const upgradedSnapshot=JSON.stringify(d),repeated=await upgradeDemoRequirements(cfg);
    assert.equal(repeated.count,0);assert.equal(repeated.revisionAfter,d.revision);
    assert.equal(JSON.stringify(await repo.snapshot(user.id)),upgradedSnapshot,'Repeating the upgrade cannot create changes or another audit event');
    d=await repo.snapshot(user.id);
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
    d=await repo.snapshot(user.id);const editedCandidate=d.candidates.find(x=>x.id===c.id);assert.equal(editedCandidate.name,"O'Connor");for(const field of ['educationLevel','educationMajor','graduationDate'])assert.deepEqual(editedCandidate[field],c[field],'Old clients preserve '+field);
    const contactSnapshot=JSON.stringify(d);
    await assert.rejects(service.execute('candidate-save',{id:c.id,name:'Cannot save',email:editedCandidate.email,phone:c.phone,location:c.location,experience:c.experience,skills:c.skills.join(', '),graduationDate:null},user,d.revision,randomUUID()),e=>e.status===422&&/read-only/i.test(e.message));
    assert.equal(JSON.stringify(await repo.snapshot(user.id)),contactSnapshot,'A direct education edit rolls back all contact, education, audit and revision changes');
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
    // Legacy academic facts round-trip, but HR can review applications without them.
    const pending=d.applications.find(a=>a.stage==='Pending Review'),job=d.jobs.find(j=>j.id===pending.jobId);
    await service.execute('job-save',{...job,skills:job.skills.join(', '),requirements:job.requirements.join('\n'),minimumEducationLevel:'Bachelor degree',acceptedMajors:['Computer Science']},user,d.revision,randomUUID());
    d=await repo.snapshot(user.id);assert.equal(d.jobs.find(j=>j.id===job.id).minimumEducationLevel,'Bachelor degree');assert.deepEqual(d.jobs.find(j=>j.id===job.id).acceptedMajors,['Computer Science']);
    const currentYear=Number(M.day().slice(0,4)),historical=String(currentYear-2)+'-06-15';let screeningCase=0;
    for(const facts of [
      {educationLevel:'Bachelor degree',educationMajor:'Computer Science',graduationDate:currentYear+'-01-01'},
      {educationLevel:'Diploma',educationMajor:'Computer Science',graduationDate:historical},
      {educationLevel:'Bachelor degree',educationMajor:'Accounting',graduationDate:historical},
      {educationLevel:'Bachelor degree',educationMajor:'Computer Science',graduationDate:null}
    ]){
      screeningCase++;
      const received=await service.execute('application-create',{jobId:job.id,candidate:{name:'Screening fixture '+screeningCase,email:'screening-'+screeningCase+'@jrs.local',phone:'123456789',location:'Singapore',experience:10,skills:'JavaScript, SQL',graduateStatus:'Experienced',...facts}},user,d.revision,randomUUID());
      const application=received.result.application;
      d=await repo.snapshot(user.id);const saved=d.candidates.find(c=>c.id===application.candidateId);
      for(const [field,value] of Object.entries(facts))assert.equal(saved[field],value,field+' must retain its exact value after SQL reload');
      const unchanged=JSON.stringify(d);
      await service.execute('move-interview',{applicationId:application.id},user,d.revision,randomUUID());
      d=await repo.snapshot(user.id);assert.equal(d.applications.find(a=>a.id===application.id).stage,'Interview');assert.deepEqual(d.candidates.find(c=>c.id===saved.id),saved,'HR progression never rewrites academic facts');
    }
    // Simulate an old schema in this disposable database, then upgrade twice without guessing facts.
    const preserved=M.clone(d),candidateFields=['graduateStatus','educationLevel','educationMajor','graduationDate'],jobFields=['minimumEducationLevel','acceptedMajors'];
    const stripScreening=db=>{for(const c of db.candidates)for(const key of candidateFields)delete c[key];for(const j of db.jobs)for(const key of jobFields)delete j[key];return db;};
    const [checks]=await pool.query("SELECT tc.TABLE_NAME,cc.CONSTRAINT_NAME FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME WHERE cc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME IN ('hr_candidate','hr_job_position') AND (cc.CHECK_CLAUSE LIKE '%graduate_status%' OR cc.CHECK_CLAUSE LIKE '%education_level%' OR cc.CHECK_CLAUSE LIKE '%graduation_date%' OR cc.CHECK_CLAUSE LIKE '%accepted_majors%')");
    for(const row of checks)await pool.query('ALTER TABLE `'+row.TABLE_NAME+'` DROP CHECK `'+row.CONSTRAINT_NAME+'`');
    await pool.query('ALTER TABLE hr_candidate DROP COLUMN graduate_status, DROP COLUMN education_level, DROP COLUMN education_major, DROP COLUMN graduation_date');
    await pool.query('ALTER TABLE hr_job_position DROP COLUMN minimum_education_level, DROP COLUMN accepted_majors');
    const {migrateEligibility,assertEligibilitySchema}=require('../server/eligibility-schema.cjs');
    await assert.rejects(assertEligibilitySchema(pool),/missing|schema|migration|screening/i);
    await migrateEligibility(pool);const once=await repo.snapshot(user.id);await migrateEligibility(pool);await assertEligibilitySchema(pool);
    const upgraded=await repo.snapshot(user.id);assert.deepEqual(upgraded,once,'Repeating the migration cannot update facts or revision');
    const expectedUnrelated=stripScreening(preserved),actualUnrelated=stripScreening(M.clone(upgraded));
    assert.equal(actualUnrelated.revision,expectedUnrelated.revision+1);delete actualUnrelated.revision;delete expectedUnrelated.revision;delete actualUnrelated.updatedAt;delete expectedUnrelated.updatedAt;
    assert.deepEqual(actualUnrelated,expectedUnrelated,'Schema upgrade preserves every unrelated record and field');
    const S=M.screening;
    for(const c of upgraded.candidates){const inferred=S.inferLegacyEducation(c.education);assert.equal(c.educationLevel,inferred.educationLevel);assert.equal(c.educationMajor,inferred.educationMajor);assert.equal(c.graduationDate,null,'A schema migration must never invent a graduation date');}
    for(const j of upgraded.jobs){const expected=j.education==='Diploma or Degree'?S.defaultJobCriteria(j.title):{minimumEducationLevel:'Not configured',acceptedMajors:[]};assert.equal(j.minimumEducationLevel,expected.minimumEducationLevel);assert.deepEqual(j.acceptedMajors,expected.acceptedMajors);}
    await service.execute('move-interview',{applicationId:pending.id},user,upgraded.revision,randomUUID());const reviewed=await repo.snapshot(user.id);assert.equal(reviewed.applications.find(a=>a.id===pending.id).stage,'Interview');assert.equal(reviewed.candidates.find(c=>c.id===pending.candidateId).graduationDate,null);
  } finally {
    if(pool)await pool.end();
    if(created){const {database:ignored,...settings}=cfg.db;let admin;try{admin=await mysql.createConnection(settings);await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);}finally{if(admin)await admin.end();}}
  }
});
