import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';import {testEnvironment} from './project-runner.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),cwd=path.join(root,'JRS Login and profile');
const output=process.argv.find(arg=>arg.startsWith('--outputFile='))?.slice(13);
try{
 if(!output)throw Error('Use the project-root test command.');
 const reportPath=path.resolve(output),directory=path.join(path.dirname(reportPath),'login-profile-files');await fs.mkdir(directory,{recursive:true});
 async function find(folder){const files=[];for(const entry of await fs.readdir(folder,{withFileTypes:true})){const item=path.join(folder,entry.name);if(entry.isDirectory())files.push(...await find(item));else if(entry.name.endsWith('.test.js'))files.push(item);}return files;}
 const files=(await find(path.join(cwd,'tests'))).sort();if(!files.length)throw Error('Login/profile tests are missing.');
 const result={success:true,numTotalTests:0,numPassedTests:0,numFailedTests:0,numPendingTests:0,numTotalTestSuites:files.length,numPassedTestSuites:0,numFailedTestSuites:0,testResults:[]};
 for(const [index,file] of files.entries()){
  const perFile=path.join(directory,String(index+1)+'.json');console.log('Isolated Jest file '+(index+1)+'/'+files.length+': '+path.relative(cwd,file));
  const child=spawn(process.execPath,['--experimental-vm-modules',path.join(root,'node_modules/jest/bin/jest.js'),'--runInBand','--ci','--colors=false','--runTestsByPath',file,'--json','--outputFile='+perFile],{cwd,env:testEnvironment(),stdio:'inherit',windowsHide:true,shell:false});
  const status=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('close',code=>resolve(code??1));});
  let report;try{report=JSON.parse(await fs.readFile(perFile,'utf8'));}catch{}
  for(const key of ['numTotalTests','numPassedTests','numFailedTests','numPendingTests'])result[key]+=Number(report?.[key]||0);
  result.testResults.push(...(report?.testResults||[]));
  if(status!==0||!report?.success||!report.numTotalTests){result.success=false;result.numFailedTestSuites++;console.error('Failed isolated file: '+path.relative(cwd,file)+'; exit '+status);}else result.numPassedTestSuites++;
 }
 await fs.writeFile(reportPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log('Login/profile isolated files: '+result.numPassedTests+'/'+result.numTotalTests+' tests passed.');if(!result.success)process.exitCode=1;
}catch(error){console.error('Login/profile tests stopped:',error.message);process.exitCode=1;}
