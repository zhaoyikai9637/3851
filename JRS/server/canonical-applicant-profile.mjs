import {parsePhoneNumberFromString} from 'libphonenumber-js/max';
import {canonicalPhone,locationLabel,canonicalSkills} from '../JRS Applicant Portal/shared/contactFields.js';
import {languageCode,languages} from '../JRS Applicant Portal/shared/applicantFields.js';
import {canonicalLocation} from '../JRS Applicant Portal/server/data/locationFields.js';
import {httpError} from './security.mjs';
import {workFacts} from './applicant-facts.mjs';
const array=value=>typeof value==='string'?JSON.parse(value):value||[];
export function contactColumns(phone,location) {
 const result={};
 if(phone!==undefined){if(!phone){result.country_code='';result.contact_number='';}else{const parsed=parsePhoneNumberFromString(canonicalPhone(phone));result.country_code='+'+parsed.countryCallingCode;result.contact_number=parsed.nationalNumber;}}
 if(location!==undefined){result.structured_location=location?canonicalLocation(location):null;result.home_location=location?locationLabel(result.structured_location):'';}
 return result;
}
export async function readApplicantProfile(db,accountId) {
 const [[c]]=await db.query('SELECT * FROM CANDIDATE WHERE account_id=?',[accountId]);
 if(!c)throw httpError(404,'Candidate profile not found.');
 const [education]=await db.query('SELECT * FROM EDUCATION WHERE candidate_id=? ORDER BY education_id',[c.candidate_id]);
 const [spoken]=await db.query('SELECT * FROM LANGUAGE WHERE candidate_id=? ORDER BY language_id',[c.candidate_id]);
 const [career]=await db.query('SELECT * FROM CAREER_HISTORY WHERE candidate_id=? ORDER BY role_id',[c.candidate_id]);
 const contact=c.contact_number||'';
 return {userId:accountId,phone:contact?(contact.startsWith('+')?contact:(c.country_code||'')+contact):'',location:c.structured_location||c.home_location||'',availabilityStatus:c.availability_status||'AVAILABLE',
  education:education.map(e=>({id:e.education_id,institution:e.institution,qualification:e.qualification,qualificationLevel:e.qualification_level||'',startYear:e.start_year||'',graduationYear:e.finished_year||'',isCurrentStudy:Boolean(e.is_current_study),description:e.description||'',endMonth:e.end_month_year||''})),
  languages:spoken.map(l=>({language:l.language_code||languageCode(l.language_name),readingLevel:l.reading_level||'',writingLevel:l.writing_level||'',...(!Object.hasOwn(languages,languageCode(l.language_name))?{language:'other',otherLanguage:l.language_name}:{})})),
  experiences:career.map(e=>({id:e.role_id,companyName:e.company_name,jobTitle:e.job_title,startDate:e.start_month_year||'',endDate:e.is_current_role?null:e.end_month_year,currentRole:Boolean(e.is_current_role),responsibilities:e.description||'',achievements:e.achievements||'',skills:array(e.skill_codes)}))};
}
// The caller owns the transaction, so contact/list edits and application snapshots
// share the same authorization and commit boundary.
export async function writeApplicantProfile(db,accountId,values) {
 await db.query('SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE');
 const [[c]]=await db.query('SELECT candidate_id FROM CANDIDATE WHERE account_id=? FOR UPDATE',[accountId]);
 if(!c)throw httpError(404,'Candidate profile not found.');
 const contact=contactColumns(values.phone,values.location);
 if(values.availabilityStatus!==undefined)contact.availability_status=values.availabilityStatus;
 const keys=Object.keys(contact);
 if(keys.length)await db.query('UPDATE CANDIDATE SET '+keys.map(k=>'`'+k+'`=?').join(',')+',updated_at=UTC_TIMESTAMP() WHERE candidate_id=?',[...Object.values(contact),c.candidate_id]);
 if(values.education){
  const [old]=await db.query('SELECT * FROM EDUCATION WHERE candidate_id=? ORDER BY education_id FOR UPDATE',[c.candidate_id]);const used=new Set();
  for(const [i,e] of values.education.entries()){
   const previous=old.find(row=>!used.has(row.education_id)&&row.institution===e.institution&&row.qualification===e.qualification)||(!used.has(old[i]?.education_id)?old[i]:null);
   const fields=[e.institution,e.qualification,String(e.graduationYear||'')||null,e.qualificationLevel||null,String(e.startYear||'')||null];
   if(previous){used.add(previous.education_id);await db.query('UPDATE EDUCATION SET institution=?,qualification=?,finished_year=?,qualification_level=?,start_year=? WHERE education_id=? AND candidate_id=?',[...fields,previous.education_id,c.candidate_id]);}
   else{const [inserted]=await db.query('INSERT INTO EDUCATION(candidate_id,institution,qualification,finished_year,qualification_level,start_year) VALUES(?,?,?,?,?,?)',[c.candidate_id,...fields]);used.add(inserted.insertId);}
  }
  for(const row of old)if(!used.has(row.education_id))await db.query('DELETE FROM EDUCATION WHERE education_id=? AND candidate_id=?',[row.education_id,c.candidate_id]);
 }
 if(values.languages){
  await db.query('DELETE FROM LANGUAGE WHERE candidate_id=?',[c.candidate_id]);
  for(const l of values.languages)await db.query('INSERT INTO LANGUAGE(candidate_id,language_name,can_read,can_write,language_code,reading_level,writing_level) VALUES(?,?,?,?,?,?,?)',[c.candidate_id,l.language==='other'?l.otherLanguage:languages[l.language],1,1,l.language,l.readingLevel,l.writingLevel]);
 }
 if(values.experiences){
  const [old]=await db.query('SELECT role_id FROM CAREER_HISTORY WHERE candidate_id=? ORDER BY role_id FOR UPDATE',[c.candidate_id]);
  for(const [i,e] of values.experiences.entries()){
   const fields=[e.jobTitle,e.companyName,e.startDate,e.currentRole?null:e.endDate,e.currentRole,e.responsibilities,JSON.stringify(canonicalSkills(e.skills)),e.achievements||''];
   if(old[i])await db.query('UPDATE CAREER_HISTORY SET job_title=?,company_name=?,start_month_year=?,end_month_year=?,is_current_role=?,description=?,skill_codes=?,achievements=? WHERE role_id=? AND candidate_id=?',[...fields,old[i].role_id,c.candidate_id]);
   else await db.query('INSERT INTO CAREER_HISTORY(candidate_id,job_title,company_name,start_month_year,end_month_year,is_current_role,description,skill_codes,achievements) VALUES(?,?,?,?,?,?,?,?,?)',[c.candidate_id,...fields]);
  }
  for(const row of old.slice(values.experiences.length))await db.query('DELETE FROM CAREER_HISTORY WHERE role_id=? AND candidate_id=?',[row.role_id,c.candidate_id]);
 }
 const profile=await readApplicantProfile(db,accountId);
 if(await syncRecruitmentPerson(db,accountId,profile))await db.query('UPDATE recruiting_workspace SET revision=revision+1 WHERE id=1');
 return profile;
}

