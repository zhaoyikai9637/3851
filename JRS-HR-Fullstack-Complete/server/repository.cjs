'use strict';
const {fail} = require('./errors.cjs');
const M = require('../dist/state.js');
// Explicit mappings are the only SQL identifiers accepted by this repository.
// Array-valued skills/requirements use JSON; entities and relations use real tables/FKs.
const maps = [
 ['jobs','hr_job_position','id title department type:employment_type location mode:work_mode experience education status description skills:skills:json requirements:requirements:json createdAt:created_at'],
 ['candidates','hr_candidate','id name email phone location experience education skills:skills:json notes createdAt:created_at'],
 ['applications','hr_application','id candidateId:candidate_id jobId:job_id stage appliedDate:applied_date priority rejectionReason:rejection_reason rejectionConfirmed:rejection_confirmed:bool createdAt:created_at'],
 ['interviews','hr_interview','id applicationId:application_id date:interview_date time:interview_time:time duration format location interviewer notes status'],
 ['feedbackRows','hr_interview_feedback','id rating recommendation notes recordedAt:recorded_at'],
 ['offerRows','hr_offer','id salary currency startDate:start_date expiry approval status terms createdAt:created_at'],
 ['noteRows','hr_application_note','id applicationId:application_id text:body actor at:at_time sequence:sequence_no'],
 ['tasks','hr_task','id applicationId:application_id title assignee due notes status createdAt:created_at'],
 ['templates','hr_email_template','id name kind subject body active:active:bool updatedAt:updated_at'],
 ['notifications','hr_email_draft','id applicationId:application_id to:recipient subject body kind status read:is_read:bool templateId:template_id templateName:template_name createdAt:created_at sendingAt:sending_at lastError:last_error'],
 ['activity','hr_audit_log','id applicationId:application_id summary notes from:from_stage to:to_stage actorId:actor_id actor at:at_time notificationId:notification_id'],
 ['systemNotifications','hr_system_notification','id applicationId:application_id title eventType:event_type sourceModule:source_module createdAt:created_at'],
 ['mailLogs','hr_notification_log','id draftId:draft_id applicationId:application_id candidateName:candidate_name jobTitle:job_title to:recipient subject body templateName:template_name triggerEvent:trigger_event sourceModule:source_module messageId:message_id sentAt:sent_at actor']
].map(([key,table,s])=>({key,table,fields:s.split(' ').map(x=>{const [prop,col=prop,type]=x.split(':');return {prop,col,type};})}));
const parseJSON = v => typeof v === 'string' ? JSON.parse(v) : v;
function encode(row, fields) {return fields.map(({prop,type})=>row[prop] == null ? null : type==='json'?JSON.stringify(row[prop]):type==='bool'?Number(!!row[prop]):row[prop]);}
function flatten(db) {
  return {...db,
    feedbackRows: db.interviews.filter(i=>i.feedback).map(i=>({id:i.id,...i.feedback})),
    offerRows: db.applications.filter(a=>a.offer).map(a=>({id:a.id,...a.offer})),
    noteRows: db.applications.flatMap(a=>a.notes.map((n,k)=>({id:`${a.id}-note-${k}`,applicationId:a.id,...n,sequence:k})))
  };
}
async function load(conn) {
  const [heads]=await conn.query('SELECT * FROM hr_workspace WHERE id=1');
  if(!heads.length) fail(503,'Database has not been initialized. Run npm run db:init.');
  const h=heads[0], db={schemaVersion:2,revision:h.revision,createdAt:h.created_at,updatedAt:h.updated_at};
  // A connection stays inside one repeatable-read transaction for a coherent snapshot.
  for(const m of maps) {
    const [rows]=await conn.query(`SELECT ${m.fields.map(f=>'`'+f.col+'`').join(',')} FROM ${m.table}`);
    db[m.key]=rows.map(row=>Object.fromEntries(m.fields.map(({prop,col,type})=>[prop,type==='json'?parseJSON(row[col]):type==='bool'?!!row[col]:type==='time'?row[col].slice(0,5):row[col]])));
  }
  db.interviews.forEach(i=>{i.feedback=db.feedbackRows.find(f=>f.id===i.id)||null;if(i.feedback)delete i.feedback.id;});
  db.applications.forEach(a=>{a.notes=db.noteRows.filter(n=>n.applicationId===a.id).sort((a,b)=>a.sequence-b.sequence).map(n=>({text:n.text,actor:n.actor,at:n.at}));a.offer=db.offerRows.find(o=>o.id===a.id)||null;if(a.offer)delete a.offer.id;a.feedback=db.interviews.filter(i=>i.applicationId===a.id&&i.feedback).sort((a,b)=>b.feedback.recordedAt.localeCompare(a.feedback.recordedAt))[0]?.feedback||null;});
  db.notifications.forEach(n=>{n.candidateId=db.applications.find(a=>a.id===n.applicationId)?.candidateId;});
  db.applications.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  db.activity.sort((a,b)=>b.at.localeCompare(a.at));db.notifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  db.systemNotifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));db.mailLogs.sort((a,b)=>b.sentAt.localeCompare(a.sentAt));
  delete db.feedbackRows;delete db.offerRows;delete db.noteRows;
  M.validate(db);return db;
}
async function save(conn, before, after) {
  const b=flatten(before),a=flatten(after);
  for(const m of maps) {
    const old=new Map((b[m.key]||[]).map(row=>[row.id,encode(row,m.fields)]));
    for(const row of a[m.key]||[]) {
      const values=encode(row,m.fields),previous=old.get(row.id);
      if(previous&&JSON.stringify(previous)===JSON.stringify(values))continue;
      if(previous)await conn.execute(`UPDATE ${m.table} SET ${m.fields.slice(1).map(f=>'`'+f.col+'`=?').join(',')} WHERE id=?`,[...values.slice(1),row.id]);
      else await conn.execute(`INSERT INTO ${m.table} (${m.fields.map(f=>'`'+f.col+'`').join(',')}) VALUES (${values.map(()=>'?').join(',')})`,values);
    }
  }
  await conn.execute('UPDATE hr_workspace SET revision=?,updated_at=? WHERE id=1',[after.revision,after.updatedAt||after.createdAt]);
}
function createRepository(pool) {
  async function transaction(fn,write=false) {
    const conn=await pool.getConnection();
    try {
      await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await conn.beginTransaction();
      if(write)await conn.query('SELECT revision FROM hr_workspace WHERE id=1 FOR UPDATE');
      const value=await fn(conn);await conn.commit();return value;
    } catch(e) {await conn.rollback();throw e;} finally {conn.release();}
  }
  async function snapshot(userId) {return transaction(async conn=>{
    const db=await load(conn);
    const [read]=await conn.execute('SELECT notification_id FROM hr_notification_read WHERE user_id=?',[userId]);
    const ids=new Set(read.map(r=>r.notification_id));db.systemNotifications.forEach(n=>n.read=ids.has(n.id));
    const [resumes]=await conn.query('SELECT candidate_id,filename,size_bytes,uploaded_at FROM hr_resume');
    db.candidates.forEach(c=>{const r=resumes.find(r=>r.candidate_id===c.id);c.resume=r?{filename:r.filename,size:r.size_bytes,uploadedAt:r.uploaded_at}:null;});
    return db;
  });}
  return {pool,transaction,snapshot,load,save};
}
module.exports={createRepository,load,save,maps,flatten};
