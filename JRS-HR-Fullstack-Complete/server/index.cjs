'use strict';
const mysql=require('mysql2/promise');
const {config}=require('./config.cjs');
const {createRepository}=require('./repository.cjs');
const {createApp}=require('./app.cjs');
const {recoverStaleSends}=require('./recovery.cjs');
async function main() {
  const cfg=config(),pool=mysql.createPool(cfg.db);
  await pool.query('SELECT revision FROM hr_workspace WHERE id=1');
  const repo=createRepository(pool);await recoverStaleSends(repo);
  const timer=setInterval(()=>recoverStaleSends(repo).catch(e=>console.error('Mail status recovery failed:',e.code||e.name)),60000);timer.unref();
  const server=createApp({repo,cfg}).listen(cfg.port,cfg.host,()=>console.log(`JRS HR is ready at ${cfg.origin}. Interview times: Asia/Singapore.`));
  server.requestTimeout=30000;server.headersTimeout=15000;
  async function stop(){clearInterval(timer);server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port is occupied. Change PORT and APP_ORIGIN in .env.':error.message);pool.end();process.exitCode=1;});
}
if(require.main===module)main().catch(error=>{console.error('Startup failed:',error.code||error.message);console.error('Check .env, start MySQL, and run npm run db:init first.');process.exit(1);});
module.exports={main};
