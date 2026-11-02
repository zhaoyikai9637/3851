import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {createHash} from 'node:crypto';
import {root,loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {migrateApplicantDeclaration} from '../server/migrations/012-applicant-declaration.mjs';
const target=process.argv[2];
if(!['--test','--local'].includes(target))throw new Error('Choose --test or --local explicitly.');
const name=target==='--test'?'jrs_integrated_test_20261019':'jrs_integrated_dev_20261019';
const settings=loadSettings({env:{...process.env,DB_NAME:name}});assertLocalDatabase(settings);
const pool=mysql.createPool(settings.db);
try{
 const [[identity]]=await pool.query('SELECT DATABASE() AS name');if(identity.name!==name)throw new Error('Unexpected migration target.');
 const [[version]]=await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
 if(![11,12].includes(version?.version))throw new Error('Expected schema 11 or 12.');
 const [rows]=await pool.query('SELECT * FROM applications ORDER BY id');
 const [columns]=await pool.query('SHOW COLUMNS FROM applications');
 const backup=path.join(root,'.local/backups','applicant-update-'+Date.now()+(target==='--test'?'-test':'-local')+'.json');
 await fs.mkdir(path.dirname(backup),{recursive:true});await fs.writeFile(backup,JSON.stringify({database:name,version:version.version,columns,rows},null,2),{flag:'wx',mode:0o600});
 await migrateApplicantDeclaration(pool);
 const fields=columns.map(c=>'`'+c.Field+'`').join(',');
 const [after]=await pool.query('SELECT '+fields+' FROM applications ORDER BY id');
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 if(digest(rows)!==digest(after))throw new Error('Existing application values changed during migration.');
 console.log('Schema 12 ready: '+name+'; '+rows.length+' existing application records verified unchanged. Private backup saved.');
}finally{await pool.end();}
