// Additive and repeatable. Never manufacture historical job snapshots.
export async function migrateApplicationSnapshot(pool) {
  const [[version]] = await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
  if (![6,7].includes(version?.version)) throw new Error('Expected integration schema version 6 or 7.');
  const [columns] = await pool.query("SHOW COLUMNS FROM JRS_APPLICATION_LINK LIKE 'job_snapshot'");
  if (!columns.length) await pool.query('ALTER TABLE JRS_APPLICATION_LINK ADD COLUMN job_snapshot JSON NULL');
  await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=7 WHERE id=1');
}
