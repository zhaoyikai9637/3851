// Additive and resumable; historical consent is never manufactured.
export async function migrateApplicantDeclaration(pool) {
 const [[version]]=await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
 if(![11,12].includes(version?.version))throw new Error('Applicant declaration migration requires schema 11 or 12.');
 const [columns]=await pool.query('SHOW COLUMNS FROM applications');
 if(!columns.some(c=>c.Field==='declaration_accepted'))await pool.query('ALTER TABLE applications ADD COLUMN declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE');
 if(!columns.some(c=>c.Field==='declaration_accepted_at'))await pool.query('ALTER TABLE applications ADD COLUMN declaration_accepted_at DATETIME NULL');
 await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=12 WHERE id=1');
}
