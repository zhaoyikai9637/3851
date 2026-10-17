'use strict';
const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const M=require('../dist/state.js');
const R=require('../server/retention.cjs');
const {createRepository,maps,flatten}=require('../server/repository.cjs');
const {applyCommand,createService}=require('../server/service.cjs');
const {hash}=require('../server/auth.cjs');
const user={id:'manager',name:'Test Manager',role:'HR_MANAGER'};
const NOW='2026-09-20T04:30:00.000Z',START='2021-09-20T04:30:00.000Z';

function fixture(){
  const d={...M.seed(),templates:[],systemNotifications:[],mailLogs:[]};
  d.applications=d.applications.slice(0,4);d.interviews=[];
  d.candidates=d.candidates.slice(0,4);d.jobs=d.jobs.slice(0,4);
  const [a,b,c,active]=d.applications;a.stage='Rejected';a.retentionStartedAt=START;a.rejectionConfirmed=true;
  b.retentionStartedAt=null;c.retentionStartedAt=START;active.candidateId=c.candidateId;
  a.notes=[{text:'Expired private note',actor:'HR',at:START}];
  d.interviews=[{id:'old-interview',applicationId:a.id,date:'2021-09-01',time:'10:00',duration:45,format:'Video',location:'Link',interviewer:'HR',notes:'Private',status:'Completed',feedback:{rating:3,recommendation:'Reject',notes:'Private feedback',recordedAt:START}}];
  d.tasks=[{id:'old-task',applicationId:a.id,title:'Private task',assignee:'HR',due:'2021-09-01',notes:'Private',status:'Completed',createdAt:START}];
  d.notifications=[a,c,active].map((x,i)=>({id:'draft-'+i,applicationId:x.id,candidateId:x.candidateId,to:d.candidates.find(v=>v.id===x.candidateId).email,subject:'Private subject '+i,body:'Private body '+i,kind:'Message',status:'Sent',read:false,createdAt:START}));
  d.mailLogs=d.notifications.map((n,i)=>({id:'mail-'+i,draftId:n.id,applicationId:n.applicationId,candidateName:'Recipient '+i,jobTitle:'Position',to:n.to,subject:n.subject,body:n.body,triggerEvent:'Message',sourceModule:'Applications',messageId:'msg-'+i,sentAt:START,actor:'HR'}));
  d.activity=[{id:'audit-old',applicationId:a.id,summary:'Private audit',notes:'Private',actor:'HR',at:START,notificationId:d.notifications[0].id},{id:'audit-reference',applicationId:null,summary:'Private draft audit',notes:'Private',actor:'HR',at:START,notificationId:d.notifications[1].id}];
  d.systemNotifications=[a,active].map((x,i)=>({id:'system-'+i,applicationId:x.id,title:'Private update '+i,eventType:'Status Update',sourceModule:'Applications',createdAt:START}));
  M.validate(d);return d;
}

