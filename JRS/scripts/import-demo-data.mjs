import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { root, loadSettings } from '../server/config.mjs';
import { namespacePool } from '../server/sql-namespace.mjs';
import { createRecruitmentBridge } from '../server/recruitment-bridge.mjs';
import { saveAssessments } from '../server/interview-assessments.mjs';
import repository from '../JRS HR/server/repository.cjs';
import M from '../JRS HR/dist/state.js';

const prefix = 'demo-20261021-';

function examples() {
  const source = M.seed(), base = source.jobs[0], now = new Date().toISOString();
  const jobs = Array.from({length:100}, (_, index) => ({
    ...base, id:`${prefix}job-${String(index+1).padStart(3,'0')}`,
    title:`Demo Role ${String(index+1).padStart(3,'0')} - Platform and Recruitment Systems Engineer`,
    department:index%2 ? 'Operations' : 'Engineering',
    status:index%2 ? 'Draft' : 'Active',
    description:'Fictional demonstration role for local layout, filtering and pagination checks. Not a real vacancy.',
    createdAt:now,
  }));
  const candidates = ['Pending','Completed'].map((label,index) => ({
    ...source.candidates[0],id:`${prefix}candidate-${index+1}`,name:`Demo ${label} Applicant`,
    email:`demo-${label.toLowerCase()}@example.test`,phone:'',
    notes:'Fictional local demonstration record. No login account or real contact.',createdAt:now,
  }));
  const feedback = {rating:2,recommendation:'Hold',notes:'Fictional assessment: criterion scores do not determine the manual overall rating or hiring decision.',recordedAt:now,
    assessment:['Relevant experience','Technical skills','Communication','Teamwork'].map(label => ({label,rating:4}))};
  const applications = candidates.map((candidate,index) => ({
    ...source.applications[0],id:`${prefix}application-${index+1}`,candidateId:candidate.id,jobId:jobs[0].id,
    stage:index ? 'Interview Results' : 'Interview',appliedDate:M.day(-4),priority:'Normal',
    rejectionReason:'',rejectionConfirmed:false,retentionStartedAt:null,notes:[],offer:null,
    feedback:index ? feedback : null,createdAt:now,
  }));
  const interviews = applications.map((application,index) => ({
    id:`${prefix}interview-${index ? 'completed' : 'pending'}`,applicationId:application.id,
    date:M.day(-2),time:index ? '11:00' : '10:00',duration:45,format:'Video',location:'Demo meeting room',
    interviewer:'Demo Interviewer',notes:'Fictional demonstration interview.',
    status:index ? 'Completed' : 'Scheduled',feedback:index ? feedback : null,
  }));
  return {jobs,candidates,applications,interviews};
}

// The caller owns the transaction. Never overwrite an existing record, including edited demos.
export async function importDemoData(connection) {
  const [[target]] = await connection.query('SELECT DATABASE() AS name,@@port AS port');
  if (Number(target.port)!==3307 || !['jrs_integrated_dev_20261019','jrs_integrated_test_20261019'].includes(target.name))
    throw new Error('Demo import is restricted to the isolated local development/test databases on port 3307.');
  await connection.query('SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE');
  const repo = repository.createRepository(namespacePool(connection));
  const before = await repo.load(namespacePool(connection)), after = M.clone(before), delta = {}, counts = {};
  for (const [key,rows] of Object.entries(examples())) {
    const ids = new Set(before[key].map(row => row.id));
    delta[key] = rows.filter(row => !ids.has(row.id));
    after[key].push(...delta[key]); counts[key] = delta[key].length;
  }
  let publicationsAdded = 0;
  for (const job of after.jobs.filter(row => row.id.startsWith(`${prefix}job-`))) {
    const [[existing]] = await connection.execute('SELECT recruiting_id FROM JRS_JOB_PUBLICATION WHERE recruiting_id=?',[job.id]);
    if (existing) continue;
    const index = Number(job.id.slice(-3))-1;
    await connection.execute(
      'INSERT INTO JRS_JOB_PUBLICATION(recruiting_id,salary_range,closing_date,publish_date,unpublish_date) VALUES(?,?,?,?,NULL)',
      [job.id,index%3 ? 'SGD 5,000 - 6,000' : '', '2031-01-31','2031-01-01'],
    );
    publicationsAdded++;
  }
  if (!Object.values(counts).some(Boolean) && !publicationsAdded) return counts;
  M.validate(after);
  after.revision++; after.updatedAt = new Date().toISOString();
  await repo.save(namespacePool(connection),before,after);
  await saveAssessments(connection,before,after);
  // Mirror only new demo rows: real canonical records are not rewritten.
  await createRecruitmentBridge(connection).mirror(connection,{systemNotifications:[]},{...delta,systemNotifications:[]});
  return counts;
}

async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply to explicitly import fictional demo records.');
  const settings = loadSettings(), pool = mysql.createPool(settings.db);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const repo = repository.createRepository(namespacePool(connection));
    const before = await repo.load(namespacePool(connection));
    const backup = path.join(root,'.local',`before-demo-import-${Date.now()}.json`);
    await fs.mkdir(path.dirname(backup),{recursive:true});
    await fs.writeFile(backup,JSON.stringify(before),{flag:'wx'});
    const counts = await importDemoData(connection);
    await connection.commit();
    console.log(JSON.stringify({database:settings.DB_NAME,inserted:counts,backup},null,2));
  } catch(error) {
    await connection.rollback();
    // Never include SQL parameters or connection credentials in console output.
    console.error('Demo import rolled back:',error.code || error.name);
    process.exitCode=1;
  } finally { connection.release(); await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
