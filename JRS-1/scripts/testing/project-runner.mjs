import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';

// Only the active integrated modules belong in the default suite. Real database
// migrations, cloud checks and archived standalone copies have separate commands.
export function testEnvironment(source=process.env) {
 const env=Object.fromEntries(Object.entries(source).filter(([key])=>!(/^(DB_|DATABASE_URL$|SMTP_|MAILJET_|SUPABASE_|CANDIDATE_MAIL_|JRS_|MYSQL|SESSION_SECRET$|RESET_SECRET$|NODE_ENV$|HOST$|PORT$|APP_ORIGIN$|ENABLE_|RENDER|RAILWAY_|DOTENV_|NODE_PATH$)/i).test(key)));
 return {...env,NODE_ENV:'test',FORCE_COLOR:'0'};
}
async function nodeTests(directory,suffix) {
 const names=(await fs.readdir(directory)).filter(name=>name.endsWith(suffix)&&!/\.mysql\.|\.integration\./.test(name)).sort();
 if(!names.length)throw Error('No tests found in '+directory);
 return names.map(name=>path.join(directory,name));
}
export async function createTestPlan(root,reportDirectory,{all=false}={}) {
 const vitest=path.join(root,'node_modules/vitest/vitest.mjs');
 const node=(id,label,cwd,files)=>({id,label,cwd,args:['--test','--test-concurrency=2','--test-reporter=tap',...files],format:'tap'});
 const vitestSuite=(id,label,folder)=>({id,label,cwd:path.join(root,folder),args:[vitest,'run','--pool=threads','--maxWorkers=1','--reporter=default','--reporter=json','--outputFile='+path.join(reportDirectory,id+'.json')],format:'json',jsonReport:path.join(reportDirectory,id+'.json')});
 const native=path.join(root,'JRS HR');
 const plan=[
  node('integrated','Integrated boundaries, adapters and shared UI',root,await nodeTests(path.join(root,'tests'),'.test.mjs')),
  {id:'login-profile',label:'Login, recovery and personal profile',cwd:path.join(root,'JRS Login and profile'),args:['--experimental-vm-modules',path.join(root,'node_modules/jest/bin/jest.js'),'--runInBand','--ci','--colors=false','--json','--outputFile='+path.join(reportDirectory,'login-profile.json')],format:'json',jsonReport:path.join(reportDirectory,'login-profile.json')},
  {...node('applicant','Applicant validation and API (demo data)',path.join(root,'JRS Applicant Portal/server'),await nodeTests(path.join(root,'JRS Applicant Portal/server/test'),'.test.js')),env:{DB_MODE:'demo'}},
  node('recruiting','HR recruitment workflow and API',native,await nodeTests(path.join(native,'tests'),'.test.cjs')),
  vitestSuite('hr-client','HR React pages and controls','jrs-hr-module/client'),
  vitestSuite('hr-server','HR communication backend and API','jrs-hr-module/server'),
 ];
 if(all)plan.push(
  {id:'build',label:'Production builds for both React frontends',cwd:root,args:['scripts/build.mjs'],env:{NODE_ENV:'production'}},
  {id:'english',label:'English source and interface checks',cwd:root,args:['scripts/check-english.mjs']},
 );
 return plan;
}
function tapCounts(output) {
 const last=name=>Number([...output.matchAll(new RegExp('^# '+name+' (\\d+)\\s*$','gm'))].at(-1)?.[1]??NaN);
 const total=last('tests');return Number.isFinite(total)?{total,passed:last('pass'),failed:last('fail'),skipped:last('skipped')}:null;
}
export async function runSuite(suite,reportDirectory,{environment=process.env,onProgress=()=>{}}={}) {
 const start=performance.now(),logFile=path.join(reportDirectory,suite.id+'.log');
 const log=createWriteStream(logFile,{flags:'wx',mode:0o600});let output='',spawnFailure;
 const child=spawn(process.execPath,suite.args,{cwd:suite.cwd,env:{...testEnvironment(environment),...suite.env},shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const collect=chunk=>{const text=chunk.toString();log.write(text);output=(output+text).slice(-1024*1024);};
 child.stdout.on('data',collect);child.stderr.on('data',collect);
 const heartbeat=setInterval(()=>onProgress('Still running '+suite.id+' ('+Math.round((performance.now()-start)/1000)+'s)'),30000);heartbeat.unref();
 const outcome=await new Promise(resolve=>{child.once('error',error=>{spawnFailure=error.code||'SPAWN_ERROR';});child.once('close',(code,signal)=>resolve({code,signal}));});
 clearInterval(heartbeat);await new Promise((resolve,reject)=>{log.once('error',reject);log.end(resolve);});
 let counts=null;
 if(suite.format==='tap'){counts=tapCounts(output);if(outcome.code===0&&(!counts||counts.total===0)){outcome.code=1;spawnFailure='NO_TEST_RESULTS';}}
 if(suite.format==='json'){
  try{const result=JSON.parse(await fs.readFile(suite.jsonReport,'utf8'));counts={total:result.numTotalTests,passed:result.numPassedTests,failed:result.numFailedTests,skipped:result.numPendingTests};if(result.success===false||!counts.total)outcome.code=outcome.code||1;}
  catch{if(outcome.code===0)outcome.code=1;spawnFailure??='TEST_REPORT_MISSING';}
 }
 return {id:suite.id,label:suite.label,status:outcome.code===0&&!spawnFailure?'passed':'failed',exitCode:outcome.code,signal:outcome.signal,error:spawnFailure||null,durationSeconds:Number(((performance.now()-start)/1000).toFixed(2)),counts,logFile,...(suite.jsonReport?{jsonReport:suite.jsonReport}:{}),...(outcome.code!==0?{failureTail:output.trim().split(/\r?\n/).slice(-30).join('\n')}:{} )};
}
export async function runProject(plan,reportDirectory,{environment=process.env,onProgress=()=>{}}={}) {
 await fs.mkdir(reportDirectory,{recursive:true});const results=[];
 for(const [index,suite] of plan.entries()){
  onProgress('['+(index+1)+'/'+plan.length+'] '+suite.label);
  const result=await runSuite(suite,reportDirectory,{environment,onProgress});results.push(result);
  onProgress(result.status.toUpperCase()+': '+suite.id+' ('+result.durationSeconds+'s)'+(result.counts?' - '+result.counts.passed+'/'+result.counts.total+' tests passed':''));
  if(result.failureTail)onProgress(result.failureTail);
 }
 const report={at:new Date().toISOString(),node:process.version,status:results.every(r=>r.status==='passed')?'passed':'failed',scope:'Active module unit/API tests; cloud delivery, real MySQL and manual browser acceptance are separate.',results};
 await fs.writeFile(path.join(reportDirectory,'summary.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
 const lines=['# Project test results','', 'Status: '+report.status,'','| Suite | Result | Passed / Total | Seconds |','| --- | --- | --- | --- |',...results.map(r=>'| '+r.id+' | '+r.status+' | '+(r.counts?r.counts.passed+' / '+r.counts.total:'N/A')+' | '+r.durationSeconds+' |'),'','See the adjacent logs for failure details. '+report.scope,''];
 await fs.writeFile(path.join(reportDirectory,'summary.md'),lines.join('\n'),{mode:0o600});
 return report;
}
