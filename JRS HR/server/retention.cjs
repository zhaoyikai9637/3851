'use strict';
const M=require('../dist/state.js');
const RETAINED_STAGES=new Set(['Offer','Rejected']);
const RETENTION_YEARS=5;

function validInstant(value) {
  if(typeof value!=='string')return null;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);if(!match)return null;
  const [,year,month,date,hour,minute,second]=match.map(Number);
  const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  if(month<1||month>12||date<1||date>lastDay||hour>23||minute>59||second>59)return null;
  const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
// Calendar years, not 365-day years. A leap-day anniversary falls on February 28.
function expiresAt(start) {
  const valid=validInstant(start);if(!valid)throw Error('Invalid application retention start.');
  const d=new Date(valid),month=d.getUTCMonth(),date=d.getUTCDate();
  d.setUTCDate(1);d.setUTCFullYear(d.getUTCFullYear()+RETENTION_YEARS);
  const lastDay=new Date(Date.UTC(d.getUTCFullYear(),month+1,0)).getUTCDate();
  d.setUTCDate(Math.min(date,lastDay));return d.toISOString();
}
function inferRetentionStart(application,activity=[]) {
  if(!RETAINED_STAGES.has(application.stage))return null;
  if(application.retentionStartedAt){const date=validInstant(application.retentionStartedAt);if(!date)throw Error('Invalid stored retention date; repair it before starting HR.');return date;}
  const entries=activity.filter(e=>e.applicationId===application.id&&e.to===application.stage&&e.from!==e.to).map(e=>validInstant(e.at)).filter(Boolean).sort();
  if(entries.length)return entries.at(-1);
  // Legacy offer.createdAt could be overwritten by an offer edit. Without an
  // entry audit, choose the earliest known date rather than restart/extend time.
  const dates=[validInstant(application.offer?.createdAt),validInstant(application.createdAt)];
  const applied=application.appliedDate;
  if(typeof applied==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(applied))dates.push(validInstant(applied+'T00:00:00+08:00'));
  const known=dates.filter(Boolean).sort();
  if(!known.length)throw Error('Cannot determine an application retention date; repair its dates before starting HR.');
  return known[0];
}
function backfillRetention(db) {
  const changed=[];
  for(const a of db.applications){const start=inferRetentionStart(a,db.activity);if((a.retentionStartedAt??null)!==start){a.retentionStartedAt=start;changed.push(a);}}
  return changed;
}
function expiryPlan(db,now=new Date()) {
  const at=new Date(now).getTime();if(!Number.isFinite(at))throw Error('Invalid retention cleanup time.');
  const due=db.applications.filter(a=>RETAINED_STAGES.has(a.stage)&&Date.parse(expiresAt(inferRetentionStart(a,db.activity)))<=at);
  const sending=new Set(db.notifications.filter(n=>n.status==='Sending').map(n=>n.applicationId));
  const expired=due.filter(a=>!sending.has(a.id)),ids=new Set(expired.map(a=>a.id));
  const affectedCandidates=new Set(expired.map(a=>a.candidateId));
  const candidateIds=[...affectedCandidates].filter(id=>!db.applications.some(a=>a.candidateId===id&&!ids.has(a.id)));
  return {applicationIds:[...ids],candidateIds,deferred:due.length-expired.length};
}
function withoutExpired(db,plan) {
  const after=M.clone(db),ids=new Set(plan.applicationIds),candidateIds=new Set(plan.candidateIds);
  const draftIds=new Set(db.notifications.filter(n=>ids.has(n.applicationId)).map(n=>n.id));
  after.applications=after.applications.filter(a=>!ids.has(a.id));
  after.candidates=after.candidates.filter(c=>!candidateIds.has(c.id));
  for(const key of ['interviews','tasks','notifications','systemNotifications','mailLogs'])after[key]=(after[key]||[]).filter(row=>!ids.has(row.applicationId));
  after.activity=after.activity.filter(row=>!ids.has(row.applicationId)&&!draftIds.has(row.notificationId));
  M.validate(after);return after;
}
function deletedReferences(before,after) {
  const ids=new Set();
  for(const key of ['applications','candidates','interviews','tasks','notifications','systemNotifications','mailLogs','activity']){
    const keep=new Set((after[key]||[]).map(row=>row.id));for(const row of before[key]||[])if(!keep.has(row.id))ids.add(row.id);
  }
  return ids;
}
function containsReference(value,ids) {
  if(typeof value==='string')return ids.has(value);
  if(Array.isArray(value))return value.some(v=>containsReference(v,ids));
  if(value&&typeof value==='object')return Object.values(value).some(v=>containsReference(v,ids));
  return false;
}
async function redactRequests(conn,ids,revision) {
  const [requests]=await conn.query('SELECT id,result_json FROM hr_request');let count=0;
  for(const row of requests){const result=typeof row.result_json==='string'?JSON.parse(row.result_json):row.result_json;if(containsReference(result,ids)){
    // Keep the key/hash as a tombstone, so a retry cannot recreate a purged record.
    await conn.execute('UPDATE hr_request SET result_json=? WHERE id=?',[JSON.stringify({purged:true,revision}),row.id]);count++;
  }}return count;
}
async function deleteRelations(conn,applicationIds,candidateIds) {
  const marks=applicationIds.map(()=>'?').join(',');
  // Child-first deletes; all statements share the workspace write transaction.
  const statements=[
    `DELETE r FROM hr_notification_read r JOIN hr_system_notification n ON n.id=r.notification_id WHERE n.application_id IN (${marks})`,
    `DELETE t FROM hr_notification_attachment t JOIN hr_notification_log l ON l.id=t.log_id WHERE l.application_id IN (${marks})`,
    `DELETE FROM hr_notification_log WHERE application_id IN (${marks})`,
    `DELETE l FROM hr_audit_log l LEFT JOIN hr_email_draft d ON d.id=l.notification_id WHERE l.application_id IN (${marks}) OR d.application_id IN (${marks})`,
    `DELETE FROM hr_system_notification WHERE application_id IN (${marks})`,
    `DELETE FROM hr_email_draft WHERE application_id IN (${marks})`,
    `DELETE f FROM hr_interview_feedback f JOIN hr_interview i ON i.id=f.id WHERE i.application_id IN (${marks})`,
    `DELETE FROM hr_interview WHERE application_id IN (${marks})`,
    `DELETE FROM hr_application_note WHERE application_id IN (${marks})`,
    `DELETE FROM hr_task WHERE application_id IN (${marks})`,
    `DELETE FROM hr_offer WHERE id IN (${marks})`,
    `DELETE FROM hr_application WHERE id IN (${marks})`
  ];
  for(const sql of statements)await conn.execute(sql,sql.includes(' OR d.application_id')?[...applicationIds,...applicationIds]:applicationIds);
  if(candidateIds.length){const cmarks=candidateIds.map(()=>'?').join(',');
    await conn.execute(`DELETE r FROM hr_resume r WHERE r.candidate_id IN (${cmarks}) AND NOT EXISTS (SELECT 1 FROM hr_application a WHERE a.candidate_id=r.candidate_id)`,candidateIds);
    await conn.execute(`DELETE c FROM hr_candidate c WHERE c.id IN (${cmarks}) AND NOT EXISTS (SELECT 1 FROM hr_application a WHERE a.candidate_id=c.id)`,candidateIds);
  }
}
async function runRetention(repo,{now=new Date()}={}) {
  return repo.transaction(async conn=>{
    const before=await repo.load(conn),dated=M.clone(before),backfilled=backfillRetention(dated),plan=expiryPlan(dated,now);
    const summary={deletedApplications:plan.applicationIds.length,deletedCandidates:plan.candidateIds.length,deferred:plan.deferred,backfilled:backfilled.length,redactedRequests:0};
    if(!plan.applicationIds.length&&!backfilled.length)return summary;
    const after=withoutExpired(dated,plan);after.revision++;after.updatedAt=new Date(now).toISOString();
    if(plan.applicationIds.length){
      summary.redactedRequests=await redactRequests(conn,deletedReferences(before,after),after.revision);
      await deleteRelations(conn,plan.applicationIds,plan.candidateIds);
    }
    await repo.save(conn,before,after);return summary;
  },true);
}
async function assertRetentionSchema(conn) {
  try{await conn.query('SELECT retention_started_at FROM hr_application LIMIT 0');}
  catch(error){if(error.code==='ER_BAD_FIELD_ERROR')throw Error('HR database migration is required. Ask the schema coordinator to run npm run db:migrate, then restart HR.');throw error;}
}
// Explicit schema-coordinator operation only. Never called automatically at startup.
// Pass a dedicated connection (not a pool or an already-open transaction).
async function migrateRetention(conn) {
  const [columns]=await conn.query("SHOW COLUMNS FROM hr_application LIKE 'retention_started_at'");
  if(!columns.length){try{await conn.query('ALTER TABLE hr_application ADD COLUMN retention_started_at VARCHAR(30) NULL');}catch(e){if(e.code!=='ER_DUP_FIELDNAME')throw e;}}
  await conn.beginTransaction();
  try{
    await conn.query('SELECT revision FROM hr_workspace WHERE id=1 FOR UPDATE');
    const [rows]=await conn.query('SELECT id,stage,applied_date,created_at,retention_started_at FROM hr_application');
    const [events]=await conn.query('SELECT application_id,from_stage,to_stage,at_time FROM hr_audit_log');
    const [offers]=await conn.query('SELECT id,created_at FROM hr_offer');
    const db={applications:rows.map(a=>({id:a.id,stage:a.stage,appliedDate:a.applied_date instanceof Date?a.applied_date.toISOString().slice(0,10):a.applied_date,createdAt:a.created_at,retentionStartedAt:a.retention_started_at,offer:{createdAt:offers.find(o=>o.id===a.id)?.created_at}})),activity:events.map(e=>({applicationId:e.application_id,from:e.from_stage,to:e.to_stage,at:e.at_time}))};
    const changed=backfillRetention(db);
    for(const a of changed)await conn.execute('UPDATE hr_application SET retention_started_at=? WHERE id=?',[a.retentionStartedAt,a.id]);
    if(changed.length)await conn.execute('UPDATE hr_workspace SET revision=revision+1,updated_at=? WHERE id=1',[new Date().toISOString()]);
    await conn.commit();return {addedColumn:!columns.length,backfilled:changed.length};
  }catch(error){await conn.rollback();throw error;}
}
module.exports={RETENTION_YEARS,RETAINED_STAGES,expiresAt,inferRetentionStart,backfillRetention,expiryPlan,withoutExpired,containsReference,runRetention,assertRetentionSchema,migrateRetention};
