'use strict';
// Read-only connectivity/schema check. Never initializes, seeds, or deletes data.
const mysql=require('mysql2/promise');
const {config}=require('../server/config.cjs');
const {maps}=require('../server/repository.cjs');
const required={hr_workspace:['id','revision','created_at','updated_at'],hr_user:['id','email','password_hash','name','role','status','employee_id','department','phone','office_location','created_at'],hr_session:['token_hash','user_id','csrf_token','expires_at'],hr_login_limit:['bucket','attempts','reset_at'],hr_resume:['candidate_id','filename','size_bytes','content','uploaded_at'],hr_notification_read:['notification_id','user_id'],hr_notification_attachment:['id','log_id','filename','content','size_bytes','mime_type'],hr_request:['id','user_id','request_hash','result_json','created_at']};
async function check(cfg){
  let conn;
  try{
    conn=await mysql.createConnection(cfg.db);
    if(cfg.db.ssl){const [rows]=await conn.query("SHOW STATUS LIKE 'Ssl_cipher'");if(!rows[0]?.Value)throw Error('TLS was required but no cipher was negotiated.');console.log('TLS certificate verification: enabled; encrypted connection established.');}
    const [rows]=await conn.query('SELECT TABLE_NAME,COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
    const columns=new Set(rows.map(r=>r.TABLE_NAME+'.'+r.COLUMN_NAME));
    const all={...Object.fromEntries(maps.map(m=>[m.table,m.fields.map(f=>f.col)])),...required};
    const missing=Object.entries(all).flatMap(([table,cols])=>cols.filter(c=>!columns.has(table+'.'+c)).map(c=>table+'.'+c));
    if(missing.length){console.error('Connection succeeded, but this HR module schema is not ready. Missing fields:');console.error(missing.join('\n'));console.error('Give database/schema.sql and docs/TEAM_SETUP.md to the schema coordinator. Do not run db:seed on the team database.');return false;}
    const [[w]]=await conn.query('SELECT revision FROM hr_workspace WHERE id=1');
    if(!w){console.error('HR workspace row is missing; coordinator initialization is required.');return false;}
    console.log('Required tables and fields are available.');
    console.log(cfg.writesEnabled?'Application writes and automatic retention are enabled.':'Shared write confirmations remain empty; mutating API calls and scheduled workers are disabled.');
    return true;
  }catch(e){
    console.error('Database check failed:',e.code||e.name);
    const hints={ENOTFOUND:'Database hostname cannot be resolved. Verify the Aiven service address and service status.',EAI_AGAIN:'DNS lookup failed temporarily. Check the network and retry.',ECONNREFUSED:'Connection refused. Verify the database service and port.',ETIMEDOUT:'Connection timed out. Check network access and service status.',ER_ACCESS_DENIED_ERROR:'Database authentication failed. Verify your personal database account.',ER_BAD_DB_ERROR:'The configured database does not exist. Ask the schema coordinator to verify DB_NAME.'};
    console.error(hints[e.code]||'Check DB_HOST, DB_PORT, personal account details and CA certificate. No data was changed.');return false;
  }finally{if(conn)await conn.end();}
}
if(require.main===module){try{check(config()).then(ok=>{if(!ok)process.exitCode=1;});}catch(e){console.error('Invalid database configuration:',e.message);process.exitCode=1;}}
module.exports={check};
