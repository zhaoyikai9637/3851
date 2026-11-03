import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverRead,resilientPool,resilientSequelize,safeRead} from '../server/database-recovery.mjs';
const reset=()=>Object.assign(new Error('reset'),{code:'ECONNRESET'});
test('safe reads recover once, whereas writes, locked reads and transaction queries never replay',async()=>{
 let calls=0;const driver={execute:async()=>{if(++calls===1)throw reset();return 'ok';}};
 const pool=resilientPool(driver);assert.equal(await pool.execute('SELECT id FROM CANDIDATE WHERE account_id=?',[1]),'ok');assert.equal(calls,2);
 for(const sql of ['UPDATE CANDIDATE SET full_name=?','SELECT id FROM CANDIDATE FOR UPDATE','SELECT GET_LOCK(?,1)']){calls=0;await assert.rejects(pool.execute(sql),/reset/);assert.equal(calls,1);}
 calls=0;await assert.rejects(recoverRead(async()=>{calls++;throw reset();}),/reset/);assert.equal(calls,2);
 let destroyed=0,leases=0;const leasing=resilientPool({getConnection:async()=>({ping:async()=>{if(++leases===1)throw reset();},destroy:()=>destroyed++})});await leasing.getConnection();assert.equal(destroyed,1);assert.equal(leases,2);
});
test('Sequelize retries only autonomous SELECT; constraints and writes remain visible',async()=>{
 let calls=0;const db=resilientSequelize({query:async()=>{if(++calls===1)throw {original:{code:'ECONNRESET'}};return []}});
 await db.query('SELECT * FROM CANDIDATE');assert.equal(calls,2);
 for(const [sql,options] of [['SELECT * FROM CANDIDATE',{transaction:{}}],['INSERT INTO CANDIDATE VALUES (?)',{}]]){calls=0;await assert.rejects(db.query(sql,options));assert.equal(calls,1);}
 let attempts=0;await assert.rejects(recoverRead(async()=>{attempts++;throw {code:'ER_ACCESS_DENIED_ERROR'}}));assert.equal(attempts,1);assert.equal(safeRead('SELECT LAST_INSERT_ID()'),false);
});
