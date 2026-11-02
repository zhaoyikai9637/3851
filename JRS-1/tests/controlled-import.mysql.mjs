import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mysql from 'mysql2/promise';
import {loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {inspectImport,applyControlledImport} from '../server/controlled-import.mjs';
test('real SQL business import previews without writes, inserts reviewed data and rejects stale or conflicting plans',async()=>{
 const settings=loadSettings();assertLocalDatabase(settings);
 const db=await mysql.createConnection({...settings.db,database:'jrs_integrated_test_20261019'});
 try{
  await db.beginTransaction();
  const [[max]]=await db.query('SELECT COALESCE(MAX(candidate_id),0)+1 AS id FROM CANDIDATE');
  const email='import-'+randomUUID()+'@example.test';
  const batch={rows:{CANDIDATE:[{candidate_id:max.id,full_name:'Import fixture',email,account_id:null}]}};
  const plan=await inspectImport(db,batch);assert.deepEqual(plan.conflicts,[]);
  const [[before]]=await db.execute('SELECT COUNT(*) AS n FROM CANDIDATE WHERE email=?',[email]);assert.equal(before.n,0);
  await assert.rejects(applyControlledImport(db,batch,'stale'),/digest/);
  await applyControlledImport(db,batch,plan.digest);
  const [[saved]]=await db.execute('SELECT full_name FROM CANDIDATE WHERE email=?',[email]);assert.equal(saved.full_name,'Import fixture');
  await assert.rejects(applyControlledImport(db,batch,plan.digest),/digest/);
  const conflict={rows:{CANDIDATE:[{...batch.rows.CANDIDATE[0],full_name:'Must not overwrite'}]}};
  const refused=await inspectImport(db,conflict);await assert.rejects(applyControlledImport(db,conflict,refused.digest),/conflicts/);
  const [[unchanged]]=await db.execute('SELECT full_name FROM CANDIDATE WHERE email=?',[email]);assert.equal(unchanged.full_name,'Import fixture');
 }finally{await db.rollback();await db.end();}
});
