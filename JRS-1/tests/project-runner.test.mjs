import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createTestPlan,testEnvironment,runProject} from '../scripts/testing/project-runner.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('default project tests cover each active module without database integration files or migrations',async()=>{
 const plan=await createTestPlan(root,path.join(os.tmpdir(),'jrs-test-report-preview'));
 assert.deepEqual(plan.map(s=>s.id),['integrated','login-profile','applicant','recruiting','hr-client','hr-server']);
 for(const suite of plan){assert.ok(suite.cwd.startsWith(root));assert.ok(!suite.args.some(arg=>/\.mysql\.|\.integration\.|migrate|setup-database/.test(arg)));}
 assert.equal(plan.find(s=>s.id==='applicant').env.DB_MODE,'demo');assert.ok(plan.find(s=>s.id==='integrated').args.some(a=>a.endsWith('applicant-integration.test.mjs')),'Integration adapter unit tests must remain included');
 const all=await createTestPlan(root,path.join(os.tmpdir(),'jrs-test-report-preview'),{all:true});assert.deepEqual(all.slice(-2).map(s=>s.id),['build','english']);
});
test('test processes discard inherited service secrets and hosting targets',()=>{
 const env=testEnvironment({PATH:'node-bin',DB_PASSWORD:'private',DATABASE_URL:'private',MAILJET_SECRET_KEY:'private',SUPABASE_SECRET_KEY:'private',SMTP_PASSWORD:'private',JRS_MAIL_ENV_FILE:'private.env',NODE_ENV:'production',RENDER:'true'});
 assert.deepEqual(env,{PATH:'node-bin',NODE_ENV:'test',FORCE_COLOR:'0'});
});
test('a failing suite is reported, later suites still run and success cannot hide the failure',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jrs-runner-contract-'));
 try{
  for(const [name,body] of [['pass',"import test from 'node:test';test('passing fixture',()=>{});"],['fail',"import test from 'node:test';test('failing fixture',()=>{throw Error('Expected contract fixture failure')});"]])await fs.writeFile(path.join(directory,name+'.mjs'),body);
  const plan=['pass','fail','after'].map(id=>({id,label:id,cwd:directory,args:['--test','--test-reporter=tap',path.join(directory,(id==='fail'?'fail':'pass')+'.mjs')],format:'tap'}));
  const report=await runProject(plan,path.join(directory,'reports'),{environment:{PATH:process.env.PATH}});
  assert.equal(report.status,'failed');assert.deepEqual(report.results.map(r=>r.status),['passed','failed','passed']);assert.equal(report.results[1].counts.failed,1);assert.equal(report.results[2].counts.passed,1);
  const saved=JSON.parse(await fs.readFile(path.join(directory,'reports/summary.json'),'utf8'));assert.equal(saved.status,'failed');assert.match(await fs.readFile(report.results[1].logFile,'utf8'),/Expected contract fixture failure/);
 }finally{assert.equal(path.dirname(directory),os.tmpdir());await fs.rm(directory,{recursive:true,force:true});}
});
