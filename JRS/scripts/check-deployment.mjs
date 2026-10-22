import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {loadSettings,root,assertDeploymentPolicy} from '../server/config.mjs';
import {checkReadiness} from '../server/readiness.mjs';

let pool;
try {
 const settings=loadSettings();
 assertDeploymentPolicy(settings,{requireMail:process.argv.includes('--require-mail')});
 await fs.access(path.join(root,'jrs-hr-module/client/dist/index.html'));
 if(process.argv.includes('--connect')) {
   pool=mysql.createPool({...settings.db,connectTimeout:5000,connectionLimit:1});
   await checkReadiness({pool,uploadDir:settings.uploadDir});
 }
 console.log(process.argv.includes('--connect')?'Deployment checks passed: configuration, build, schema and storage. SMTP delivery is not tested.':'Offline deployment checks passed: configuration and built assets only. Database, volume and SMTP delivery are not tested.');
 if(!settings.smtp.enabled)console.log('Mail is disabled: password recovery and real email delivery are unavailable. This is not public-release acceptance.');
} catch(error) {
 // Driver errors can contain credentials, hosts and SQL. Log only safe fixed labels.
 const safe=error.message?.startsWith('Deployment requires')||error.message?.startsWith('Set the reviewed')||error.message?.startsWith('Configure and verify production mail');
 console.error('Deployment check failed:',safe?error.message:'Configuration, build, database or storage check failed. Inspect settings privately.');
 process.exitCode=1;
} finally {await pool?.end();}
