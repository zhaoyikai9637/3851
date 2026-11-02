export async function migrateInterviewAssessments(pool) {
  const [[version]] = await pool.query("SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1");
  if (![7, 8].includes(version?.version))
    throw new Error("Expected integration schema version 7 or 8.");
  await pool.query(
    "CREATE TABLE IF NOT EXISTS JRS_INTERVIEW_ASSESSMENT (interview_id VARCHAR(96) PRIMARY KEY,criteria JSON NOT NULL,FOREIGN KEY (interview_id) REFERENCES recruiting_interview(id)) ENGINE=InnoDB",
  );
  await pool.execute("UPDATE JRS_INTEGRATION_VERSION SET version=8 WHERE id=1");
}
