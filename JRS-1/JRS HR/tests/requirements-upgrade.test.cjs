const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const R=require('../dist/job-requirements.js');
const {planUpgrade,upgradeDemoRequirements}=require('../scripts/upgrade-demo-requirements.cjs');

function legacyJobs(){
  return [
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
  ].map(([title,department,skills],i)=>({id:'job-'+i,title,department,skills:skills.split(', '),experience:'2+ years',education:'Diploma or Degree',type:'Full-time',status:'Active',location:'Singapore',mode:'On-site',description:'Description to preserve.',createdAt:'2026-01-01T00:00:00.000Z',requirements:i===0?['Experience with Java or Spring Boot','Frontend experience with React','SQL database and REST API knowledge','Docker or cloud deployment experience']:['Relevant experience in '+department.toLowerCase(),'Strong communication and teamwork','Practical experience with '+skills.split(', ')[0]]}));
}

test('requirements upgrade plans the ten original demo postings without changing its input',()=>{
  const jobs=legacyJobs(),before=JSON.stringify(jobs),plan=planUpgrade(jobs);
  assert.equal(plan.count,10);assert.deepEqual(plan.updatedIds,jobs.map(job=>job.id));assert.deepEqual(plan.skippedShortIds,[]);
  for(const update of plan.updates){
    assert.equal(update.requirements.length,10);
    assert.deepEqual(update.requirements,R.forTitle(jobs.find(job=>job.id===update.id).title));
    R.validate(update.requirements);
  }
  assert.equal(JSON.stringify(jobs),before);
});

test('requirements upgrade preserves edited criteria and custom postings even with a matching demo title',()=>{
  const mutations=[
    job=>job.id='custom-job',job=>job.title='Senior Software Developer',job=>job.department='Platform',
    job=>job.skills.push('TypeScript'),job=>job.skills.reverse(),job=>job.experience='5+ years',
    job=>job.education='Degree',job=>job.requirements.push('Commercial TypeScript experience'),
    job=>job.requirements[0]='Custom Java experience',job=>job.requirements.reverse(),
    job=>job.requirements=job.requirements.join('\n')
  ];
  for(const mutate of mutations){
    const job=legacyJobs()[0];mutate(job);const before=JSON.stringify(job),plan=planUpgrade([job]);
    assert.equal(plan.count,0);assert.deepEqual(plan.skippedShortIds,[job.id]);assert.equal(JSON.stringify(job),before);
  }
});

test('requirements upgrade changes requirements only and leaves subsequent runs empty',()=>{
  const jobs=legacyJobs();jobs[0].description='Edited description';jobs[0].location='A different office';jobs[0].status='Closed';
  const before=structuredClone(jobs),plan=planUpgrade(jobs);
  const after=jobs.map(job=>({...job,requirements:plan.updates.find(update=>update.id===job.id).requirements}));
  for(let i=0;i<after.length;i++)assert.deepEqual({...after[i],requirements:before[i].requirements},before[i]);
  assert.equal(planUpgrade(after).count,0);assert.deepEqual(planUpgrade(after).skippedShortIds,[]);
});

test('requirements upgrade reports short custom lists but does not overwrite complete or ambiguous postings',()=>{
  const job=legacyJobs()[0],duplicate=structuredClone(job),complete={...legacyJobs()[1],id:'custom-complete',requirements:R.forTitle('UI Designer')};
  const plan=planUpgrade([job,duplicate,complete,{id:'short-custom',title:'Custom',requirements:['Existing custom criterion']}]);
  assert.equal(plan.count,0);assert.deepEqual(plan.skippedShortIds,['job-0','short-custom']);
  assert.throws(()=>planUpgrade(null),/array/);
});

test('requirements upgrade refuses team and remote configs before opening a connection, including dry runs',async()=>{
  for(const dryRun of [false,true])for(const cfg of [
    {team:true,db:{host:'127.0.0.1'}},{team:false,db:{host:'remote.example.invalid'}},
    {team:false,db:{host:'127.0.0.1.example.invalid'}},{team:false,db:{host:'192.168.1.5'}},{}
  ])await assert.rejects(upgradeDemoRequirements(cfg,{dryRun}),/local-only/);
});
