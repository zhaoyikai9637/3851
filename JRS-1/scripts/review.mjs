import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import mysql from 'mysql2/promise';
import {prepareEnvironment,readEnvironment,openReviewAdmin,metadata,reviewDirectory,root,childEnvironment,buildIfNeeded} from './review/environment.mjs';
import {initializeReviewSchema,grantReviewApplication} from './review/schema.mjs';
import {seedReviewFixtures} from './review/fixtures.mjs';
const command=process.argv[2]||'help';
try{
 if(Number(process.versions.node.split('.')[0])!==24)throw Error('Use Node.js 24 for this review package.');
 if(command==='setup'){
  console.log('Preparing an isolated local reviewer database on 127.0.0.1:33307...');
  const {settings}=await prepareEnvironment();const admin=await openReviewAdmin(settings,{start:true});
  try{const fresh=await initializeReviewSchema(admin,settings,(await metadata()).adminPassword);if(fresh)await seedReviewFixtures(admin);await grantReviewApplication(admin,settings);}finally{await admin.end();}
  console.log('Review setup ready. Existing review data was retained if already initialized.');
  console.log('Private credentials: .local/review/accounts.json');console.log('Next: npm run review:start');
 }else if(command==='start'){
  const {env,settings}=await readEnvironment();const admin=await openReviewAdmin(settings,{start:true});await admin.end();await buildIfNeeded(env);
  const child=spawn(process.execPath,[path.join(root,'scripts/review-server.mjs')],{cwd:root,env:childEnvironment(env),stdio:'inherit',windowsHide:true});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>{if(code)process.exitCode=code;resolve();});});
 }else if(command==='stop'){
  const {settings}=await readEnvironment();const admin=await openReviewAdmin(settings);try{await admin.query('SHUTDOWN');}finally{await admin.end().catch(()=>{});}console.log('This checkout reviewer MySQL stopped. Files and database were retained.');
 }else if(command==='check'){
  const {settings}=await readEnvironment();const db=await mysql.createConnection(settings.db);try{const [[v]]=await db.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1'),[[m]]=await db.query('SELECT state FROM JRS_REVIEW_SETUP WHERE id=1'),[[j]]=await db.query('SELECT COUNT(*) AS count FROM jobs');if(v.version!==12||m.state!=='READY'||j.count<3)throw Error('Review fixtures are incomplete.');const [grants]=await db.query('SHOW GRANTS FOR CURRENT_USER');for(const row of grants){const grant=String(Object.values(row)[0]);if(!/^GRANT USAGE ON/.test(grant)&&!/^GRANT SELECT, INSERT, UPDATE, DELETE ON `jrs_review_local`\.\*/.test(grant))throw Error('Unexpected reviewer application privileges.');}console.log('Local target, schema 12, fixture marker and application read permissions passed.');}finally{await db.end();}
 }else if(command==='accounts'||command==='mailbox'){
  await readEnvironment();const file=path.join(reviewDirectory,command==='accounts'?'accounts.json':'mailbox.json');console.log(command==='accounts'?'LOCAL REVIEW ACCOUNTS ONLY':'CAPTURED LOCAL MAIL ONLY - NOTHING WAS DELIVERED EXTERNALLY');console.log(await fs.readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT'&&command==='mailbox')return '[]';throw error;}));
 }else console.log('Use review:setup, review:start, review:stop, review:check, review:accounts, review:mailbox or review:verify. See docs/LOCAL_REVIEW.md.');
}catch(error){console.error('Review command stopped:',error.code||error.message);process.exitCode=1;}
