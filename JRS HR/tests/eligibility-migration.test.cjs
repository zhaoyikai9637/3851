const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const {migrateEligibility,assertEligibilitySchema}=require('../server/eligibility-schema.cjs');
const S=require('../dist/screening.js');
const R=require('../dist/job-requirements.js');

function fixture({candidates=[],jobs=[],legacy=false}={}){
  const fields={hr_candidate:{graduate_status:'Not recorded',education_level:'Not recorded',education_major:'',graduation_date:null},hr_job_position:{minimum_education_level:'Not configured',accepted_majors:[]}};
  const present=new Set(legacy?[]:Object.entries(fields).flatMap(([table,columns])=>Object.keys(columns).map(column=>table+'.'+column)));
  const db={candidates:structuredClone(candidates),jobs:structuredClone(jobs),revision:7},calls=[];let checkpoint,released=0;
  const conn={async query(sql,p=[]){
    calls.push({sql,p});
    if(sql.includes('INFORMATION_SCHEMA.COLUMNS'))return [[...present].map(x=>{const [TABLE_NAME,COLUMN_NAME]=x.split('.');return {TABLE_NAME,COLUMN_NAME};})];
    if(sql.startsWith('ALTER TABLE')){const [,table,column]=sql.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/);present.add(table+'.'+column);for(const row of table==='hr_candidate'?db.candidates:db.jobs)row[column]=structuredClone(fields[table][column]);return [[]];}
    if(sql==='START TRANSACTION'){checkpoint=structuredClone(db);return [[]];}
    if(sql==='ROLLBACK'){Object.assign(db,checkpoint);return [[]];}
    if(sql==='COMMIT')return [[]];
    if(sql.startsWith('SELECT revision FROM hr_workspace'))return [[{revision:db.revision}]];
    if(sql.startsWith('SELECT id,education,education_level'))return [structuredClone(db.candidates)];
    if(sql.startsWith('SELECT id,title,education,requirements'))return [structuredClone(db.jobs)];
    if(sql.startsWith('UPDATE hr_candidate')){Object.assign(db.candidates.find(c=>c.id===p[2]),{education_level:p[0],education_major:p[1]});return [{}];}
    if(sql.startsWith('UPDATE hr_job_position')){Object.assign(db.jobs.find(j=>j.id===p[2]),{minimum_education_level:p[0],accepted_majors:JSON.parse(p[1])});return [{}];}
    if(sql.startsWith('UPDATE hr_workspace')){db.revision++;return [{}];}
    throw Error('Unexpected migration query: '+sql);
  },release(){released++;}};conn.execute=conn.query;
  return {db,calls,conn,pool:{async getConnection(){return conn;}},get released(){return released;}};
}
function oldJob(extra={}){return {id:'job-0',title:'Software Developer',education:'Diploma or Degree',requirements:R.forTitle('Software Developer'),minimum_education_level:'Not configured',accepted_majors:[],...extra};}
function oldCandidate(extra={}){return {id:'applicant-0',education:'Diploma in Information Technology',education_level:'Not recorded',education_major:'',graduation_date:null,graduate_status:'Experienced',...extra};}

test('schema migration adds missing fields, pins a pool connection and backfills only known facts',async()=>{
  const f=fixture({legacy:true,candidates:[oldCandidate()],jobs:[oldJob()]});
  await assert.rejects(assertEligibilitySchema(f.conn),/missing/);const result=await migrateEligibility(f.pool);await assertEligibilitySchema(f.conn);
  assert.equal(f.released,1);assert.deepEqual(result,{candidates:1,jobs:1});
  assert.equal(f.db.candidates[0].education_level,'Diploma');assert.equal(f.db.candidates[0].education_major,'Information Technology');assert.equal(f.db.candidates[0].graduation_date,null);
  assert.deepEqual({minimumEducationLevel:f.db.jobs[0].minimum_education_level,acceptedMajors:f.db.jobs[0].accepted_majors},S.defaultJobCriteria('Software Developer'));
  assert.equal(f.db.revision,8);assert.equal(f.calls.filter(c=>c.sql.startsWith('ALTER TABLE')).length,6);
  const saved=JSON.stringify(f.db);assert.deepEqual(await migrateEligibility(f.conn),{candidates:0,jobs:0});assert.equal(JSON.stringify(f.db),saved);
});

test('schema migration preserves explicit qualifications and dates and never invents dates for legacy records',async()=>{
  const f=fixture({candidates:[oldCandidate({id:'known',education_level:'Master degree',education_major:'Accounting',graduation_date:'2021-07-15'}),oldCandidate({id:'ambiguous',education:'Diploma or Degree'})],jobs:[oldJob({minimum_education_level:'Doctorate',accepted_majors:['Physics']})]});
  const before=JSON.stringify(f.db);const result=await migrateEligibility(f.conn);assert.deepEqual(result,{candidates:0,jobs:0});assert.equal(JSON.stringify(f.db),before);
});

test('schema migration does not configure custom, edited or ambiguous job criteria just from a familiar title',async()=>{
  const variants=[{id:'custom-role'},{education:'Master degree'},{title:'Senior Software Developer'},{requirements:[...R.forTitle('Software Developer'),'Custom additional requirement.']},{accepted_majors:['Physics']}];
  const f=fixture({jobs:variants.map((variant,i)=>oldJob({...variant,id:variant.id||'job-'+i}))});
  const before=JSON.stringify(f.db);assert.deepEqual(await migrateEligibility(f.conn),{candidates:0,jobs:0});assert.equal(JSON.stringify(f.db),before);
});
