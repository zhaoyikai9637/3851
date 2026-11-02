import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {migrateApplicantDeclaration} from '../server/migrations/012-applicant-declaration.mjs';
test('declaration migration preserves existing applications and remains repeatable on the isolated test schema',async()=>{
 const settings=loadSettings({env:{...process.env,DB_NAME:'jrs_integrated_test_20261019'}});assertLocalDatabase(settings);
 const pool=mysql.createPool(settings.db);
 try{
  const [before]=await pool.query('SELECT id,user_id,job_id,resume_id,experiences,role_answers,status FROM applications ORDER BY id');
  await migrateApplicantDeclaration(pool);await migrateApplicantDeclaration(pool);
  const [after]=await pool.query('SELECT id,user_id,job_id,resume_id,experiences,role_answers,status FROM applications ORDER BY id');assert.deepEqual(after,before);
  const [columns]=await pool.query('SHOW COLUMNS FROM applications');
  assert.equal(columns.find(c=>c.Field==='declaration_accepted').Default,'0');assert.equal(columns.find(c=>c.Field==='declaration_accepted_at').Null,'YES');
  const [[version]]=await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');assert.equal(version.version,12);
 }finally{await pool.end();}
});