export async function syncRecruitmentPerson(db,accountId,profile) {
 const [[c]]=await db.query("SELECT c.*,a.email AS account_email FROM CANDIDATE c JOIN MODULE_ACCOUNT a ON a.account_id=c.account_id WHERE c.account_id=? AND a.role='candidate'",[accountId]);
 if(!c)return false;
 const [[link]]=await db.query('SELECT recruiting_id FROM JRS_CANDIDATE_LINK WHERE canonical_id=?',[c.candidate_id]);
 if(!link && c.availability_status==='CLOSED')return false;
 const id=link?.recruiting_id||`account-${accountId}`;
 const [[old]]=await db.query('SELECT * FROM recruiting_candidate WHERE id=?',[id]);
 profile ||= await readApplicantProfile(db,accountId);
 let facts={experience:0,skills:[]};
 try{facts=workFacts(profile.experiences);}catch{/* Unknown legacy months remain unknown, never inferred. */}
 const values=[c.full_name||'Name not recorded',c.email||c.account_email,profile.phone,locationLabel(profile.location).slice(0,100),facts.experience,profile.education.map(e=>[e.qualification,e.institution].filter(Boolean).join(' · ')).join('; ').slice(0,150)||'Not recorded',JSON.stringify(facts.skills)];
 if(!old){
  await db.query('INSERT INTO recruiting_candidate(id,name,email,phone,location,experience,education,skills,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[id,...values,'',new Date().toISOString()]);
  if(!link)await db.query('INSERT INTO JRS_CANDIDATE_LINK(recruiting_id,canonical_id) VALUES(?,?)',[id,c.candidate_id]);
  return true;
 }
 const before=[old.name,old.email,old.phone,old.location,Number(old.experience),old.education,JSON.stringify(array(old.skills))];
 if(JSON.stringify(before)===JSON.stringify(values))return false;
 await db.query('UPDATE recruiting_candidate SET name=?,email=?,phone=?,location=?,experience=?,education=?,skills=? WHERE id=?',[...values,id]);return true;
}

export async function refreshCanonicalPeople(pool) {
 const db=await pool.getConnection();
 try{await db.beginTransaction();await db.query('SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE');
  const [people]=await db.query("SELECT c.account_id FROM CANDIDATE c JOIN MODULE_ACCOUNT a ON a.account_id=c.account_id WHERE a.role='candidate'");
  let changed=false;for(const person of people)changed=await syncRecruitmentPerson(db,person.account_id)||changed;
  if(changed)await db.query('UPDATE recruiting_workspace SET revision=revision+1 WHERE id=1');await db.commit();
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}
