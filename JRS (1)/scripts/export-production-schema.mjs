import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
import {root,loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {productionSchema} from '../server/production-schema.mjs';
let pool;
try {
 const settings=loadSettings();assertLocalDatabase(settings);
 pool=mysql.createPool({...settings.db,connectionLimit:1});
 const sql=await productionSchema(pool),directory=path.join(root,'.local/deployment');
 await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(path.join(directory,'jrs-production-schema.sql'),sql,{flag:'wx',mode:0o600});
 console.log('Schema-only review artifact: .local/deployment/jrs-production-schema.sql');
 console.log('SHA256:',createHash('sha256').update(sql).digest('hex'));
 console.log('No production connection or account data was used. Import requires a separate reviewed migration step.');
}catch{console.error('Schema export stopped. Check the isolated local target, schema version and output path privately.');process.exitCode=1;}
finally{await pool?.end();}