// A transactional SQL double executes the production repository and purge SQL.
// It enforces each FK after EVERY delete, so wrong child/parent order fails.
function sqlDatabase(db,{failOn}={}){
  const flat=flatten(db),tables={hr_workspace:[{id:1,revision:db.revision,created_at:db.createdAt,updated_at:db.updatedAt||db.createdAt}],hr_user:[{id:user.id}],hr_request:[]};
  for(const map of maps)tables[map.table]=(flat[map.key]||[]).map(row=>Object.fromEntries(map.fields.map(f=>[f.col,row[f.prop]??null])));
  tables.hr_resume=db.candidates.map(c=>({candidate_id:c.id,filename:'resume.pdf',content:'PDF PRIVATE',size_bytes:11,uploaded_at:START}));
  tables.hr_notification_read=db.systemNotifications.map(n=>({notification_id:n.id,user_id:user.id}));
  tables.hr_notification_attachment=db.mailLogs.map(n=>({id:'attachment-'+n.id,log_id:n.id,content:'PDF PRIVATE',filename:'attached.pdf'}));
  const foreignKeys=[['hr_application','candidate_id','hr_candidate'],['hr_application','job_id','hr_job_position'],['hr_application_note','application_id','hr_application'],['hr_interview','application_id','hr_application'],['hr_interview_feedback','id','hr_interview'],['hr_offer','id','hr_application'],['hr_task','application_id','hr_application'],['hr_email_draft','application_id','hr_application'],['hr_email_draft','template_id','hr_email_template'],['hr_audit_log','application_id','hr_application'],['hr_audit_log','notification_id','hr_email_draft'],['hr_system_notification','application_id','hr_application'],['hr_notification_read','notification_id','hr_system_notification'],['hr_notification_log','draft_id','hr_email_draft'],['hr_notification_log','application_id','hr_application'],['hr_resume','candidate_id','hr_candidate'],['hr_notification_attachment','log_id','hr_notification_log']];
  function check(){for(const [table,column,parent] of foreignKeys)for(const row of tables[table])if(row[column]!=null)assert.ok(tables[parent].some(p=>p.id===row[column]),`${table}.${column} has an orphan in ${parent}`);}
  let queue=Promise.resolve(),commits=0,rollbacks=0;const statements=[];
  async function getConnection(){let saved,releaseLock;
    async function query(sql,p=[]){statements.push(sql);
      if(sql.startsWith('SET TRANSACTION'))return [[]];
      if(sql.includes('FOR UPDATE')){const previous=queue;queue=new Promise(r=>releaseLock=r);await previous;saved=M.clone(tables);return [[{revision:tables.hr_workspace[0].revision}]];}
      if(sql.startsWith('SELECT')){
        const table=sql.match(/ FROM (hr_\w+)/)?.[1];if(!table)throw Error('Unsupported SELECT '+sql);
        if(sql.startsWith('SELECT request_hash'))return [M.clone(tables.hr_request.filter(r=>r.id===p[0]))];
        return [M.clone(tables[table])];
      }
      return execute(sql,p);
    }
    async function execute(sql,p=[]){if(sql.startsWith('SELECT'))return query(sql,p);statements.push(sql);if(failOn&&sql.includes(failOn))throw Error('Injected database failure');
      if(sql.startsWith('UPDATE hr_request')){tables.hr_request.find(r=>r.id===p[1]).result_json=p[0];return [{affectedRows:1}];}
      if(sql.startsWith('UPDATE hr_workspace')){tables.hr_workspace[0].revision=p[0];tables.hr_workspace[0].updated_at=p[1];return [{}];}
      if(sql.startsWith('UPDATE hr_application')){const map=maps.find(m=>m.table==='hr_application'),row=tables.hr_application.find(r=>r.id===p.at(-1));map.fields.slice(1).forEach((f,i)=>row[f.col]=p[i]);return [{}];}
      if(sql.startsWith('DELETE')){
        const table=sql.match(/FROM (hr_\w+)/)[1],ids=new Set(p),byApplication=(table,id)=>tables[table].find(r=>r.id===id)?.application_id;
        const predicate={
          hr_notification_read:r=>ids.has(byApplication('hr_system_notification',r.notification_id)),
          hr_notification_attachment:r=>ids.has(byApplication('hr_notification_log',r.log_id)),
          hr_audit_log:r=>ids.has(r.application_id)||ids.has(byApplication('hr_email_draft',r.notification_id)),
          hr_interview_feedback:r=>ids.has(byApplication('hr_interview',r.id)),
          hr_offer:r=>ids.has(r.id),hr_application:r=>ids.has(r.id),
          hr_resume:r=>ids.has(r.candidate_id)&&!tables.hr_application.some(a=>a.candidate_id===r.candidate_id),
          hr_candidate:r=>ids.has(r.id)&&!tables.hr_application.some(a=>a.candidate_id===r.id)
        }[table]||((r)=>ids.has(r.application_id));
        tables[table]=tables[table].filter(r=>!predicate(r));check();return [{}];
      }
      throw Error('Unsupported SQL '+sql);
    }
    return {query,execute,beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;if(saved){for(const k of Object.keys(tables))delete tables[k];Object.assign(tables,saved);}},release:()=>releaseLock?.()};
  }
  check();const repo=createRepository({getConnection});
  return {repo,tables,statements,get commits(){return commits;},get rollbacks(){return rollbacks;}};
}

