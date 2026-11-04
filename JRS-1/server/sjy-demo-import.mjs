import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import M from '../JRS HR/dist/state.js';
import resumes from '../JRS HR/dist/resume.js';
import repository from '../JRS HR/server/repository.cjs';
import {namespacePool} from './sql-namespace.mjs';
import {createRecruitmentBridge} from './recruitment-bridge.mjs';
const prefix='SJY262-';
const fingerprint='69731f11df388186d75ee5ac5af0823003d4beee89fbb80e722fb649e0ee1dd0';
export async function sjyDemoBatch(){
 if(createHash('sha256').update(M.seed.toString()).digest('hex')!==fingerprint)throw Error('Review the changed SJY seed before import.');
 for(const [file,expected] of [['job-requirements.js','96098dc096154c0752a454d00be89f221236db14972b04679e4d9ab47d9db0a8'],['screening.js','e5f8dc29937a5b92f12de0e46b074c4ca96e7ca783c1a567bcd9cb3649f2ae27']]){const s=(await fs.readFile(new URL('../JRS HR/dist/'+file,import.meta.url),'utf8')).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');if(createHash('sha256').update(s).digest('hex')!==expected)throw Error('Review changed SJY source criteria before import.');}
 const data=M.seed();for(const key of ['jobs','candidates','applications','interviews'])for(const row of data[key])row.id=prefix+row.id;
 for(const a of data.applications){a.jobId=prefix+a.jobId;a.candidateId=prefix+a.candidateId;}
 for(const i of data.interviews)i.applicationId=prefix+i.applicationId;
 data.templates=[];data.notifications=[];data.activity=[];data.mailLogs=[];
 data.systemNotifications=data.applications.slice(0,4).map(a=>({id:prefix+'welcome-'+a.id,applicationId:a.id,title:'Application received: '+data.candidates.find(c=>c.id===a.candidateId).name,eventType:'New Application',sourceModule:'Applications',createdAt:data.createdAt}));
 M.validate(data);return data;
}
export function planSJYDemo(before,batch,resumeIds=[]){
 const keys=['jobs','candidates','applications','interviews','systemNotifications'],counts={},conflicts=[];let existing=0,total=0;
 for(const key of keys){const current=new Map((before[key]||[]).map(r=>[r.id,r]));counts[key]=0;for(const row of batch[key]){total++;if(current.has(row.id))existing++;else counts[key]++;}}
 const resumeSet=new Set(resumeIds);counts.resumes=batch.candidates.filter(c=>!resumeSet.has(c.id)).length;
 const currentEmails=new Map((before.candidates||[]).map(c=>[c.email.trim().toLowerCase(),c.id]));
 for(const c of batch.candidates){const old=currentEmails.get(c.email.toLowerCase());if(old&&old!==c.id)conflicts.push('A sample email already belongs to a different candidate.');if(!/@example\.(com|test)$/i.test(c.email))conflicts.push('Only reserved fictional sample emails are accepted.');}
 if(existing&&existing!==total)conflicts.push('A partial sample cohort exists. Review it before restoring or adding records.');
 if(existing===total&&counts.resumes)conflicts.push('Existing sample resumes are missing. Review before restoring documents.');
 return {source:'SJY HR v2.6.2',counts,existing,conflicts,noop:existing===total&&counts.resumes===0};
}
const tables=[['recruiting_workspace','id'],['recruiting_job_position','id'],['recruiting_candidate','id'],['recruiting_application','id'],['recruiting_interview','id'],['recruiting_interview_feedback','id'],['recruiting_offer','id'],['recruiting_system_notification','id'],['recruiting_resume','candidate_id'],['JRS_JOB_LINK','recruiting_id'],['JRS_CANDIDATE_LINK','recruiting_id'],['JRS_HR_APPLICATION_LINK','recruiting_id'],['JOB_POSITION','position_id'],['CANDIDATE','candidate_id'],['APPLICATION','application_id'],['jobs','id'],['SYSTEM_NOTIFICATION','notification_id']];
async function capture(db){const rows={};for(const [table]of tables)[rows[table]]=await db.query('SELECT * FROM '+table);return rows;}
function assertPreserved(before,after){for(const [table,key]of tables){if(table==='recruiting_workspace')continue;const current=new Map(after[table].map(r=>[String(r[key]),JSON.stringify(r)]));for(const row of before[table])if(current.get(String(row[key]))!==JSON.stringify(row))throw Error('Existing business record changed during import: '+table);}}
async function insert(db,table,columns,rows){if(!rows.length)return;for(let offset=0;offset<rows.length;offset+=200){const chunk=rows.slice(offset,offset+200);await db.execute('INSERT INTO '+table+' ('+columns.map(c=>'`'+c+'`').join(',')+') VALUES '+chunk.map(()=> '('+columns.map(()=>'?').join(',')+')').join(','),chunk.flat());}}
const empty=()=>({jobs:[],candidates:[],applications:[],systemNotifications:[]});
export async function importSJYDemo(pool,{apply=false,backup}={}){
 const batch=await sjyDemoBatch(),db=await pool.getConnection(),ns=namespacePool(db),repo=repository.createRepository(namespacePool(pool));
 try{
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await db.beginTransaction();
  if(apply)await db.query('SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE');
  const before=await repo.load(ns),[files]=await db.query('SELECT candidate_id FROM recruiting_resume'),plan=planSJYDemo(before,batch,files.map(r=>r.candidate_id));
  const addresses=batch.candidates.map(c=>c.email);const [owned]=await db.execute('SELECT email FROM MODULE_ACCOUNT WHERE email IN ('+addresses.map(()=>'?').join(',')+')',addresses);if(owned.length)plan.conflicts.push('A sample address is owned by an existing login account.');
  if(plan.conflicts.length)throw Error(plan.conflicts.join(' '));
  if(!apply||plan.noop){await db.commit();return {...plan,applied:false};}
  if(typeof backup!=='function')throw Error('A durable business-data backup is required.');
  const prior=await capture(db),backupFile=await backup({source:plan.source,createdAt:new Date().toISOString(),counts:plan.counts,rows:prior});
  const flat=repository.flatten(batch);
  for(const key of ['jobs','candidates','applications','interviews','feedbackRows','offerRows','systemNotifications']){const map=repository.maps.find(m=>m.key===key);await insert(db,map.table.replace(/^hr_/,'recruiting_'),map.fields.map(f=>f.col),(flat[key]||[]).map(r=>map.fields.map(f=>{const value=r[f.prop];return value==null?null:f.type==='json'?JSON.stringify(value):f.type==='bool'?Number(!!value):value;})));}
  const bridge=createRecruitmentBridge(pool,{experimentalApplicantPortal:true});await bridge.mirror(db,empty(),{...empty(),jobs:batch.jobs});
  await insert(db,'CANDIDATE',['full_name','email','country_code','contact_number','home_location'],batch.candidates.map(c=>[c.name,c.email,'',c.phone,c.location]));
  const [people]=await db.execute('SELECT candidate_id,email FROM CANDIDATE WHERE email IN ('+addresses.map(()=>'?').join(',')+')',addresses);if(people.length!==batch.candidates.length)throw Error('Sample candidate identity is ambiguous.');const peopleByEmail=new Map(people.map(c=>[c.email,c.candidate_id]));
  await insert(db,'JRS_CANDIDATE_LINK',['recruiting_id','canonical_id'],batch.candidates.map(c=>[c.id,peopleByEmail.get(c.email)]));
  const [jobs]=await db.query("SELECT recruiting_id,canonical_id FROM JRS_JOB_LINK WHERE recruiting_id LIKE 'SJY262-%'"),jobIds=new Map(jobs.map(j=>[j.recruiting_id,j.canonical_id])),candidateIds=new Map(batch.candidates.map(c=>[c.id,peopleByEmail.get(c.email)]));
  const [[owner]]=await db.query("SELECT user_id FROM HR_USER WHERE account_status='ACTIVE' ORDER BY user_id LIMIT 1");if(!owner)throw Error('An active HR profile is required.');
  await insert(db,'APPLICATION',['candidate_id','position_id','assigned_hr_user_id','current_status','applied_at'],batch.applications.map(a=>[candidateIds.get(a.candidateId),jobIds.get(a.jobId),owner.user_id,a.stage,a.appliedDate]));
  const ids=[...candidateIds.values()];const [applications]=await db.execute('SELECT application_id,candidate_id,position_id FROM APPLICATION WHERE candidate_id IN ('+ids.map(()=>'?').join(',')+')',ids);if(applications.length!==batch.applications.length)throw Error('Sample application mapping is ambiguous.');const appIds=new Map(applications.map(a=>[a.candidate_id+':'+a.position_id,a.application_id]));
  await insert(db,'JRS_HR_APPLICATION_LINK',['recruiting_id','canonical_id'],batch.applications.map(a=>[a.id,appIds.get(candidateIds.get(a.candidateId)+':'+jobIds.get(a.jobId))]));
  await bridge.mirror(db,empty(),{...empty(),systemNotifications:batch.systemNotifications});
  const resumeRows=[];for(const c of batch.candidates){const a=batch.applications.find(a=>a.candidateId===c.id),j=batch.jobs.find(j=>j.id===a.jobId),bytes=Buffer.from(await resumes.pdf(c,j).arrayBuffer());resumeRows.push([c.id,c.name.replaceAll(' ','_')+'_Resume.pdf',bytes.length,bytes,batch.createdAt]);}
  await insert(db,'recruiting_resume',['candidate_id','filename','size_bytes','content','uploaded_at'],resumeRows);
  await db.execute('UPDATE recruiting_workspace SET revision=?,updated_at=? WHERE id=1',[before.revision+1,new Date().toISOString()]);
  assertPreserved(prior,await capture(db));await db.commit();return {...plan,applied:true,backupFile};
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}
