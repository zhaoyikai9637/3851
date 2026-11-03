import express from 'express';
import {assertCandidateReadAccess} from './candidate-ownership.mjs';
import {locationLabel} from '../JRS Applicant Portal/shared/contactFields.js';
import {languages} from '../JRS Applicant Portal/shared/applicantFields.js';
const list=value=>Array.isArray(value)?value:[];
const flag=value=>Boolean(Number(value));
export async function readPersonalProfile(db,candidateId) {
 const [[person]]=await db.query('SELECT full_name,email,country_code,contact_number,home_location,personal_summary FROM CANDIDATE WHERE candidate_id=?',[candidateId]);
 if(!person)return null;
 const [[career],[education],[certifications],[skills],[spoken]]=await Promise.all([
  db.query('SELECT * FROM CAREER_HISTORY WHERE candidate_id=? ORDER BY role_id',[candidateId]),
  db.query('SELECT * FROM EDUCATION WHERE candidate_id=? ORDER BY education_id',[candidateId]),
  db.query('SELECT * FROM CERTIFICATION WHERE candidate_id=? ORDER BY cert_id',[candidateId]),
  db.query('SELECT skill_name FROM SKILL WHERE candidate_id=? ORDER BY skill_id',[candidateId]),
  db.query('SELECT * FROM LANGUAGE WHERE candidate_id=? ORDER BY language_id',[candidateId]),
 ]);
 const phone=person.contact_number||'';
 return {name:person.full_name||'',email:person.email||'',phone:phone?(phone.startsWith('+')?phone:(person.country_code||'')+phone):'',location:person.home_location||'',summary:person.personal_summary||'',
  career:career.map(r=>({title:r.job_title,company:r.company_name,start:r.start_month_year,end:r.end_month_year,current:flag(r.is_current_role),description:r.description||'',achievements:r.achievements||''})),
  education:education.map(r=>({qualification:r.qualification,institution:r.institution,current:flag(r.is_current_study),finishedYear:r.finished_year,expectedEnd:r.end_month_year,description:r.description||''})),
  certifications:certifications.map(r=>({name:r.cert_name,issuer:r.issuing_org,issue:r.issue_month_year,expiry:r.expiry_month_year,noExpiry:flag(r.no_expiry),description:r.description||''})),
  skills:skills.map(r=>r.skill_name),languages:spoken.map(r=>({name:r.language_name,reading:flag(r.can_read),writing:flag(r.can_write),readingLevel:r.reading_level||'',writingLevel:r.writing_level||''})),legacy:false};
}
export function submittedPersonalProfile(snapshot) {
 if(!snapshot)return null;
 if(snapshot.profileDetails)return structuredClone(snapshot.profileDetails);
 // Older submissions did not save summary/certification/global-skill fields.
 // Use only facts actually captured then; never substitute the current profile.
 return {name:snapshot.fullName||'',email:snapshot.email||'',phone:snapshot.phone||'',location:locationLabel(snapshot.location||''),summary:null,
  career:list(snapshot.experiences).map(r=>({title:r.jobTitle,company:r.companyName,start:r.startDate,end:r.endDate,current:r.currentRole===true,description:r.responsibilities||'',achievements:r.achievements||''})),
  education:list(snapshot.education).map(r=>({qualification:r.qualification,institution:r.institution,current:r.isCurrentStudy===true,finishedYear:r.graduationYear,expectedEnd:r.endMonth,description:r.description||''})),
  certifications:null,skills:null,languages:list(snapshot.languages).map(r=>({name:r.otherLanguage||languages[r.language]||r.language||'',reading:r.readingLevel?true:null,writing:r.writingLevel?true:null,readingLevel:r.readingLevel||'',writingLevel:r.writingLevel||''})),legacy:true};
}
export async function readCandidateDetails(pool,id) {
 const db=await pool.getConnection();
 try{
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await db.beginTransaction();
  await assertCandidateReadAccess(db,id);
  const [[owner]]=await db.query("SELECT c.candidate_id FROM JRS_CANDIDATE_LINK l JOIN CANDIDATE c ON c.candidate_id=l.canonical_id JOIN MODULE_ACCOUNT a ON a.account_id=c.account_id WHERE l.recruiting_id=? AND a.role='candidate'",[id]);
  const currentProfile=owner?await readPersonalProfile(db,owner.candidate_id):null;
  const [rows]=await db.query('SELECT p.id,p.created_at,l.applicant_snapshot FROM recruiting_application p LEFT JOIN JRS_APPLICATION_LINK l ON l.recruiting_id=p.id WHERE p.candidate_id=?',[id]);
  const applications=rows.map(row=>{const saved=typeof row.applicant_snapshot==='string'?JSON.parse(row.applicant_snapshot):row.applicant_snapshot;return {id:row.id,profileDetails:submittedPersonalProfile(saved),submittedAt:saved?.declarationAcceptedAt||row.created_at};});
  await db.commit();return {currentProfile,applications};
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}
export function candidateDetailsRouter({pool,requireUser}) {
 const router=express.Router();
 router.get('/:id/profile',requireUser,async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await readCandidateDetails(pool,req.params.id));}catch(error){next(error);}});
 router.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status||500).json({error:{message:error.status?error.message:'Candidate information could not be loaded.'}});});
 return router;
}
