// Real foreign-key and transaction checks. This gate refuses remote/team settings.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,randomUUID}=require('node:crypto');
const mysql=require('mysql2/promise');
const {config}=require('../server/config.cjs');
const {initialize,seedDemo}=require('../scripts/database.cjs');
const {createRepository}=require('../server/repository.cjs');
const {createService}=require('../server/service.cjs');
const {runRetention,migrateRetention,assertRetentionSchema}=require('../server/retention.cjs');
const M=require('../dist/state.js');

test('real MySQL retention: all dependent data, rollback, shared profiles, sending lock, cache tombstone and migration',async()=>{
  const cfg=config();
  assert.ok(!cfg.team&&['127.0.0.1','localhost','::1'].includes(cfg.db.host),'Retention integration tests require an isolated local MySQL instance.');
  const database='jrs_hr_retention_'+randomBytes(6).toString('hex')+'_test';
  assert.match(database,/^jrs_hr_retention_[0-9a-f]{12}_test$/);cfg.db.database=database;
  const user={id:'retention-reviewer',name:'Retention QA',role:'HR_MANAGER'},at='2026-09-20T12:00:00.000Z',old='2020-09-20T12:00:00.000Z';
  let pool,created=false;
  try{
    created=true;await initialize(cfg,[{...user,email:'retention@jrs.local',password:'Retention-test-only-123',employeeId:'RETENTION-QA'}]);await seedDemo(cfg);
    pool=mysql.createPool(cfg.db);const repo=createRepository(pool),service=createService(repo);
    let db=await repo.snapshot(user.id);
    const offer=db.applications.find(a=>a.stage==='Offer'),rejected=db.applications.find(a=>a.stage==='Rejected');
    const shared=db.applications.find(a=>a.stage==='Rejected'&&a.id!==rejected.id);
    const active=db.applications.find(a=>a.stage==='Pending Review'&&a.jobId!==shared.jobId);
    const sending=db.applications.find(a=>a.stage==='Offer'&&a.id!==offer.id);
    const offerCandidate=offer.candidateId,rejectedCandidate=rejected.candidateId,sharedCandidate=active.candidateId;
    const key=randomUUID(),payload={applicationId:offer.id,subject:'Private retention subject',body:'PRIVATE-RETENTION-FIXTURE'};
    const message=await service.execute('message',payload,user,db.revision,key);
    const draftId=message.result.notification.id;
    const pdf=Buffer.from('%PDF-1.4\nRetention fixture\n%%EOF\n');
    await repo.transaction(async conn=>{
      const before=await repo.load(conn),after=M.clone(before);
      for(const id of [offer.id,rejected.id,shared.id,sending.id])after.applications.find(a=>a.id===id).retentionStartedAt=old;
      after.applications.find(a=>a.id===shared.id).candidateId=sharedCandidate;
      after.applications.find(a=>a.id===offer.id).notes.push({text:'PRIVATE-NOTE',actor:user.name,at:old});
      after.tasks.push({id:'retention-task',applicationId:offer.id,title:'Old task',assignee:user.name,due:'2020-09-21',notes:'PRIVATE-TASK',status:'Completed',createdAt:old});
      after.interviews.push({id:'retention-interview',applicationId:offer.id,date:'2020-09-19',time:'10:00',duration:30,format:'Phone',location:'Phone',interviewer:user.name,notes:'PRIVATE-INTERVIEW',status:'Completed',feedback:{rating:4,recommendation:'Proceed',notes:'PRIVATE-FEEDBACK',recordedAt:old}});
      const draft=after.notifications.find(n=>n.id===draftId);draft.status='Sent';
      after.notifications.push({id:'retention-sending',applicationId:sending.id,candidateId:sending.candidateId,to:'qa@jrs.local',subject:'Sending fixture',body:'Waiting',kind:'Message',status:'Sending',read:false,createdAt:at,sendingAt:at});
      after.mailLogs.push({id:'retention-log',draftId,applicationId:offer.id,candidateName:'Private Name',jobTitle:'Old job',to:'private@jrs.local',subject:payload.subject,body:payload.body,templateName:null,triggerEvent:'Message',sourceModule:'Applications',messageId:'retention-local-test',sentAt:old,actor:user.name});
      after.systemNotifications.push({id:'retention-system',applicationId:offer.id,title:'Old application',eventType:'Status Update',sourceModule:'Applications',createdAt:old});
      after.activity.push({id:'retention-audit',applicationId:offer.id,summary:'Private old audit',notes:'PRIVATE-AUDIT',from:null,to:null,actorId:user.id,actor:user.name,at:old,notificationId:draftId});
      after.revision++;after.updatedAt=at;await repo.save(conn,before,after);
      await conn.execute('INSERT INTO hr_notification_read(notification_id,user_id) VALUES (?,?)',['retention-system',user.id]);
      await conn.execute('INSERT INTO hr_notification_attachment(id,log_id,filename,content,size_bytes,mime_type) VALUES (?,?,?,?,?,?)',['retention-attachment','retention-log','old.pdf',pdf,pdf.length,'application/pdf']);
      for(const candidateId of [offerCandidate,rejectedCandidate,sharedCandidate])await conn.execute('INSERT INTO hr_resume(candidate_id,filename,size_bytes,content,uploaded_at) VALUES (?,?,?,?,?)',[candidateId,'resume.pdf',pdf.length,pdf,old]);
    },true);
    // Fail after SQL deletes: every table and request cache must roll back together.
    const before=await repo.snapshot(user.id);
    await assert.rejects(runRetention({...repo,save:async()=>{throw Error('Forced retention rollback');}},{now:at}),/Forced retention rollback/);
    assert.deepEqual(await repo.snapshot(user.id),before);
    const [[beforeAttachment]]=await pool.execute('SELECT content FROM hr_notification_attachment WHERE id=?',['retention-attachment']);assert.ok(beforeAttachment.content.equals(pdf));
    const [[cacheBefore]]=await pool.execute('SELECT result_json FROM hr_request WHERE id=?',[user.id+':'+key]);assert.ok(JSON.stringify(cacheBefore.result_json).includes('PRIVATE-RETENTION-FIXTURE'));

    const result=await runRetention(repo,{now:at});
    assert.equal(result.deletedApplications,3);assert.equal(result.deletedCandidates,2);assert.equal(result.deferred,1);assert.equal(result.redactedRequests,1);
    db=await repo.snapshot(user.id);M.validate(db);
    for(const id of [offer.id,rejected.id,shared.id])assert.ok(!db.applications.some(a=>a.id===id));
    assert.ok(db.applications.some(a=>a.id===sending.id));assert.ok(db.applications.some(a=>a.id===active.id));
    assert.ok(db.candidates.some(c=>c.id===sharedCandidate));assert.ok(!db.candidates.some(c=>[offerCandidate,rejectedCandidate].includes(c.id)));
    assert.equal(db.jobs.length,10);assert.equal(db.templates.length,5);
    for(const [table,column,id] of [['hr_application_note','application_id',offer.id],['hr_interview','id','retention-interview'],['hr_interview_feedback','id','retention-interview'],['hr_offer','id',offer.id],['hr_task','id','retention-task'],['hr_email_draft','id',draftId],['hr_audit_log','id','retention-audit'],['hr_system_notification','id','retention-system'],['hr_notification_read','notification_id','retention-system'],['hr_notification_log','id','retention-log'],['hr_notification_attachment','id','retention-attachment'],['hr_resume','candidate_id',offerCandidate]]){
      const [[row]]=await pool.execute(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column}=?`,[id]);assert.equal(row.total,0,table+' removed');
    }
    const [[resume]]=await pool.execute('SELECT content FROM hr_resume WHERE candidate_id=?',[sharedCandidate]);assert.ok(resume.content.equals(pdf));
    const [[cache]]=await pool.execute('SELECT result_json FROM hr_request WHERE id=?',[user.id+':'+key]);const tombstone=typeof cache.result_json==='string'?JSON.parse(cache.result_json):cache.result_json;assert.deepEqual(tombstone,{purged:true,revision:db.revision});
    await assert.rejects(service.execute('message',payload,user,db.revision,key),e=>e.status===410&&e.code==='RETENTION_EXPIRED');
    assert.equal((await runRetention(repo,{now:at})).deletedApplications,0);
    // Completing/reconciling the SMTP handoff releases the expired record.
    await pool.execute("UPDATE hr_email_draft SET status='Uncertain' WHERE id='retention-sending'");
    assert.equal((await runRetention(repo,{now:at})).deletedApplications,1);

    // Emulate the pre-change schema. Migration is additive and safe to repeat.
    await pool.query('ALTER TABLE hr_application DROP COLUMN retention_started_at');
    await assert.rejects(assertRetentionSchema(pool),/migration is required/);
    const conn=await pool.getConnection();
    try{
      const first=await migrateRetention(conn);assert.equal(first.addedColumn,true);assert.ok(first.backfilled>0);
      const second=await migrateRetention(conn);assert.deepEqual(second,{addedColumn:false,backfilled:0});
    }finally{conn.release();}
    await assertRetentionSchema(pool);M.validate(await repo.snapshot(user.id));
  }finally{
    if(pool)await pool.end();
    if(created){const {database:ignored,...settings}=cfg.db;const admin=await mysql.createConnection(settings);try{await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);}finally{await admin.end();}}
  }
});
