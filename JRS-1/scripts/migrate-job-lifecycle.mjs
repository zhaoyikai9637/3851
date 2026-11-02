import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadSettings,assertLocalDatabase,root} from '../server/config.mjs';
import {migrateJobLifecycle} from '../server/migrations/011-job-lifecycle.mjs';
const settings=loadSettings();
assertLocalDatabase(settings);
const db=await mysql.createConnection(settings.db);
try {
 const [jobs]=await db.query('SELECT * FROM recruiting_job_position');
 const [version]=await db.query('SELECT * FROM JRS_INTEGRATION_VERSION');
 const [ddl]=await db.query('SHOW CREATE TABLE recruiting_job_position');
 const directory=path.join(root,'.local/backups');await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(path.join(directory,settings.DB_NAME+'-job-lifecycle-'+Date.now()+'.json'),JSON.stringify({jobs,version,ddl}),{flag:'wx'});
 await migrateJobLifecycle(db);
 console.log('Job lifecycle schema ready; existing job records retained.');
}finally{await db.end();}