test('retention expires at the exact five-calendar-year boundary, including leap days',()=>{
  assert.equal(R.expiresAt(START),NOW);
  assert.equal(R.expiresAt('2020-02-29T14:15:16.123Z'),'2025-02-28T14:15:16.123Z');
  assert.equal(R.expiresAt('2021-09-20T12:30:00+08:00'),NOW);
  const d=fixture();assert.equal(R.expiryPlan(d,new Date(Date.parse(NOW)-1)).applicationIds.length,0);
  assert.equal(R.expiryPlan(d,NOW).applicationIds.length,2);
  assert.throws(()=>R.expiresAt('bad date'),/Invalid/);
  assert.throws(()=>R.expiresAt('2020-02-30T00:00:00Z'),/Invalid/);
  assert.throws(()=>R.expiresAt('2020-12-31T24:00:00Z'),/Invalid/);
});

test('only current Offer/Rejected applications expire and an SMTP handoff defers cleanup',()=>{
  const d=fixture();d.applications[1].stage='Hired';d.applications[1].retentionStartedAt='2000-01-01T00:00:00Z';
  d.notifications[0].status='Sending';const plan=R.expiryPlan(d,NOW);
  assert.deepEqual(plan.applicationIds,[d.applications[2].id]);assert.equal(plan.deferred,1);assert.deepEqual(plan.candidateIds,[]);
  d.notifications[0].status='Uncertain';assert.equal(R.expiryPlan(d,NOW).applicationIds.length,2);
});

test('entering a retained stage starts its clock; edits do not extend it; leaving clears it',()=>{
  const d={...M.seed(),templates:[],systemNotifications:[],mailLogs:[]};
  const a=d.applications.find(a=>a.stage==='Interview Results');
  const payload={applicationId:a.id,salary:5000,startDate:M.day(30),expiry:M.day(7),terms:'Employment terms'};
  applyCommand(d,'offer',payload,user);assert.ok(a.retentionStartedAt);const started=a.retentionStartedAt;
  a.retentionStartedAt=START;a.offer.createdAt=START;
  applyCommand(d,'offer',{...payload,salary:6000},user);assert.equal(a.retentionStartedAt,START);assert.equal(a.offer.createdAt,START);
  applyCommand(d,'approve-offer',{applicationId:a.id},user);assert.equal(a.retentionStartedAt,START);
  applyCommand(d,'accept-offer',{applicationId:a.id,notes:'Accepted by candidate'},user);assert.equal(a.retentionStartedAt,null);
  const b=d.applications.find(a=>a.stage==='Offer');b.retentionStartedAt=START;
  applyCommand(d,'reject',{applicationId:b.id,reason:'Offer declined'},user);assert.notEqual(b.retentionStartedAt,START);assert.ok(b.retentionStartedAt>=started);
  const rejected=b.retentionStartedAt;applyCommand(d,'confirm-rejection',{applicationId:b.id,reason:'Confirmed'},user);assert.equal(b.retentionStartedAt,rejected);
});

test('legacy dates prefer the current stage entry and never substitute migration time',()=>{
  const a={id:'a',stage:'Offer',appliedDate:'2018-01-02',createdAt:'2018-01-02T03:00:00Z',offer:{createdAt:'2026-08-01T00:00:00Z'}};
  assert.equal(R.inferRetentionStart(a,[{applicationId:'a',from:'Interview Results',to:'Offer',at:START},{applicationId:'a',from:'Offer',to:'Offer',at:NOW}]),START);
  assert.equal(R.inferRetentionStart(a,[]),'2018-01-01T16:00:00.000Z');
  assert.equal(R.inferRetentionStart({...a,stage:'Pending Review'},[]),null);
  assert.throws(()=>R.inferRetentionStart({id:'x',stage:'Rejected'},[]),/Cannot determine/);
});

