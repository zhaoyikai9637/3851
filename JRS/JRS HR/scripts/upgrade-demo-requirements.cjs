'use strict';
/* Explicit, local-only upgrade of the unchanged legacy demo job requirements.
 * Preview: node --env-file=.env.local scripts/upgrade-demo-requirements.cjs --dry-run
 * Apply:   node --env-file=.env.local scripts/upgrade-demo-requirements.cjs
 * Custom postings and edited requirements are never replaced. Re-running is safe.
 */
const M=require('../dist/state.js');
const R=require('../dist/job-requirements.js');

// Keep the original seed fingerprint here, independent of future seed changes.
const legacy=[
  ['Software Developer','Engineering','Java, React, SQL, REST API, Git'],
  ['UI Designer','Design','Figma, UI Design, Prototyping, Accessibility'],
  ['Data Analyst','Analytics','SQL, Python, Power BI, Data Analysis'],
  ['Marketing Executive','Marketing','SEO, Analytics, Campaigns, Copywriting'],
  ['Support Officer','Customer Success','Communication, CRM, Troubleshooting'],
  ['System Analyst','Technology','SQL, UML, Requirements, Documentation'],
  ['Backend Engineer','Engineering','Node.js, SQL, REST API, Git'],
  ['HR Business Partner','Human Resources','Recruitment, Communication, HRIS'],
  ['DevOps Engineer','Engineering','Docker, Linux, CI/CD, Cloud'],
  ['Finance Executive','Finance','Excel, Accounting, Reporting']
].map(([title,department,skills],i)=>({
  id:'job-'+i,title,department,skills:skills.split(', '),experience:'2+ years',education:'Diploma or Degree',
  requirements:i===0?
    ['Experience with Java or Spring Boot','Frontend experience with React','SQL database and REST API knowledge','Docker or cloud deployment experience']:
    ['Relevant experience in '+department.toLowerCase(),'Strong communication and teamwork','Practical experience with '+skills.split(', ')[0]]
}));
const sameArray=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((item,i)=>item===b[i]);

function planUpgrade(jobs){
  if(!Array.isArray(jobs))throw Error('Jobs must be an array.');
  const counts=new Map();for(const job of jobs)counts.set(job?.id,(counts.get(job?.id)||0)+1);
  const updates=[],skippedShortIds=[];
  for(const job of jobs){
    const expected=legacy.find(row=>row.id===job?.id);
    const unchanged=expected&&counts.get(job.id)===1&&
      ['title','department','experience','education'].every(key=>job[key]===expected[key])&&
      sameArray(job.skills,expected.skills)&&sameArray(job.requirements,expected.requirements);
    if(unchanged){
      updates.push({id:job.id,requirements:R.validate(R.forTitle(job.title))});
    }else if(job&&typeof job.id==='string'&&R.parse(job.requirements).length<R.MIN){
      skippedShortIds.push(job.id);
    }
  }
  return {count:updates.length,updatedIds:updates.map(row=>row.id),skippedShortIds:[...new Set(skippedShortIds)],updates};
}

async function upgradeDemoRequirements(cfg,{dryRun=false}={}){
  if(cfg?.team||!['127.0.0.1','localhost','::1'].includes(cfg?.db?.host)){
    throw Error('Demo requirements upgrade is local-only. Shared and remote databases are never changed.');
  }
  const mysql=require('mysql2/promise');
  const {createRepository}=require('../server/repository.cjs');
  const pool=mysql.createPool(cfg.db),repo=createRepository(pool);
  try{
    // The same workspace lock used by API writes prevents overwriting concurrent edits.
    return await repo.transaction(async conn=>{
      const before=await repo.load(conn),plan=planUpgrade(before.jobs);
      const result={count:plan.count,updatedIds:plan.updatedIds,skippedShortIds:plan.skippedShortIds,dryRun,revisionBefore:before.revision,revisionAfter:before.revision};
      if(dryRun||!plan.count)return result;
      const after=M.clone(before),updates=new Map(plan.updates.map(row=>[row.id,row.requirements]));
      for(const job of after.jobs)if(updates.has(job.id))job.requirements=updates.get(job.id);
      const at=new Date().toISOString();
      after.activity.unshift({id:M.uid('activity'),applicationId:null,summary:'Legacy demo job requirements upgraded',notes:plan.count+' demo postings: '+plan.updatedIds.join(', '),actor:'Local requirements upgrade',actorId:null,at,from:null,to:null});
      after.revision=before.revision+1;after.updatedAt=at;
      M.validate(after);
      await repo.save(conn,before,after);
      result.revisionAfter=after.revision;
      return result;
    },true);
  }finally{await pool.end();}
}

async function main(){
  const flags=process.argv.slice(2);
  if(flags.some(flag=>flag!=='--dry-run'))throw Error('Use --dry-run to preview, or no arguments to apply.');
  const {config}=require('../server/config.cjs');
  const result=await upgradeDemoRequirements(config(),{dryRun:flags.includes('--dry-run')});
  // IDs, counts and revision numbers only; no credentials or applicant information.
  console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main().catch(error=>{console.error('Demo requirements upgrade failed:',error.message);process.exitCode=1;});
module.exports={planUpgrade,upgradeDemoRequirements};
