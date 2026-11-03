import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createTestPlan,runProject} from './testing/project-runner.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
try{
 if(Number(process.versions.node.split('.')[0])!==24)throw Error('Use Node.js 24 to run the project tests.');
 const args=process.argv.slice(2);let all=false,list=false,suiteId;
 for(let i=0;i<args.length;i++){if(args[i]==='--all')all=true;else if(args[i]==='--list')list=true;else if(args[i]==='--suite'&&args[i+1])suiteId=args[++i];else throw Error('Unknown argument: '+args[i]);}
 const parent=path.join(root,'.local','test-results');
 let plan=await createTestPlan(root,path.join(parent,'preview'),{all});
 if(suiteId){plan=plan.filter(s=>s.id===suiteId);if(!plan.length)throw Error('Unknown suite: '+suiteId);}
 if(list){for(const suite of plan)console.log(suite.id+': '+suite.label);}
 else{
  await fs.access(path.join(root,'node_modules/jest/bin/jest.js'));await fs.access(path.join(root,'node_modules/vitest/vitest.mjs'));
  await fs.mkdir(parent,{recursive:true});const reportDirectory=await fs.mkdtemp(path.join(parent,'run-'));
  const selected=new Set(plan.map(s=>s.id));plan=(await createTestPlan(root,reportDirectory,{all})).filter(s=>selected.has(s.id));
  console.log('Running project tests. No real database setup or external mail is invoked.');
  const report=await runProject(plan,reportDirectory,{onProgress:line=>console.log(line)});
  await fs.writeFile(path.join(parent,'latest.json'),JSON.stringify({status:report.status,reportDirectory,summary:path.join(reportDirectory,'summary.json')},null,2)+'\n',{mode:0o600});
  console.log('\n'+report.status.toUpperCase()+' - '+report.results.filter(r=>r.status==='passed').length+'/'+report.results.length+' suites passed.');
  console.log('Report: '+path.join(reportDirectory,'summary.md'));
  if(report.status!=='passed')process.exitCode=1;
 }
}catch(error){console.error('Project tests stopped:',error.code==='ENOENT'?'Missing dependency or test file. Run npm ci from the project root.':error.message);process.exitCode=1;}
