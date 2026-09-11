import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { createDatabase } from './db.js';
import { defineModels } from './models.js';
import { assertDatabaseWriteAllowed, inspectMigrationTarget } from './database-safety.js';

export const demoTemplates = [
  {templateName:'Interview Invite',usageType:'INTERVIEW_INVITE',subject:'Interview invitation for [JobTitle]',body:'Dear [CandidateName],\n\nYour application has moved to the Interview stage. The interview team will contact you with scheduling details.\n\nRegards,\n[HRName]\n[CompanyName]'},
  {templateName:'Offer Letter',usageType:'OFFER_LETTER',subject:'Offer for [JobTitle] at [CompanyName]',body:'Dear [CandidateName],\n\nWe are pleased to offer you the position of [JobTitle]. Please review the details provided by the hiring team.\n\nRegards,\n[HRName]'},
  {templateName:'Accepted',usageType:'ACCEPTED',subject:'Application accepted for [JobTitle]',body:'Dear [CandidateName],\n\nYour application for [JobTitle] has been accepted.\n\nRegards,\n[HRName]\n[CompanyName]'},
  {templateName:'Rejected',usageType:'REJECTED',subject:'Update on your application for [JobTitle]',body:'Dear [CandidateName],\n\nThank you for your interest in [CompanyName]. We will not be progressing your application for [JobTitle].\n\nRegards,\n[HRName]'},
  {templateName:'In Progress',usageType:'IN_PROGRESS',subject:'Your application for [JobTitle] is in progress',body:'Dear [CandidateName],\n\nYour application for [JobTitle] is currently under review.\n\nRegards,\n[HRName]\n[CompanyName]'}
];

// Fictional fixtures only. No mailer is constructed or called by seed.
// Existing data, edited templates and passwords are preserved on sequential reruns.
export async function seedDemo(db, models, { password, now = new Date() }) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || password.startsWith('replace_')) throw new Error('Set a local SEED_PASSWORD of 12–128 characters; do not use the example placeholder.');
  const passwordHash=await bcrypt.hash(password,12);
  return db.transaction(async transaction => {
    const ensure=async (model,where,defaults) => (await model.findOrCreate({where,defaults,transaction}))[0];
    const hrs=[],applications=[];
    for(const [index,name] of ['Riley Morgan','Jordan Lee'].entries()) {
      const suffix=index+1,email=`hr${suffix}@example.test`;
      const hr=await ensure(models.HrUser,{employeeId:`DEMO-HR-00${suffix}`},{fullName:name,email,role:'HR Manager',department:'Human Resources',phone:'',officeLocation:'Demo Office',accountStatus:'ACTIVE'});
      const account=await ensure(models.Account,{email},{passwordHash,role:'HR',hrUserId:hr.userId});
      if(account.hrUserId!==hr.userId) throw new Error('Demo account identity collision; existing data was preserved.');
      hrs.push(hr);
      const candidate=await ensure(models.Candidate,{email:`candidate${suffix}@example.test`},{fullName:index===0?'Casey Taylor':'Avery Chen'});
      const job=await ensure(models.Job,{title:index===0?'Software Developer (Demo)':'Support Officer (Demo)'},{});
      const application=await ensure(models.Application,{candidateId:candidate.candidateId,positionId:job.positionId,assignedHrUserId:hr.userId},{currentStatus:'In Progress',appliedAt:now});
      applications.push(application);
      for(const [typeIndex,type] of ['NEW_APPLICATION','STATUS_UPDATED'].entries()) await ensure(models.Notification,{eventKey:`demo:hr:${suffix}:notification:${type}`},{recipientUserId:hr.userId,applicationId:application.applicationId,notificationType:type,title:typeIndex===0?'New application received':'Candidate status updated',message:`Demo: ${candidate.fullName} — ${job.title}.`,sourceModule:'Applications (Demo)',isRead:typeIndex===1,readAt:typeIndex===1?now:null,createdAt:now});
    }
    const templates=[];
    for(const fields of demoTemplates) templates.push(await ensure(models.Template,{templateName:fields.templateName},{...fields,createdBy:hrs[0].userId,updatedBy:hrs[0].userId,isActive:true}));
    for(const [index,hr] of hrs.entries()) {
      for(const status of ['SENT','PREVIEW','FAILED','PENDING']) await ensure(models.Log,{eventKey:`demo:hr:${index+1}:history:${status}`},{applicationId:applications[index].applicationId,templateId:templates[0].templateId,senderUserId:hr.userId,triggerEvent:'Moved to Interview',sourceModule:'Applications (Demo)',recipientEmail:`candidate${index+1}@example.test`,candidateName:index===0?'Casey Taylor':'Avery Chen',positionTitle:index===0?'Software Developer (Demo)':'Support Officer (Demo)',templateName:'Interview Invite',emailSubject:'[SIMULATED] Interview invitation',emailBody:'SIMULATED HISTORY — no email was sent.\n\nThis is a fictional interview invitation used to demonstrate the HR module.',deliveryStatus:status,sentAt:status==='SENT'?now:null,isDemo:true,errorMessage:status==='FAILED'?'Simulated failure; no provider was contacted.':null,createdAt:now});
    }
    return {hrAccounts:hrs.length,templates:templates.length};
  });
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    assertDatabaseWriteAllowed();db=createDatabase();await db.authenticate();
    if(!(await inspectMigrationTarget(db)).initialized) throw new Error('Run the reviewed migration on the confirmed database before seeding.');
    const result=await seedDemo(db,defineModels(db),{password:process.env.SEED_PASSWORD});
    console.log(`Demo seed complete: ${result.hrAccounts} fictional HR accounts and ${result.templates} templates. No email sent. Existing values were preserved.`);
  } catch(error) { console.error('Seed stopped:',error.original?.code || error.message);process.exitCode=1; }
  finally { if(db) await db.close(); }
}
