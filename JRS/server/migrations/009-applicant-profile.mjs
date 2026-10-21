// Additive fields retain legacy facts instead of coercing unknown levels or dates.
export async function migrateApplicantProfile(pool) {
 const additions={
  CANDIDATE:{structured_location:'VARCHAR(255) NULL',availability_status:"VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE'"},
  EDUCATION:{qualification_level:'VARCHAR(32) NULL',start_year:'CHAR(4) NULL'},
  LANGUAGE:{language_code:'VARCHAR(16) NULL',reading_level:'VARCHAR(16) NULL',writing_level:'VARCHAR(16) NULL'},
  CAREER_HISTORY:{skill_codes:'JSON NULL',achievements:'TEXT NULL'},
  JRS_APPLICATION_LINK:{applicant_snapshot:'JSON NULL'}
 };
 for(const [table,fields] of Object.entries(additions)){
  const [columns]=await pool.query('SHOW COLUMNS FROM `'+table+'`');const found=new Set(columns.map(c=>c.Field));
  for(const [column,type] of Object.entries(fields))if(!found.has(column))await pool.query('ALTER TABLE `'+table+'` ADD COLUMN `'+column+'` '+type);
 }
 for(const table of ['applicant_profiles','applications']){
  const [columns]=await pool.query('SHOW COLUMNS FROM `'+table+'`');
  if(columns.some(c=>c.Field==='location'&&!/varchar\(255\)/i.test(c.Type)))await pool.query('ALTER TABLE `'+table+'` MODIFY COLUMN location VARCHAR(255) NOT NULL'+(table==='applicant_profiles'?" DEFAULT ''":''));
 }
 const [contactColumns]=await pool.query('SHOW COLUMNS FROM CANDIDATE');
 if(contactColumns.some(c=>c.Field==='contact_number'&&c.Type!=='varchar(40)'))await pool.query("ALTER TABLE CANDIDATE MODIFY COLUMN contact_number VARCHAR(40) NOT NULL DEFAULT ''");
 await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=GREATEST(version,9) WHERE id=1');
}
