import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Runs inside the recruitment write transaction, after immutable native log/attachment saves.
// Unknown historical sender identities are never guessed from a display name.
export async function syncSentMail(connection,{uploadDir}) {
  const [rows]=await connection.query(`SELECT n.*,l.canonical_id AS canonical_application_id,
    h.user_id AS canonical_sender_id,d.template_id AS native_template_id
    FROM recruiting_notification_log n
    JOIN JRS_HR_APPLICATION_LINK l ON l.recruiting_id=n.application_id
    JOIN HR_USER h ON n.actor_id=CONCAT('team-hr-',h.user_id)
    LEFT JOIN recruiting_email_draft d ON d.id=n.draft_id
    LEFT JOIN NOTIFICATION_LOG c ON c.event_key=CONCAT('recruiting-mail:',n.id)
    WHERE c.log_id IS NULL ORDER BY n.sent_at DESC LIMIT 100`);
  for(const row of rows) {
    const match=/^canonical-template-(\d+)$/.exec(row.native_template_id||'');
    const [saved]=await connection.execute(`INSERT INTO NOTIFICATION_LOG(application_id,template_id,sender_user_id,
      trigger_event,source_module,recipient_email,candidate_name,position_title,template_name,
      email_subject,email_body,delivery_status,sent_at,event_key,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,'SENT',?,?,UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE event_key=VALUES(event_key)`,[
      row.canonical_application_id,match?Number(match[1]):null,row.canonical_sender_id,
      row.trigger_event,row.source_module,row.recipient,row.candidate_name,row.job_title,row.template_name||'Custom message',
      row.subject,row.body,new Date(row.sent_at),'recruiting-mail:'+row.id
    ]);
    let logId=saved.insertId;
    if(!logId){const [[existing]]=await connection.execute('SELECT log_id FROM NOTIFICATION_LOG WHERE event_key=?',['recruiting-mail:'+row.id]);logId=existing.log_id;}
    const [attachments]=await connection.execute('SELECT id,filename,content,mime_type FROM recruiting_notification_attachment WHERE log_id=?',[row.id]);
    for(const attachment of attachments) {
      const digest=createHash('sha256').update(attachment.id).update(attachment.content).digest('hex');
      const key=[digest.slice(0,8),digest.slice(8,12),digest.slice(12,16),digest.slice(16,20),digest.slice(20,32)].join('-')+'.pdf';
      await fs.mkdir(uploadDir,{recursive:true});
      await fs.writeFile(path.join(uploadDir,key),attachment.content,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
      const [[existing]]=await connection.execute('SELECT attachment_id FROM NOTIFICATION_ATTACHMENT WHERE log_id=? AND file_url=?',[logId,key]);
      if(!existing)await connection.execute('INSERT INTO NOTIFICATION_ATTACHMENT(log_id,file_name,file_url,file_type,created_at) VALUES(?,?,?,?,UTC_TIMESTAMP())',[logId,attachment.filename,key,attachment.mime_type||'application/pdf']);
    }
  }
}
