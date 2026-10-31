import assert from 'node:assert/strict';

// Repeated local integration runs share SQL-backed login buckets. Reset only
// disposable test-schema counters; runtime limits and development data stay intact.
export async function resetTestLoginBuckets(site) {
  assert.equal(site.settings.DB_NAME,'jrs_integrated_test_20261019');
  assert.equal(Number(site.settings.db.port),3307);
  const [[target]]=await site.repository.pool.query('SELECT DATABASE() AS name');
  assert.equal(target.name,'jrs_integrated_test_20261019');
  await site.repository.pool.query('DELETE FROM JRS_RATE_LIMIT');
}
