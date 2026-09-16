'use strict';
const M=require('../dist/state.js');
const {fail}=require('./errors.cjs');
const {hash}=require('./auth.cjs');
const now=()=>new Date().toISOString();
const text=(v,label,max=500,optional=false)=>{
  if(v==null&&optional)return '';if(typeof v!=='string')fail(422,`${label} must be text.`);
  const s=v.trim();if((!s&&!optional)||s.length>max)fail(422,`${label} is required and must be at most ${max} characters.`);return s;
};
const email=v=>{const s=text(v,'Email',254).toLowerCase();if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)||s.startsWith('.')||s.includes('..')||s.includes('.@'))fail(422,'Enter a single valid email address.');return s;};
const find=(arr,id)=>{const r=arr.find(r=>r.id===id);if(!r)fail(404,'Record not found.');return r;};
const standard=new Set(['move-interview','reject','schedule','cancel-interview','feedback','offer','approve-offer','offer-message','accept-offer','confirm-rejection','message','read-notification','read-all','task','complete-task','candidate-notes','job-save','job-status']);
const custom=new Set(['application-create','candidate-save','profile-save','template-save','template-delete','system-read','system-read-all']);
const managerOnly=new Set(['approve-offer','template-save','template-delete']);
const variables=['candidateName','jobTitle','hrName','date','time','interviewer','location','format','salary','currency','startDate','expiry'];
function checkTemplate(value) {
  for(const match of value.matchAll(/{{\s*([^{}]+)\s*}}/g))if(!variables.includes(match[1].trim()))fail(422,`Unknown template variable: ${match[1]}`);
  if(value.replace(/{{\s*[^{}]+\s*}}/g,'').includes('{{'))fail(422,'Template contains an incomplete variable.');
}
function fillTemplate(db,a,user,template) {
  const c=find(db.candidates,a.candidateId),j=find(db.jobs,a.jobId),i=db.interviews.find(i=>i.applicationId===a.id&&i.status==='Scheduled');
  const values={candidateName:c.name,jobTitle:j.title,hrName:user.name,date:i?.date,time:i?.time,interviewer:i?.interviewer,location:i?.location,format:i?.format,...a.offer};
  const render=s=>s.replace(/{{\s*([^{}]+?)\s*}}/g,(_,key)=>{if(values[key]==null)fail(422,`This application has no ${key} yet. Complete its workflow details first.`);return String(values[key]);});
  return {subject:render(template.subject),body:render(template.body)};
}
function audit(db,user,summary,applicationId=null,notes='') {
  const row={id:M.uid('activity'),applicationId,summary,notes,actor:user.name,actorId:user.id,at:now(),from:null,to:null};db.activity.unshift(row);return row;
}
function validatePayload(p) {
  if(!p||typeof p!=='object'||Array.isArray(p))fail(422,'A JSON object is required.');
  for(const [key,value] of Object.entries(p)) {
    if(key==='candidate'){if(!value||typeof value!=='object'||Array.isArray(value))fail(422,'Candidate details are invalid.');continue;}
    if(value!=null&&!['string','number','boolean'].includes(typeof value))fail(422,`Invalid ${key}.`);
    if(typeof value==='string'&&value.length>6000)fail(422,`${key} is too long.`);
  }
  if(p.notify!==undefined&&typeof p.notify!=='boolean')fail(422,'Notification preference must be true or false.');
}
function applyCommand(db,command,p,user) {
  validatePayload(p);if(managerOnly.has(command)&&user.role!=='HR_MANAGER')fail(403,'This action requires an HR Manager.');
  if(!standard.has(command)&&!custom.has(command))fail(404,'Unknown HR action.');
  // Never change an application while its exact message is being handed to SMTP.
  const applicationId=p.applicationId||(['complete-task'].includes(command)?find(db.tasks,p.id).applicationId:null);
  const affectsJobs=['job-save','job-status'].includes(command);
  if(db.notifications.some(n=>n.status==='Sending'&&(n.applicationId===applicationId||affectsJobs&&find(db.applications,n.applicationId).jobId===p.id)))fail(409,'A message is being sent for this application. Try again when sending finishes.');
  const activityIds=new Set(db.activity.map(a=>a.id));let result={};
  if(standard.has(command)) {
    if(applicationId&&!db.applications.some(a=>a.id===applicationId))fail(404,'Application not found.');
    if(['move-interview','reject','schedule','cancel-interview','feedback','offer','approve-offer','offer-message','accept-offer','confirm-rejection','message','task','candidate-notes'].includes(command)&&!p.applicationId)fail(422,'Application ID is required.');
    if(command==='message'&&p.templateId){const t=find(db.templates,p.templateId);if(!t.active)fail(409,'This template is archived.');const a=find(db.applications,p.applicationId);
      if(t.kind==='Offer Letter'&&(a.stage!=='Offer'||a.offer?.approval!=='Approved'||a.offer.expiry<M.day()))fail(422,'Approve a valid offer before using an offer template.');
      if(t.kind==='Accepted'&&a.stage!=='Hired')fail(422,'Record offer acceptance before using this template.');
      if(t.kind==='Rejected'&&(a.stage!=='Rejected'||!a.rejectionConfirmed))fail(422,'Confirm the rejection before using this template.');
      if(t.kind==='Interview Invite'&&a.stage!=='Interview')fail(422,'Move this application to Interview first.');
      if(!p.subject||!p.body)p={...p,...fillTemplate(db,a,user,t)};
    }
    if(command==='schedule'||command==='task')text(p.notes,'Notes',command==='schedule'?500:1000,true);
    if(command==='offer'&&!/^\d+(\.\d{1,2})?$/.test(String(p.salary)))fail(422,'Salary must be a positive amount with at most two decimal places.');
    if(command==='offer'&&db.notifications.some(n=>n.applicationId===p.applicationId&&n.kind==='Offer'&&['Sent','Sending','Uncertain'].includes(n.status)))fail(409,'A communicated offer cannot be edited here. Review the sent terms or close the application.');
    if(command==='feedback') {const i=find(db.interviews,p.interviewId);if(new Date(i.date+'T'+i.time+':00+08:00').getTime()+i.duration*60000>Date.now())fail(422,'Record feedback after the interview ends.');}
    if(command==='message'&&/[\r\n]/.test(String(p.subject)))fail(422,'Email subject cannot contain new lines.');
    if(command==='offer-message'&&db.notifications.some(n=>n.applicationId===p.applicationId&&n.kind==='Offer'&&['Sent','Sending','Uncertain'].includes(n.status)))fail(409,'An offer message has already been submitted. Review its history.');
    try{result=M.apply(db,command,p,{actor:user.name});}catch(e){fail(422,e.message,'WORKFLOW_ERROR');}
    if(['offer','approve-offer'].includes(command)){const a=find(db.applications,p.applicationId),entry=db.activity.find(x=>!activityIds.has(x.id));if(entry)entry.notes=`SGD ${a.offer.salary}/month; starts ${a.offer.startDate}; respond by ${a.offer.expiry}. Terms: ${a.offer.terms}`;}
    if(result.notification&&p.templateId){const t=find(db.templates,p.templateId);result.notification.templateId=t.id;result.notification.templateName=t.name;if(t.kind==='Offer Letter')result.notification.kind='Offer';if(t.kind==='Interview Invite')result.notification.kind='Interview schedule';}
  } else if(command==='application-create') {
    const j=find(db.jobs,p.jobId);if(j.status!=='Active')fail(409,'Applications require an active job.');
    let c;
    if(p.candidateId)c=find(db.candidates,p.candidateId);
    else {const v=p.candidate||{},address=email(v.email);if(db.candidates.some(c=>c.email.toLowerCase()===address))fail(409,'This email already exists. Select the existing candidate.');c=candidateValue(v);c.id=M.uid('candidate');c.createdAt=now();c.notes='';db.candidates.push(c);}
    if(db.applications.some(a=>a.candidateId===c.id&&a.jobId===j.id))fail(409,'This candidate already has an application for this job.');
    const a={id:M.uid('APP'),candidateId:c.id,jobId:j.id,stage:'Pending Review',appliedDate:M.day(),priority:p.priority==='High'?'High':'Normal',rejectionReason:'',rejectionConfirmed:false,notes:[],feedback:null,offer:null,createdAt:now()};db.applications.push(a);
    const event=audit(db,user,'Application received',a.id);db.systemNotifications.unshift({id:event.id,applicationId:a.id,title:c.name+' applied for '+j.title,eventType:'New Application',sourceModule:'Applications',createdAt:event.at});result={application:a,activity:event};
  } else if(command==='candidate-save') {
    const c=find(db.candidates,p.id),v=candidateValue(p);if(db.candidates.some(x=>x.id!==c.id&&x.email.toLowerCase()===v.email))fail(409,'Another candidate uses this email.');
    if(db.notifications.some(n=>n.candidateId===c.id&&n.status==='Sending'))fail(409,'A message is being sent for this candidate.');
    Object.assign(c,v);db.notifications.filter(n=>n.candidateId===c.id&&n.status==='Draft').forEach(n=>n.to=c.email);audit(db,user,'Candidate details updated',db.applications.find(a=>a.candidateId===c.id)?.id);result.candidate=c;
  } else if(command==='template-save') {
    const v={name:text(p.name,'Template name',100),kind:text(p.kind,'Template type',50),subject:text(p.subject,'Subject',200),body:text(p.body,'Body',6000),active:true,updatedAt:now()};
    if(!['Interview Invite','Offer Letter','Accepted','Rejected','In Progress'].includes(v.kind))fail(422,'Choose a valid template type.');
    if(/[\r\n]/.test(v.subject))fail(422,'Subject cannot contain new lines.');checkTemplate(v.subject+'\n'+v.body);
    const t=p.id?find(db.templates,p.id):{id:M.uid('template')};if(p.id&&!t.active)fail(409,'This template is archived.');Object.assign(t,v);if(!p.id)db.templates.push(t);audit(db,user,'Email template saved',null,t.name);result.template=t;
  } else if(command==='template-delete') {const t=find(db.templates,p.id);if(!t.active)fail(409,'Template is already archived.');t.active=false;t.updatedAt=now();audit(db,user,'Email template archived',null,t.name);}
  // Profile and per-user read flags are handled as SQL side effects inside the same transaction.
  for(const x of db.activity.filter(x=>!activityIds.has(x.id))) {
    x.actor=user.name;x.actorId=user.id;
    if(x.from&&x.to)db.systemNotifications.unshift({id:x.id,applicationId:x.applicationId,title:x.summary,eventType:'Status Update',sourceModule:'Applications',createdAt:x.at});
  }
  M.validate(db);return result;
}
function candidateValue(v) {
  const experience=Number(v.experience);if(!Number.isFinite(experience)||experience<0||experience>70)fail(422,'Experience must be between 0 and 70 years.');
  return {name:text(v.name,'Candidate name',100),email:email(v.email),phone:text(v.phone,'Phone',40),location:text(v.location,'Location',100),experience:Math.round(experience*10)/10,education:text(v.education,'Education',150),skills:text(v.skills,'Skills',500).split(',').map(s=>s.trim()).filter(Boolean)};
}
function createService(repo) {
  async function execute(command,p,user,revision,key) {
    if(!Number.isInteger(revision)||revision<0)fail(428,'Reload the workspace before saving.','REVISION_REQUIRED');
    if(typeof key!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(key))fail(400,'A valid Idempotency-Key is required.');
    const id=user.id+':'+key,requestHash=hash(JSON.stringify({command,p}));
    return repo.transaction(async conn=>{
      const [[cached]]=await conn.execute('SELECT request_hash,result_json FROM hr_request WHERE id=?',[id]);
      if(cached){if(cached.request_hash!==requestHash)fail(409,'This request key was used for a different operation.');return typeof cached.result_json==='string'?JSON.parse(cached.result_json):cached.result_json;}
      const before=await repo.load(conn);if(before.revision!==revision)fail(409,'Another user changed this workspace. Refresh and review the latest data before saving.','REVISION_CONFLICT');
      const after=M.clone(before),result=applyCommand(after,command,p,user);
      if(command==='profile-save') {
        const phone=text(p.phone,'Phone',40,true),office=text(p.officeLocation,'Office location',100,true);
        await conn.execute('UPDATE hr_user SET phone=?,office_location=? WHERE id=?',[phone,office,user.id]);audit(after,user,'HR profile updated');
      }
      if(command==='system-read'||command==='system-read-all') {
        const rows=command==='system-read'?[find(after.systemNotifications,p.id)]:after.systemNotifications;
        for(const n of rows)await conn.execute('INSERT IGNORE INTO hr_notification_read(notification_id,user_id) VALUES (?,?)',[n.id,user.id]);
      }
      after.revision++;after.updatedAt=now();await repo.save(conn,before,after);
      const response={result,revision:after.revision};
      await conn.execute('DELETE FROM hr_request WHERE created_at<?',[Date.now()-7*86400000]);
      await conn.execute('INSERT INTO hr_request(id,user_id,request_hash,result_json,created_at) VALUES (?,?,?,?,?)',[id,user.id,requestHash,JSON.stringify(response),Date.now()]);return response;
    },true);
  }
  return {execute};
}
module.exports={createService,applyCommand,fillTemplate,variables,text,email,find,audit,candidateValue};
