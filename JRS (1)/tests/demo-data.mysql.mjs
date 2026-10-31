import assert from 'node:assert/strict';
import { test } from 'node:test';
import mysql from 'mysql2/promise';
import { loadSettings } from '../server/config.mjs';
import repository from '../JRS HR/server/repository.cjs';
import { namespacePool } from '../server/sql-namespace.mjs';

const demo = await import('../scripts/import-demo-data.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('demo import retains existing records, persists assessments and skips repeated imports', async () => {
  assert.equal(typeof demo.importDemoData, 'function', 'Persistent demo import is missing');
  const settings = loadSettings();
  const pool = mysql.createPool({...settings.db, database:'jrs_integrated_test_20261019'});
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const repo = repository.createRepository(namespacePool(pool));
    const before = await repo.load(namespacePool(connection));
    const first = await demo.importDemoData(connection);
    assert.deepEqual(first, {jobs:100,candidates:2,applications:2,interviews:2});
    const after = await repo.load(namespacePool(connection));
    for (const key of ['jobs','candidates','applications','interviews']) {
      const oldIds = new Set(before[key].map(row => row.id));
      assert.deepEqual(after[key].filter(row => oldIds.has(row.id)), before[key]);
    }
    assert.equal(after.jobs.length, before.jobs.length+100);
    const [[publication]] = await connection.query("SELECT salary_range FROM JRS_JOB_PUBLICATION WHERE recruiting_id='demo-20261021-job-002'");
    assert.equal(publication.salary_range,'SGD 5,000 - 6,000');
    const [[score]] = await connection.query("SELECT criteria FROM JRS_INTERVIEW_ASSESSMENT WHERE interview_id='demo-20261021-interview-completed'");
    const criteria = typeof score.criteria === 'string' ? JSON.parse(score.criteria) : score.criteria;
    assert.deepEqual(criteria[0], {label:'Relevant experience',rating:4});
    assert.equal(after.interviews.find(row => row.id==='demo-20261021-interview-completed').feedback.rating,2);
    assert.deepEqual(await demo.importDemoData(connection), {jobs:0,candidates:0,applications:0,interviews:0});
    assert.equal((await repo.load(namespacePool(connection))).revision, after.revision);
  } finally {
    await connection.rollback(); connection.release(); await pool.end();
  }
});

test('demo import refuses a non-project database before touching any records', async () => {
  const settings = loadSettings();
  const connection = await mysql.createConnection({...settings.db,database:undefined});
  try { await assert.rejects(demo.importDemoData(connection),/restricted to the isolated local/); }
  finally { await connection.end(); }
});
