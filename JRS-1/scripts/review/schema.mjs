import fs from 'node:fs/promises';
import path from 'node:path';
import {Sequelize} from 'sequelize';
import {root,reviewDirectory} from './environment.mjs';
import {up as createCommunicationSchema} from '../../jrs-hr-module/server/src/migrations/001-module.js';
import {defineModels} from '../../JRS Applicant Portal/server/models/index.js';
import {recruitmentSql} from '../../server/sql-namespace.mjs';
import {migrateApplicationSnapshot} from '../../server/migrations/007-application-snapshot.mjs';
import {migrateInterviewAssessments} from '../../server/migrations/008-interview-assessments.mjs';
import {migrateApplicantProfile} from '../../server/migrations/009-applicant-profile.mjs';
import {migrateMailHistory} from '../../server/migrations/010-mail-history.mjs';
import {migrateJobLifecycle} from '../../server/migrations/011-job-lifecycle.mjs';
import {migrateApplicantDeclaration} from '../../server/migrations/012-applicant-declaration.mjs';
export async function initializeReviewSchema(admin,settings,adminPassword) {
 await admin.query('CREATE DATABASE IF NOT EXISTS `jrs_review_local` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
 await admin.query('USE `jrs_review_local`');
 const [tables]=await admin.query('SHOW TABLES');
 if(tables.length){
  const [[version]]=await admin.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
  const [[review]]=await admin.query('SELECT state,fixture_version FROM JRS_REVIEW_SETUP WHERE id=1');
  if(version?.version!==12||review?.state!=='READY'||review.fixture_version!==1)throw Error('An incomplete or unknown local review database was retained. No automatic reset or reseeding is allowed.');
  return false;
 }
 const orm=new Sequelize('jrs_review_local','root',adminPassword,{dialect:'mysql',host:'127.0.0.1',port:33307,logging:false,define:{underscored:true}});
 try{
  await createCommunicationSchema({context:orm.getQueryInterface()});
  for(const file of ['JRS Login and profile/migrations/001_candidate.sql','JRS HR/database/schema.sql']){
   const raw=await fs.readFile(path.join(root,file),'utf8');
   for(const sql of raw.replace(/^--.*$/gm,'').split(';').map(text=>text.trim()).filter(Boolean))await admin.query(file.startsWith('JRS HR')?recruitmentSql(sql):sql);
  }
  for(const model of Object.values(defineModels(orm)))await model.sync();
  for(const sql of [
   'CREATE TABLE JRS_JOB_LINK (recruiting_id VARCHAR(96) PRIMARY KEY,portal_id INT UNSIGNED NULL UNIQUE,canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB',
   'CREATE TABLE JRS_APPLICATION_LINK (portal_id INT UNSIGNED PRIMARY KEY,recruiting_id VARCHAR(96) NOT NULL UNIQUE,canonical_id INT NOT NULL UNIQUE,account_id INT NOT NULL,withdrawn BOOLEAN NOT NULL DEFAULT FALSE) ENGINE=InnoDB',
   'CREATE TABLE JRS_RESUME_LINK (portal_id INT UNSIGNED PRIMARY KEY,canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB',
   'CREATE TABLE JRS_CANDIDATE_LINK (recruiting_id VARCHAR(96) PRIMARY KEY,canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB',
   'CREATE TABLE JRS_HR_APPLICATION_LINK (recruiting_id VARCHAR(96) PRIMARY KEY,canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB',
   "CREATE TABLE JRS_JOB_PUBLICATION (recruiting_id VARCHAR(96) PRIMARY KEY,salary_range VARCHAR(80) NOT NULL DEFAULT '',closing_date DATE NULL,publish_date DATE NULL,unpublish_date DATE NULL)",
   'CREATE TABLE JRS_INTEGRATION_VERSION (id TINYINT PRIMARY KEY,version INT NOT NULL)',
   'CREATE TABLE JRS_REVIEW_SETUP (id TINYINT PRIMARY KEY,fixture_version INT NOT NULL,state VARCHAR(20) NOT NULL)'
  ])await admin.query(sql);
  const now=new Date().toISOString();await admin.execute('INSERT INTO recruiting_workspace(id,revision,created_at,updated_at) VALUES(1,0,?,?)',[now,now]);
  await admin.query('INSERT INTO JRS_INTEGRATION_VERSION VALUES(1,6)');await admin.query("INSERT INTO JRS_REVIEW_SETUP VALUES(1,1,'SETTING_UP')");
  for(const migrate of [migrateApplicationSnapshot,migrateInterviewAssessments,migrateApplicantProfile,migrateMailHistory,migrateJobLifecycle,migrateApplicantDeclaration])await migrate(admin);
 }finally{await orm.close();}
 return true;
}
export async function grantReviewApplication(admin,settings) {
 for(const host of ['localhost','127.0.0.1']){
  await admin.query("CREATE USER IF NOT EXISTS 'jrs_review_app'@"+admin.escape(host)+' IDENTIFIED BY '+admin.escape(settings.DB_PASSWORD));
  await admin.query("GRANT SELECT,INSERT,UPDATE,DELETE ON `jrs_review_local`.* TO 'jrs_review_app'@"+admin.escape(host));
 }
}
