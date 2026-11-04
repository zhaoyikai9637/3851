import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import mysql from 'mysql2/promise';
import {root,loadSettings} from '../server/config.mjs';import {repairNotificationTimes} from '../server/notification-time-repair.mjs';
let pool;
try{
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--apply'&&!arg.startsWith('--database=')))throw Error('Use --database=<configured name> and optional --apply.');
 const settings=loadSettings(),target=args.find(arg=>arg.startsWith('--database='))?.slice(11),apply=args.includes('--apply');
 if(target!==settings.DB_NAME)throw Error('Name the exact configured database with --database before inspection or repair.');
 pool=mysql.createPool(settings.db);
 const [[actual]]=await pool.query('SELECT DATABASE() AS name');if(actual.name!==target)throw Error('Connected database does not match the explicit repair target.');
 const result=await repairNotificationTimes(pool,{apply,backup:async changes=>{
  const folder=path.join(root,'.local/notification-time-backups');await fs.mkdir(folder,{recursive:true});
  const file=path.join(folder,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.json');
  await fs.writeFile(file,JSON.stringify({at:new Date().toISOString(),database:target,changes},null,2)+'\n',{flag:'wx',mode:0o600});return file;
 }});
 console.log(JSON.stringify({database:target,mode:apply?'applied':'preview',inspected:result.inspected,proposed:result.changes.length,corrected:result.corrected,skipped:result.skipped.length,backupFile:result.backupFile||null}));
}catch(error){console.error('Timestamp repair stopped:',error.code||error.message);process.exitCode=1;}finally{await pool?.end();}
