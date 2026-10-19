'use strict';
const M=require('../dist/state.js');
const {fail}=require('./errors.cjs');
const {find,audit}=require('./service.cjs');
function createMailer(repo,cfg,transport) {
  const options=cfg.mail;
  async function send(id,user,revision,attachResume=false) {
    if(!options.enabled)fail(409,'Email sending is not enabled. Your message remains a draft.');
    if(!options.host||!options.from||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(options.from))fail(503,'Configure SMTP_HOST and a valid MAIL_FROM before sending.');
    const prepared=await repo.transaction(async conn=>{
      const before=await repo.load(conn),after=M.clone(before),n=find(after.notifications,id);
      // The persistent draft ID, rather than a new request key, prevents repeat sends.
      if(n.status==='Sent')return {alreadySent:true};
      if(n.status!=='Draft')fail(409,'This message is not a current draft. Check its status before sending.');
      if(!Number.isInteger(revision)||revision!==before.revision)fail(409,'Refresh the workspace before sending.','REVISION_CONFLICT');
      const a=find(after.applications,n.applicationId),c=find(after.candidates,a.candidateId),j=find(after.jobs,a.jobId);
      if(n.to.toLowerCase()!==c.email.toLowerCase())fail(409,'The candidate email changed. Review the draft first.');
      if(c.email.endsWith('@example.com'))fail(409,'Example candidates cannot receive email. Update the candidate to an address you control before testing SMTP.');
      if(n.kind==='Offer'&&(a.stage!=='Offer'||a.offer?.approval!=='Approved'||a.offer.expiry<M.day()))fail(409,'This offer is no longer valid for sending.');
      let attachment=null;
      if(attachResume){const [[r]]=await conn.execute('SELECT filename,content,size_bytes FROM hr_resume WHERE candidate_id=?',[c.id]);if(!r)fail(422,'This candidate has no uploaded resume to attach.');attachment=r;}
      n.status='Sending';n.sendingAt=new Date().toISOString();n.lastError=null;
      after.revision++;after.updatedAt=n.sendingAt;await repo.save(conn,before,after);
      return {draft:n,candidate:c,job:j,attachment};
    },true);
    if(prepared.alreadySent)return {alreadySent:true};
    const {draft:n,candidate:c,job:j,attachment}=prepared;
    let info;
    try {
      const client=transport||require('nodemailer').createTransport({host:options.host,port:options.port,secure:options.secure,requireTLS:!options.secure,auth:options.user?{user:options.user,pass:options.password}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
      info=await client.sendMail({from:options.from,to:n.to,subject:n.subject,text:n.body,messageId:`<${n.id}@jrs.local>`,attachments:attachment?[{filename:attachment.filename,content:attachment.content,contentType:'application/pdf'}]:[]});
      if(!info.accepted?.some(v=>String(v).toLowerCase()===n.to.toLowerCase()))throw Error('SMTP did not accept this recipient.');
    } catch(error) {
      // SMTP cannot guarantee exactly-once delivery after a timeout. Never auto-resend.
      await repo.transaction(async conn=>{const before=await repo.load(conn),after=M.clone(before),current=find(after.notifications,id);current.status='Uncertain';current.lastError='Sending could not be confirmed. Check the mail provider before taking further action.';after.revision++;after.updatedAt=new Date().toISOString();audit(after,user,'Email sending could not be confirmed',n.applicationId);await repo.save(conn,before,after);},true);
      fail(502,'Sending could not be confirmed. Check the provider; this message will not be automatically resent.','MAIL_UNCERTAIN');
    }
    // SMTP success and the immutable history record are committed together. If this
    // fails, Sending remains locked for manual reconciliation instead of duplicate mail.
    await repo.transaction(async conn=>{
      const before=await repo.load(conn),after=M.clone(before),current=find(after.notifications,id),sentAt=new Date().toISOString();
      current.status='Sent';current.lastError=null;
      const log={id:M.uid('sent'),draftId:id,applicationId:n.applicationId,candidateName:c.name,jobTitle:j.title,to:n.to,subject:n.subject,body:n.body,templateName:n.templateName||null,triggerEvent:n.kind||'Message',sourceModule:'Applications',messageId:info.messageId||`<${id}@jrs.local>`,sentAt,actor:user.name};after.mailLogs.unshift(log);
      audit(after,user,'Candidate email accepted by mail server',n.applicationId);
      after.revision++;after.updatedAt=sentAt;await repo.save(conn,before,after);
      if(attachment)await conn.execute('INSERT INTO hr_notification_attachment(id,log_id,filename,content,size_bytes,mime_type) VALUES (?,?,?,?,?,?)',[M.uid('attachment'),log.id,attachment.filename,attachment.content,attachment.size_bytes,'application/pdf']);
    },true);
    return {sent:true};
  }
  return {send};
}
module.exports={createMailer};
