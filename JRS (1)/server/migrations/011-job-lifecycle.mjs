// Additive enum expansion preserves the meaning and data of existing jobs.
export async function migrateJobLifecycle(pool) {
 const [[version]]=await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
 if(version.version>=11)return;
 if(version.version!==10)throw new Error('Job lifecycle migration requires schema 10.');
 await pool.query("ALTER TABLE recruiting_job_position MODIFY status ENUM('Active','Draft','Closed','Stopped') NOT NULL");
 await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=11 WHERE id=1');
}
