'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const mysql=require('mysql2/promise');
const M=require('../dist/state.js');
const {config}=require('../server/config.cjs');
const {passwordHash}=require('../server/auth.cjs');
const {createRepository}=require('../server/repository.cjs');
const {email}=require('../server/service.cjs');
const {migrateRetention}=require('../server/retention.cjs');
const localOnly=cfg=>!cfg.team&&['127.0.0.1','localhost','::1'].includes(cfg.db.host);
function emptyState() {return {schemaVersion:2,revision:0,createdAt:new Date().toISOString(),jobs:[],candidates:[],applications:[],interviews:[],tasks:[],notifications:[],activity:[],templates:[],systemNotifications:[],mailLogs:[]};}
function templates() {
  const body={
    'Interview Invite':'Hello {{candidateName}},\n\nWe invite you to interview for {{jobTitle}} on {{date}} at {{time}} (Singapore time, UTC+08:00).\nFormat: {{format}}\nDetails: {{location}}\nInterviewer: {{interviewer}}\n\nBest regards,\n{{hrName}}',
    'Offer Letter':'Hello {{candidateName}},\n\nWe are pleased to offer you the role of {{jobTitle}}.\nMonthly salary: {{currency}} {{salary}}\nStart date: {{startDate}}\nPlease respond by {{expiry}}. Please review your complete offer terms with HR.\n\nBest regards,\n{{hrName}}',
    Accepted:'Hello {{candidateName}},\n\nThank you for accepting our offer for {{jobTitle}}. Our HR team will contact you about onboarding.\n\nBest regards,\n{{hrName}}',
    Rejected:'Hello {{candidateName}},\n\nThank you for your interest in {{jobTitle}}. After careful consideration, we will not be progressing your application for this position. We wish you the best in your job search.\n\nBest regards,\n{{hrName}}',
    'In Progress':'Hello {{candidateName}},\n\nYour application for {{jobTitle}} is being reviewed. We will contact you with the next steps.\n\nBest regards,\n{{hrName}}'
  };
  return Object.entries(body).map(([kind,body],i)=>({id:'template-'+i,name:kind,kind,subject:kind+' — {{jobTitle}}',body,active:true,updatedAt:new Date().toISOString()}));
}
async function initialize(cfg,accounts=[],{coordinator=false}={}) {
  if(!localOnly(cfg)&&!coordinator)throw Error('db:init is local-only. Shared databases require the schema coordinator to review database/schema.sql and run db:migrate.');
  if(!coordinator){
    const {database,connectionLimit,...connectionOptions}=cfg.db,admin=await mysql.createConnection(connectionOptions);
    try {await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);}finally{await admin.end();}
  }
  const pool=mysql.createPool(cfg.db),repo=createRepository(pool);
  try {
    const sql=await fs.readFile(path.join(__dirname,'../database/schema.sql'),'utf8');
    for(const statement of sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean))await pool.query(statement);
    const at=new Date().toISOString();await pool.execute('INSERT IGNORE INTO hr_workspace(id,revision,created_at,updated_at) VALUES (1,0,?,?)',[at,at]);
    const migrationConnection=await pool.getConnection();
    try{await migrateRetention(migrationConnection);}finally{migrationConnection.release();}
    for(const a of accounts) {
      const address=email(a.email),[[existing]]=await pool.execute('SELECT id FROM hr_user WHERE email=?',[address]);if(existing)continue;
      if(!a.password||/^(CHANGE_THIS|YOUR_)/.test(a.password))throw Error('Set a unique ADMIN_PASSWORD (12+ characters) in .env before initializing.');
      await pool.execute('INSERT INTO hr_user(id,email,password_hash,name,role,employee_id,created_at) VALUES (?,?,?,?,?,?,?)',[a.id||M.uid('hr'),address,await passwordHash(a.password),a.name||'HR Officer',a.role,a.employeeId,at]);
    }
    await repo.transaction(async conn=>{const before=await repo.load(conn);if(before.templates.length)return;const after=M.clone(before);after.templates=templates();after.revision++;after.updatedAt=at;await repo.save(conn,before,after);},true);
  } finally {await pool.end();}
}
async function seedDemo(cfg) {
  if(!localOnly(cfg))throw Error('Demo seed is disabled for shared or remote databases. Use an isolated local database for sample data.');
  const pool=mysql.createPool(cfg.db),repo=createRepository(pool);
  try{await repo.transaction(async conn=>{
    const before=await repo.load(conn);if(before.applications.length||before.candidates.length||before.jobs.length)throw Error('Demo seed refused: database already contains HR records. Existing work was preserved.');
    const after={...emptyState(),...M.seed(),templates:before.templates,revision:before.revision+1,updatedAt:new Date().toISOString()};
    after.systemNotifications=after.applications.slice(0,4).map(a=>({id:'welcome-'+a.id,applicationId:a.id,title:'Application received: '+after.candidates.find(c=>c.id===a.candidateId).name,eventType:'New Application',sourceModule:'Applications',createdAt:after.createdAt}));
    await repo.save(conn,before,after);
  },true);}finally{await pool.end();}
}
async function main() {
  const action=process.argv[2];
  const env=action==='migrate'?{...process.env,DB_USER:process.env.MIGRATION_DB_USER,DB_PASSWORD:process.env.MIGRATION_DB_PASSWORD}:process.env;
  const cfg=config(env,{migration:action==='migrate'});
  if(action==='migrate'){
    if(!process.env.MIGRATION_DB_USER||!process.env.MIGRATION_DB_PASSWORD||process.env.DB_SCHEMA_CONFIRMED!==cfg.db.database)throw Error('Schema coordinator: review database/schema.sql and the retention migration first; then supply MIGRATION_DB_USER, MIGRATION_DB_PASSWORD and DB_SCHEMA_CONFIRMED matching DB_NAME for this command only.');
    await initialize(cfg,[],{coordinator:true});console.log('Reviewed schema migration applied. No demo data or login accounts were created.');return;
  }
  if(action==='init') {
    const accounts=[{email:process.env.ADMIN_EMAIL||'hr@jrs.local',password:process.env.ADMIN_PASSWORD,name:process.env.ADMIN_NAME||'Sarah Mitchell',role:'HR_MANAGER',employeeId:'HR-001'}];
    if(process.env.STAFF_EMAIL)accounts.push({email:process.env.STAFF_EMAIL,password:process.env.STAFF_PASSWORD,name:process.env.STAFF_NAME,role:'HR_STAFF',employeeId:'HR-002'});
    await initialize(cfg,accounts);console.log('Database initialized. Existing accounts/data were preserved.');
  } else if(action==='seed'){await seedDemo(cfg);console.log('Added 115 fictional applications, 10 jobs, 24 completed interviews and sample notifications.');}
  else throw Error('Use init, seed or migrate.');
}
if(require.main===module)main().catch(e=>{console.error('Database command failed:',e.message);process.exitCode=1;});
module.exports={initialize,seedDemo,templates,emptyState};
