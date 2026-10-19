'use strict';

// Static identifiers only. Keep the old graduate_status column for old backups;
// screening now uses the structured qualification fields and graduation date.
const columns=Object.freeze({
  hr_candidate:{
    graduate_status:"VARCHAR(20) NOT NULL DEFAULT 'Not recorded'",
    education_level:"VARCHAR(32) NOT NULL DEFAULT 'Not recorded'",
    education_major:"VARCHAR(150) NOT NULL DEFAULT ''",
    graduation_date:'DATE NULL'
  },
  hr_job_position:{
    minimum_education_level:"VARCHAR(32) NOT NULL DEFAULT 'Not configured'",
    accepted_majors:'JSON NOT NULL DEFAULT (JSON_ARRAY())'
  }
});

async function existingColumns(conn) {
  const [rows]=await conn.query("SELECT TABLE_NAME,COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('hr_candidate','hr_job_position')");
  return new Set(rows.map(row=>row.TABLE_NAME+'.'+row.COLUMN_NAME));
}

function arrayValue(value) {
  const parsed=typeof value==='string'?JSON.parse(value):value;
  return Array.isArray(parsed)?parsed:[];
}

async function backfill(conn) {
  const screening=require('../dist/screening.js');
  const requirements=require('../dist/job-requirements.js');
  let candidateCount=0,jobCount=0;
  await conn.query('START TRANSACTION');
  try {
    // Serialize with ordinary workspace writes; one revision represents the
    // whole data migration, so open clients cannot silently overwrite it.
    await conn.query('SELECT revision FROM hr_workspace WHERE id=1 FOR UPDATE');
    const [candidates]=await conn.query('SELECT id,education,education_level,education_major FROM hr_candidate');
    for(const row of candidates) {
      const inferred=screening.inferLegacyEducation(row.education)||{};
      const hasLevel=inferred.educationLevel&&inferred.educationLevel!=='Not recorded';
      const level=(row.education_level==='Not recorded'||!row.education_level)&&hasLevel?inferred.educationLevel:row.education_level;
      const major=!String(row.education_major||'').trim()&&hasLevel&&inferred.educationMajor?inferred.educationMajor:row.education_major;
      if(level===row.education_level&&major===row.education_major)continue;
      // Never invent a graduation date, even for demonstration applicants.
      await conn.execute('UPDATE hr_candidate SET education_level=?,education_major=? WHERE id=?',[level,major,row.id]);
      candidateCount++;
    }
    const [jobs]=await conn.query('SELECT id,title,education,requirements,minimum_education_level,accepted_majors FROM hr_job_position');
    for(const row of jobs) {
      // Only the untouched, full demonstration posting has known criteria.
      // A familiar title alone is insufficient evidence for a custom job.
      if(!/^job-\d+$/.test(row.id)||row.education!=='Diploma or Degree'||row.minimum_education_level!=='Not configured'||arrayValue(row.accepted_majors).length)continue;
      const template=requirements.forTitle(row.title);
      if(!template.length||JSON.stringify(arrayValue(row.requirements))!==JSON.stringify(template))continue;
      const criteria=screening.defaultJobCriteria(row.title);
      if(!criteria||criteria.minimumEducationLevel==='Not configured'||!Array.isArray(criteria.acceptedMajors))continue;
      await conn.execute('UPDATE hr_job_position SET minimum_education_level=?,accepted_majors=? WHERE id=?',[criteria.minimumEducationLevel,JSON.stringify(criteria.acceptedMajors),row.id]);
      jobCount++;
    }
    if(candidateCount||jobCount)await conn.execute('UPDATE hr_workspace SET revision=revision+1,updated_at=? WHERE id=1',[new Date().toISOString()]);
    await conn.query('COMMIT');
    return {candidates:candidateCount,jobs:jobCount};
  } catch(error) {
    await conn.query('ROLLBACK');
    throw error;
  }
}

async function migrateEligibility(source) {
  // Pool callers must pin a connection: transaction statements cannot be sent
  // through unrelated pooled sessions. The initializer already passes one.
  const acquired=typeof source.getConnection==='function';
  const conn=acquired?await source.getConnection():source;
  try {
    const present=await existingColumns(conn);
    for(const [table,fields] of Object.entries(columns))for(const [name,definition] of Object.entries(fields)) {
      if(!present.has(table+'.'+name))await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
    // ALTER TABLE commits implicitly; apply all logical backfills together only
    // after schema changes are complete. Existing dates/criteria are preserved.
    return await backfill(conn);
  } finally {
    if(acquired)conn.release();
  }
}

async function assertEligibilitySchema(conn) {
  const present=await existingColumns(conn),missing=[];
  for(const [table,fields] of Object.entries(columns))for(const name of Object.keys(fields))if(!present.has(table+'.'+name))missing.push(table+'.'+name);
  if(missing.length)throw Error('Applicant eligibility field is missing: '+missing.join(', ')+'. For a local database run npm run db:init:local; shared databases require the schema coordinator.');
}

module.exports={migrateEligibility,assertEligibilitySchema};
