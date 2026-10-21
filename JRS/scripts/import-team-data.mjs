import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {root,loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {importTables,inspectImport,applyControlledImport} from '../server/controlled-import.mjs';
const [batchPath,approvedDigest]=process.argv.slice(2);
let db;
try{
 if(!batchPath)throw new Error('Usage: node scripts/import-team-data.mjs private-batch.json [approved-preview-sha256]');
 const batch=JSON.parse(await fs.readFile(batchPath,'utf8')),settings=loadSettings();
 if(settings.DB_MODE!=='team')assertLocalDatabase(settings);
 db=await mysql.createConnection(settings.db);
 const [[identity]]=await db.query('SELECT DATABASE() AS target,version FROM JRS_INTEGRATION_VERSION WHERE id=1');
 if(identity.target!==settings.DB_NAME||identity.version!==10)throw new Error('Target must match the reviewed schema-10 runtime configuration.');
 await db.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');await db.beginTransaction();
 const plan=await inspectImport(db,batch);
 const folder=path.join(root,'.local','controlled-imports',String(Date.now()));await fs.mkdir(folder,{recursive:true});
 await fs.writeFile(path.join(folder,'preview.json'),JSON.stringify({target:identity.target,batch,plan},null,2),{flag:'wx'});
 if(approvedDigest){
  // Preserve authoritative business data before any write. The DB transaction is
  // held while the exact preview is rechecked; no update/delete is ever issued.
  const backup={target:identity.target,createdAt:new Date().toISOString(),tables:{}};
  for(const table of importTables)[backup.tables[table]]=await db.query('SELECT * FROM '+db.escapeId(table));
  await fs.writeFile(path.join(folder,'before.json'),JSON.stringify(backup,null,2),{flag:'wx'});
  await applyControlledImport(db,batch,approvedDigest);await db.commit();
  await fs.writeFile(path.join(folder,'receipt.json'),JSON.stringify({target:identity.target,approvedDigest,inserted:plan.inserts.length,skipped:plan.skipped.length,completedAt:new Date().toISOString()},null,2),{flag:'wx'});
 }else await db.rollback();
 console.log(JSON.stringify({mode:approvedDigest?'applied':'preview',target:identity.target,inserts:plan.inserts.length,skipped:plan.skipped.length,conflicts:plan.conflicts.length,digest:plan.digest,reviewDirectory:folder}));
}catch(error){if(db)await db.rollback().catch(()=>{});console.error('Controlled import stopped:',error.code||'REVIEW_REQUIRED',error.code?'Inspect the private input and database constraints.':error.message);process.exitCode=1;}
finally{if(db)await db.end();}