test('cleanup removes every dependent row, redacts cached PII, keeps shared candidate/resume and other work',async()=>{
  const d=fixture(),sql=sqlDatabase(d),old=d.applications[0],shared=d.applications[2].candidateId;
  sql.tables.hr_request=[{id:'expired-request',result_json:{result:{application:M.clone(old)}},request_hash:'keep-me'},{id:'active-request',result_json:{result:{application:M.clone(d.applications[3])}},request_hash:'active'}];
  const result=await R.runRetention(sql.repo,{now:NOW});assert.equal(result.deletedApplications,2);assert.equal(result.deletedCandidates,1);assert.equal(result.redactedRequests,1);
  const after=await sql.repo.transaction(c=>sql.repo.load(c));assert.equal(after.applications.length,2);assert.equal(after.revision,d.revision+1);M.validate(after);
  assert.ok(!after.candidates.some(c=>c.id===old.candidateId));assert.ok(after.candidates.some(c=>c.id===shared));
  assert.equal(sql.tables.hr_resume.length,3);assert.ok(sql.tables.hr_resume.some(r=>r.candidate_id===shared));
  for(const table of ['hr_application_note','hr_interview','hr_interview_feedback','hr_offer','hr_task','hr_audit_log'])assert.equal(sql.tables[table].length,0,table);
  for(const table of ['hr_email_draft','hr_notification_log','hr_notification_attachment','hr_system_notification','hr_notification_read'])assert.equal(sql.tables[table].length,1,table);
  assert.deepEqual(JSON.parse(sql.tables.hr_request[0].result_json),{purged:true,revision:1});assert.equal(sql.tables.hr_request[0].request_hash,'keep-me');
  assert.ok(sql.tables.hr_request[1].result_json.result.application);assert.equal(sql.tables.hr_job_position.length,4);assert.equal(sql.tables.hr_user.length,1);
  assert.equal((await R.runRetention(sql.repo,{now:NOW})).deletedApplications,0);
});

test('any failed child/parent delete rolls back the entire purge, revision and cached-result redaction',async()=>{
  const sql=sqlDatabase(fixture(),{failOn:'DELETE FROM hr_application WHERE'});
  sql.tables.hr_request=[{id:'private',result_json:{result:{applicationId:fixture().applications[0].id}}}];
  const before=M.clone(sql.tables);await assert.rejects(R.runRetention(sql.repo,{now:NOW}),/Injected database failure/);
  assert.deepEqual(sql.tables,before);assert.equal(sql.rollbacks,1);assert.equal(sql.commits,0);
});

test('concurrent cleanup runs serialize and delete once; stale edits and purged retries fail safely',async()=>{
  const d=fixture(),sql=sqlDatabase(d),service=createService(sql.repo),command='reject',p={applicationId:d.applications[0].id,reason:'Old reason'},key='aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb';
  sql.tables.hr_request=[{id:user.id+':'+key,request_hash:hash(JSON.stringify({command,p})),result_json:{result:{activity:{id:'act',applicationId:p.applicationId}}}}];
  const results=await Promise.all([R.runRetention(sql.repo,{now:NOW}),R.runRetention(sql.repo,{now:NOW})]);assert.deepEqual(results.map(r=>r.deletedApplications).sort(),[0,2]);
  await assert.rejects(service.execute(command,p,user,d.revision,key),e=>e.status===410&&e.code==='RETENTION_EXPIRED');
  await assert.rejects(service.execute('move-interview',{applicationId:d.applications[3].id},user,d.revision,'bbbbaaaa-dddd-cccc-eeee-aaaabbbbffff'),e=>e.code==='REVISION_CONFLICT');
});

test('startup schema preflight is read-only and gives the shared schema coordinator an actionable error',async()=>{
  const queries=[];await R.assertRetentionSchema({query:async s=>{queries.push(s);return [[]];}});assert.deepEqual(queries,['SELECT retention_started_at FROM hr_application LIMIT 0']);
  await assert.rejects(R.assertRetentionSchema({query:async()=>{throw Object.assign(Error('column absent'),{code:'ER_BAD_FIELD_ERROR'});}}),/schema coordinator.*db:migrate/);
});
