import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {randomUUID} from 'node:crypto';
import {loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {migrateApplicantProfile} from '../server/migrations/009-applicant-profile.mjs';
import {migrateMailHistory} from '../server/migrations/010-mail-history.mjs';
const {readApplicantProfile,writeApplicantProfile}=await import('../server/canonical-applicant-profile.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});

test('repeating an older additive migration never lowers the schema version',async()=>{
 const settings=loadSettings();assertLocalDatabase(settings);const pool=mysql.createPool({...settings.db,database:'jrs_integrated_test_20261019'});
 try{
  await migrateMailHistory(pool);await migrateApplicantProfile(pool);
  const [[version]]=await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
  assert.equal(version.version,10);
 }finally{await migrateMailHistory(pool);await pool.end();}
});
test('structured profile edits retain legacy detail, synchronize contacts, and keep submitted material immutable',async()=>{
 assert.equal(typeof readApplicantProfile,'function','Canonical structured profile adapter is missing');
 const settings=loadSettings();assertLocalDatabase(settings);const pool=mysql.createPool({...settings.db,database:'jrs_integrated_test_20261019'});
 await migrateApplicantProfile(pool);const c=await pool.getConnection();
 try{await c.beginTransaction();
  const [account]=await c.execute("INSERT INTO MODULE_ACCOUNT(email,password_hash,role) VALUES(?,?,'candidate')",['sync-'+randomUUID()+'@example.test','unusable-fixture-hash']);
  const [person]=await c.execute('INSERT INTO CANDIDATE(account_id,full_name,email,country_code,contact_number,home_location) VALUES(?,?,?,?,?,?)',[account.insertId,'Profile fixture','fixture@example.test','+65','91234567','Singapore']);
  await c.execute('INSERT INTO EDUCATION(candidate_id,institution,qualification,finished_year,is_current_study,description) VALUES(?,?,?,?,?,?)',[person.insertId,'School','Computing','2025',0,'Historical project detail']);
  await c.execute('INSERT INTO LANGUAGE(candidate_id,language_name,can_read,can_write) VALUES(?,?,?,?)',[person.insertId,'English',1,1]);
  const before=await readApplicantProfile(c,account.insertId);assert.equal(before.phone,'+6591234567');assert.equal(before.languages[0].readingLevel,'');
  await writeApplicantProfile(c,account.insertId,{phone:'+6581234567',location:'["SG","",""]',education:[{institution:'School',qualification:'Computing',qualificationLevel:'BACHELOR',startYear:2021,graduationYear:2025}],languages:[{language:'en',readingLevel:'Intermediate',writingLevel:'Advanced'}]});
  const updated=await readApplicantProfile(c,account.insertId);assert.equal(updated.phone,'+6581234567');assert.equal(updated.education[0].qualificationLevel,'BACHELOR');assert.equal(updated.languages[0].readingLevel,'Intermediate');
  const [[hrPerson]]=await c.execute('SELECT r.phone FROM recruiting_candidate r JOIN JRS_CANDIDATE_LINK l ON l.recruiting_id=r.id WHERE l.canonical_id=?',[person.insertId]);assert.equal(hrPerson?.phone,'+6581234567');
  const [[legacy]]=await c.execute('SELECT country_code,contact_number,home_location FROM CANDIDATE WHERE candidate_id=?',[person.insertId]);assert.equal(legacy.contact_number,'81234567');assert.equal(legacy.country_code,'+65');assert.equal(legacy.home_location,'Singapore');
  const [[oldEducation]]=await c.execute('SELECT description FROM EDUCATION WHERE candidate_id=?',[person.insertId]);assert.equal(oldEducation.description,'Historical project detail');
  await c.execute('INSERT INTO JRS_APPLICATION_LINK(portal_id,recruiting_id,canonical_id,account_id,applicant_snapshot) VALUES(?,?,?,?,?)',[2147480000,'snapshot-fixture',2147480000,account.insertId,JSON.stringify(updated)]);
  await writeApplicantProfile(c,account.insertId,{phone:'+6591234567'});
  const [[saved]]=await c.execute('SELECT applicant_snapshot FROM JRS_APPLICATION_LINK WHERE portal_id=?',[2147480000]);
  const snapshot=typeof saved.applicant_snapshot==='string'?JSON.parse(saved.applicant_snapshot):saved.applicant_snapshot;assert.equal(snapshot.phone,'+6581234567');
 }finally{await c.rollback();c.release();await pool.end();}
});
