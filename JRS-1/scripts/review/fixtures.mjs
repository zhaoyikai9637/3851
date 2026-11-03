import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcrypt';
import model from '../../JRS HR/dist/state.js';
import repository from '../../JRS HR/server/repository.cjs';
import {namespacePool} from '../../server/sql-namespace.mjs';
import {createRecruitmentBridge} from '../../server/recruitment-bridge.mjs';
import {formalTemplates} from '../../server/formal-mail-templates.mjs';
import {reviewDirectory} from './environment.mjs';
export async function seedReviewFixtures(db) {
 const accounts=[],now=new Date().toISOString();let managerId;
 for(const spec of [
  {email:'manager.review@example.test',name:'Review HR Manager',role:'HR_MANAGER',employee:'REVIEW-MANAGER'},
  {email:'staff.review@example.test',name:'Review HR Staff',role:'HR_STAFF',employee:'REVIEW-STAFF'},
  {email:'applicant.review@example.test',name:'Review Applicant',role:'candidate'},
  {email:'applicant2.review@example.test',name:'Second Applicant',role:'candidate'}
 ]){
  const password='Review1!'+randomBytes(16).toString('hex'),hash=await bcrypt.hash(password,12);let hrId=null;
  if(spec.role!=='candidate'){
   const [hr]=await db.execute("INSERT INTO HR_USER(employee_id,full_name,email,phone,role,department,office_location,account_status) VALUES(?,?,?,'',?,'Human Resources','Local reviewer environment','ACTIVE')",[spec.employee,spec.name,spec.email,spec.role]);hrId=hr.insertId;managerId??=hrId;
   await db.execute("INSERT INTO recruiting_user(id,email,password_hash,name,role,status,employee_id,department,phone,office_location,created_at) VALUES(?,?,?,?,?,'Active',?,'Human Resources','','Local reviewer environment',?)",['team-hr-'+hrId,spec.email,'shared-login-only',spec.name,spec.role,spec.employee,now]);
  }
  const [account]=await db.execute('INSERT INTO MODULE_ACCOUNT(email,password_hash,role,hr_user_id) VALUES(?,?,?,?)',[spec.email,hash,spec.role==='candidate'?'candidate':'hr',hrId]);
  if(spec.role==='candidate')await db.execute("INSERT INTO CANDIDATE(account_id,full_name,first_name,last_name,email,country_code,contact_number,home_location,personal_summary) VALUES(?,?,?,?,?,'+65','81234567','Singapore','Fictional local review data only.')",[account.insertId,spec.name,spec.name.split(' ')[0],spec.name.split(' ').slice(1).join(' '),spec.email]);
  accounts.push({name:spec.name,email:spec.email,role:spec.role,password});
 }
 for(const t of formalTemplates)await db.execute('INSERT INTO EMAIL_TEMPLATE(template_name,subject,body,usage_type,is_active,created_by,updated_by) VALUES(?,?,?,?,1,?,?)',[t.templateName,t.subject,t.body,t.usageType,managerId,managerId]);
 const repo=repository.createRepository(namespacePool(db)),bridge=createRecruitmentBridge(db,{experimentalApplicantPortal:true});
 await db.beginTransaction();
 try{await bridge.templates(db);const before=await repo.load(namespacePool(db)),after=model.clone(before);
  for(const [index,title] of ['Software Engineer','QA Engineer','Data Analyst'].entries()){
   const id='review-job-'+(index+1);after.jobs.push({id,title,department:'Review Engineering',type:'Full-time',location:'Singapore',mode:'Hybrid',experience:'2+ years',education:'See job requirements',minimumEducationLevel:'Not configured',acceptedMajors:[],status:'Active',description:'Build reliable services and collaborate with the team.\nReview tested changes and communicate clearly.',skills:['JavaScript','SQL'],requirements:model.requirements.forTitle(title).length?model.requirements.forTitle(title):model.requirements.forTitle(model.requirements.titles[0]),createdAt:now});
   await db.execute("INSERT INTO JRS_JOB_PUBLICATION(recruiting_id,salary_range) VALUES(?,'SGD 5,000 - 6,000')",[id]);
  }
  after.revision++;after.updatedAt=now;await repo.save(namespacePool(db),before,after);await bridge.mirror(db,before,after);await db.commit();
 }catch(error){await db.rollback();throw error;}
 await fs.writeFile(path.join(reviewDirectory,'accounts.json'),JSON.stringify(accounts,null,2),{flag:'wx',mode:0o600});
 await db.query("UPDATE JRS_REVIEW_SETUP SET state='READY' WHERE id=1");
 return accounts.length;
}
