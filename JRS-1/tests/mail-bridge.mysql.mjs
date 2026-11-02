import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {randomUUID} from 'node:crypto';
import {loadSettings,assertLocalDatabase} from '../server/config.mjs';
const migration=await import('../server/migrations/010-mail-history.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const bridge=await import('../server/mail-history-bridge.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('native accepted mail appears once in the canonical sender-scoped log with an immutable body',async()=>{
 assert.equal(typeof bridge.syncSentMail,'function','Sent-mail history bridge is missing');
 const settings=loadSettings();assertLocalDatabase(settings);const pool=mysql.createPool({...settings.db,database:'jrs_integrated_test_20261019'});
 try{
  await migration.migrateMailHistory(pool);await migration.migrateMailHistory(pool);
  const conn=await pool.getConnection();try{await conn.beginTransaction();
   const [[hr]]=await conn.query("SELECT user_id FROM HR_USER WHERE account_status='ACTIVE' ORDER BY user_id LIMIT 1");
   const [[app]]=await conn.query('SELECT recruiting_id,canonical_id FROM JRS_HR_APPLICATION_LINK LIMIT 1');
   assert.ok(app,'Run the existing isolated workflow fixture first');
   const id='test-'+randomUUID(),draft='draft-'+randomUUID();
   await conn.execute("INSERT INTO recruiting_email_draft(id,application_id,recipient,subject,body,kind,status,is_read,created_at) VALUES(?,?,?,?,?,'Message','Sent',0,?)",[draft,app.recruiting_id,'inbox@example.test','Interview outcome','Saved original body',new Date().toISOString()]);
   await conn.execute('INSERT INTO recruiting_notification_log(id,draft_id,application_id,candidate_name,job_title,recipient,subject,body,trigger_event,source_module,message_id,sent_at,actor,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,draft,app.recruiting_id,'Example Person','Example Position','inbox@example.test','Interview outcome','Saved original body','Interview Rejection','Applications','message-'+id,new Date().toISOString(),'Fixture HR','team-hr-'+hr.user_id]);
   await bridge.syncSentMail(conn,{uploadDir:'.local/no-uploads'});await bridge.syncSentMail(conn,{uploadDir:'.local/no-uploads'});
   const [logs]=await conn.execute('SELECT * FROM NOTIFICATION_LOG WHERE event_key=?',['recruiting-mail:'+id]);
   assert.equal(logs.length,1);assert.equal(logs[0].sender_user_id,hr.user_id);assert.equal(logs[0].application_id,app.canonical_id);assert.equal(logs[0].email_body,'Saved original body');assert.equal(logs[0].delivery_status,'SENT');
   await conn.execute('UPDATE recruiting_notification_log SET body=? WHERE id=?',['Must not overwrite history',id]);
   await bridge.syncSentMail(conn,{uploadDir:'.local/no-uploads'});
   const [[unchanged]]=await conn.execute('SELECT email_body FROM NOTIFICATION_LOG WHERE event_key=?',['recruiting-mail:'+id]);assert.equal(unchanged.email_body,'Saved original body');
  }finally{await conn.rollback();conn.release();}
 }finally{await pool.end();}
});
