import assert from 'node:assert/strict';
import { test } from 'node:test';
const namespace = await import('../server/sql-namespace.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
test('HR SQL tables cannot collide with canonical HR_USER on Windows MySQL', async () => {
  assert.equal(typeof namespace.namespacePool, 'function', 'Recruitment SQL isolation is missing');
  const calls = [];
  const driver = { async execute(sql, values) { calls.push([sql, values]); return [[{ id: 'team-hr-1' }]]; } };
  const pool = namespace.namespacePool(driver);
  const result = await pool.execute('SELECT * FROM hr_user WHERE id=?', ['team-hr-1']);
  assert.equal(calls[0][0], 'SELECT * FROM recruiting_user WHERE id=?');
  assert.deepEqual(calls[0][1], ['team-hr-1']);
  assert.equal(result[0][0].id, 'team-hr-1');
});
