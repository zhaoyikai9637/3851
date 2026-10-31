export async function migrateMailHistory(pool) {
  const [columns]=await pool.query('SHOW COLUMNS FROM recruiting_notification_log');
  if(!columns.some(column=>column.Field==='actor_id')) await pool.query('ALTER TABLE recruiting_notification_log ADD COLUMN actor_id VARCHAR(96) NULL');
  const [canonical]=await pool.query('SHOW COLUMNS FROM NOTIFICATION_LOG');
  if(canonical.some(column=>column.Field==='template_id'&&column.Null==='NO')) await pool.query('ALTER TABLE NOTIFICATION_LOG MODIFY COLUMN template_id INT NULL');
  await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=GREATEST(version,10) WHERE id=1');
}
