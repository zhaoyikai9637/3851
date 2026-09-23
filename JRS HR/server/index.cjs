'use strict';
const mysql=require('mysql2/promise');
const {config}=require('./config.cjs');
const {createRepository}=require('./repository.cjs');
const {createApp}=require('./app.cjs');
const {recoverStaleSends}=require('./recovery.cjs');
const {runRetention,assertRetentionSchema}=require('./retention.cjs');
async function main() {
  const cfg=config(),pool=mysql.createPool(cfg.db);
  await pool.query('SELECT revision FROM hr_workspace WHERE id=1');
  await assertRetentionSchema(pool);
  const repo=createRepository(pool),timers=[];
  if(cfg.writesEnabled!==false){
    await recoverStaleSends(repo);await runRetention(repo);
    // Both workers serialize with application changes using the repository lock.
    const recovery=setInterval(()=>recoverStaleSends(repo).catch(e=>console.error('Mail status recovery failed:',e.code||e.name)),60000);recovery.unref();timers.push(recovery);
    const retention=setInterval(()=>runRetention(repo).catch(e=>console.error('Retention cleanup failed:',e.code||e.name)),3600000);retention.unref();timers.push(retention);
  }
  const server=createApp({repo,cfg}).listen(cfg.port,cfg.host,()=>{console.log(`JRS HR is ready at ${cfg.origin}. Interview times: Asia/Singapore.`);if(cfg.writesEnabled===false)console.log('Team database is read-only: login writes and background cleanup are disabled until shared integration is configured. See docs/TEAM_SETUP.md.');});
  server.requestTimeout=30000;server.headersTimeout=15000;
  async function stop(){timers.forEach(clearInterval);server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port is occupied. Change PORT and APP_ORIGIN in .env.':error.message);pool.end();process.exitCode=1;});
}
if(require.main===module)main().catch(error=>{console.error('Startup failed:',error.code||error.message);console.error('Run npm run db:check for a read-only diagnosis. For a shared database, follow docs/TEAM_SETUP.md; local db:init/db:seed must not be used on the team server.');process.exit(1);});
module.exports={main};
