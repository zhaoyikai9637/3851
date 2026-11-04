// Imported notifications have an authoritative, immutable source event.
export function notificationTimeRepairs(rows){
 const changes=[],skipped=[];
 for(const row of rows){
  const source=typeof row.sourceAt==='string'?row.sourceAt:row.sourceAt instanceof Date?row.sourceAt.toISOString():'';
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(source)||!Number.isFinite(Date.parse(source))){skipped.push(row.id);continue;}
  const calendar=Date.parse(source.slice(0,19)+'Z');
  if(!Number.isFinite(calendar)||new Date(calendar).toISOString().slice(0,19)!==source.slice(0,19)){skipped.push(row.id);continue;}
  const expectedAt=new Date(source).toISOString().slice(0,19).replace('T',' ');
  const savedAt=row.savedAt instanceof Date?row.savedAt.toISOString().slice(0,19).replace('T',' '):String(row.savedAt).slice(0,19);
  if(savedAt!==expectedAt)changes.push({id:row.id,eventKey:row.eventKey,sourceAt:source,savedAt,expectedAt});
 }
 return {changes,skipped};
}
const select="SELECT n.notification_id AS id,n.event_key AS eventKey,n.created_at AS savedAt,r.created_at AS sourceAt FROM SYSTEM_NOTIFICATION n JOIN recruiting_system_notification r ON n.event_key=CONCAT('recruiting:',r.id) WHERE n.event_key LIKE 'recruiting:%' ORDER BY n.notification_id";
export async function repairNotificationTimes(pool,{apply=false,backup}={}){
 if(!apply){const [rows]=await pool.query(select);const plan=notificationTimeRepairs(rows);return {inspected:rows.length,corrected:0,...plan};}
 if(typeof backup!=='function')throw Error('A durable backup is required before timestamp repair.');
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [rows]=await db.query(select+' FOR UPDATE'),plan=notificationTimeRepairs(rows);
  let backupFile=null;
  if(plan.changes.length){
   backupFile=await backup(plan.changes);
   for(const row of plan.changes){
    const [result]=await db.execute('UPDATE SYSTEM_NOTIFICATION SET created_at=? WHERE notification_id=? AND event_key=? AND created_at=?',[row.expectedAt,row.id,row.eventKey,row.savedAt]);
    if(result.affectedRows!==1)throw Error('Notification changed while preparing its repair.');
   }
  }
  await db.commit();
  return {inspected:rows.length,corrected:plan.changes.length,changes:plan.changes,skipped:plan.skipped,backupFile};
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}
