import { pathToFileURL } from 'node:url';
import { createDatabase } from './db.js';
import { defineModels } from './models.js';
import { assertDatabaseWriteAllowed, inspectMigrationTarget } from './database-safety.js';

export const defaultTemplates = [
  {templateName:'Interview Invite',usageType:'INTERVIEW_INVITE',subject:'Interview invitation for [JobTitle]',body:'Dear [CandidateName],\n\nYour application has moved to the Interview stage. The interview team will contact you with scheduling details.\n\nRegards,\n[HRName]\n[CompanyName]'},
  {templateName:'Offer Letter',usageType:'OFFER_LETTER',subject:'Offer for [JobTitle] at [CompanyName]',body:'Dear [CandidateName],\n\nWe are pleased to offer you the position of [JobTitle]. Please review the details provided by the hiring team.\n\nRegards,\n[HRName]'},
  {templateName:'Accepted',usageType:'ACCEPTED',subject:'Application accepted for [JobTitle]',body:'Dear [CandidateName],\n\nYour application for [JobTitle] has been accepted.\n\nRegards,\n[HRName]\n[CompanyName]'},
  {templateName:'Rejected',usageType:'REJECTED',subject:'Update on your application for [JobTitle]',body:'Dear [CandidateName],\n\nThank you for your interest in [CompanyName]. We will not be progressing your application for [JobTitle].\n\nRegards,\n[HRName]'},
  {templateName:'In Progress',usageType:'IN_PROGRESS',subject:'Your application for [JobTitle] is in progress',body:'Dear [CandidateName],\n\nYour application for [JobTitle] is currently under review.\n\nRegards,\n[HRName]\n[CompanyName]'}
];

export async function seedDevelopment(db, models) {
  return db.transaction(async transaction => {
    const [hr] = await models.HrUser.findOrCreate({ where:{employeeId:'LOCAL-HR-001'}, defaults:{fullName:'Local HR User',email:'hr.local@example.test',role:'HR Manager',department:'Human Resources',phone:'',officeLocation:'Main Office',accountStatus:'ACTIVE'}, transaction });
    for (const fields of defaultTemplates) await models.Template.findOrCreate({ where:{templateName:fields.templateName}, defaults:{...fields,createdBy:hr.userId,updatedBy:hr.userId,isActive:true}, transaction });
    return { hrUserId:hr.userId, templates:defaultTemplates.length };
  });
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    assertDatabaseWriteAllowed(); db=createDatabase(); await db.authenticate();
    if(!(await inspectMigrationTarget(db)).initialized) throw new Error('Run the reviewed migration on the confirmed database before seeding.');
    const result=await seedDevelopment(db,defineModels(db));
    console.log(`Development baseline ready for HR user ${result.hrUserId} with ${result.templates} templates.`);
  } catch(error) { console.error('Seed stopped:',error.original?.code || error.message); process.exitCode=1; }
  finally { if(db) await db.close(); }
}
