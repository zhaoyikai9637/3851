import mysql from 'mysql2/promise';
import { loadSettings } from '../server/config.mjs';
import { migrateApplicationSnapshot } from '../server/migrations/007-application-snapshot.mjs';
import { migrateInterviewAssessments } from '../server/migrations/008-interview-assessments.mjs';
const settings=loadSettings();
if (!['127.0.0.1','localhost'].includes(settings.db.host) || Number(settings.db.port)!==3307 || !/^jrs_integrated_(dev|test)_\d+$/.test(settings.DB_NAME)) throw new Error('This command is limited to dedicated local integrated databases.');
const pool=mysql.createPool(settings.db);
try { await migrateApplicationSnapshot(pool); await migrateInterviewAssessments(pool); console.log('Application and interview snapshot migrations applied to '+settings.DB_NAME+'. Existing records retained.'); }
finally { await pool.end(); }
