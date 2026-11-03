import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {root,loadSettings} from '../../server/config.mjs';
import {reviewDirectory,assertReviewSettings} from '../../server/review-policy.mjs';
const execute=promisify(execFile);
export const envFile=path.join(root,'.env.review');
const metadataFile=path.join(reviewDirectory,'instance.json');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function prepareEnvironment() {
 await fs.mkdir(reviewDirectory,{recursive:true});
 try{await fs.access(envFile);}catch(error){if(error.code!=='ENOENT')throw error;
  const env={NODE_ENV:'development',DB_MODE:'review',DB_HOST:'127.0.0.1',DB_PORT:'33307',DB_NAME:'jrs_review_local',DB_USER:'jrs_review_app',DB_PASSWORD:randomBytes(24).toString('hex'),HOST:'127.0.0.1',PORT:'3200',APP_ORIGIN:'http://localhost:3200',SESSION_SECRET:randomBytes(48).toString('hex'),RESET_SECRET:randomBytes(48).toString('hex'),JRS_STORAGE_PROVIDER:'local',JRS_DATA_DIR:path.join(reviewDirectory,'data').replaceAll('\\','/'),ENABLE_EXPERIMENTAL_APPLICANT_PORTAL:'false',ENABLE_APPLICANT_PORTAL:'true',CANDIDATE_MAIL_PROVIDER:'smtp',SMTP_ENABLED:'true',SMTP_HOST:'local-capture.invalid',SMTP_PORT:'587',SMTP_SECURE:'false',SMTP_USER:'local-review',SMTP_PASSWORD:'local-capture-only',SMTP_FROM:'jrs-review@example.test',SMTP_MODE:'production'};
  await fs.writeFile(envFile,Object.entries(env).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{flag:'wx',mode:0o600});
 }
 return readEnvironment();
}
export async function readEnvironment() {
 const env=dotenv.parse(await fs.readFile(envFile,'utf8'));assertReviewSettings(env);return {env,settings:loadSettings({env,envFile:null})};
}
export function childEnvironment(env) {
 const result=Object.fromEntries(Object.entries(process.env).filter(([key])=>!(/^(DB_|SMTP_|MAILJET_|SUPABASE_|CANDIDATE_MAIL_|JRS_|MYSQL_|SESSION_SECRET$|RESET_SECRET$|NODE_ENV$|HOST$|PORT$|APP_ORIGIN$|ENABLE_|RENDER|RAILWAY_)/).test(key)));
 return {...result,...env,JRS_ENV_FILE:envFile};
}
export async function findMysqlBinary() {
 const names=process.platform==='win32'?['mysqld.exe']:['mysqld'];const candidates=[];
 if(process.env.MYSQLD_PATH)candidates.push(process.env.MYSQLD_PATH);
 for(const directory of (process.env.PATH||'').split(path.delimiter))for(const name of names)candidates.push(path.join(directory.replace(/^"|"$/g,''),name));
 if(process.platform==='win32')for(const folder of [process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean)){
  const parent=path.join(folder,'MySQL');for(const entry of await fs.readdir(parent,{withFileTypes:true}).catch(()=>[]))if(entry.isDirectory())candidates.push(path.join(parent,entry.name,'bin','mysqld.exe'));
 }
 for(const candidate of [...new Set(candidates)]){try{await fs.access(candidate);const {stdout}=await execute(candidate,['--version'],{windowsHide:true});if(!/MariaDB/i.test(stdout)&&Number(stdout.match(/Ver\s+(\d+)/)?.[1])>=8)return path.resolve(candidate);}catch{}}
 throw Error('MySQL server executable not found. Install MySQL 8+ and put mysqld on PATH, or set MYSQLD_PATH to its executable. No fixed installation path is required.');
}
async function metadata() {return JSON.parse(await fs.readFile(metadataFile,'utf8'));}
async function connect(settings,password){return mysql.createConnection({host:settings.DB_HOST,port:settings.db.port,user:'root',password,connectTimeout:1500});}
async function verifyOwned(connection,meta) {
 const [[row]]=await connection.query('SELECT @@datadir AS directory,@@port AS port');
 const actual=await fs.realpath(path.resolve(row.directory));const expected=await fs.realpath(meta.dataDirectory);
 if((process.platform==='win32'?actual.toLowerCase()!==expected.toLowerCase():actual!==expected)||Number(row.port)!==33307){await connection.end();throw Error('Refusing to manage a MySQL instance outside this checkout review directory.');}
}
export async function openReviewAdmin(settings,{start=false}={}) {
 let meta;try{meta=await metadata();}catch(error){if(error.code!=='ENOENT'||!start)throw error;
  meta={dataDirectory:path.join(reviewDirectory,'mysql'),adminPassword:randomBytes(32).toString('hex'),passwordApplied:false};await fs.writeFile(metadataFile,JSON.stringify(meta,null,2),{flag:'wx',mode:0o600});
 }
 if(path.resolve(meta.dataDirectory)!==path.join(reviewDirectory,'mysql'))throw Error('Review instance marker does not match this checkout.');
 if(start){
  try{const connection=await connect(settings,meta.passwordApplied?meta.adminPassword:'');await verifyOwned(connection,meta);if(!meta.passwordApplied){await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY "+connection.escape(meta.adminPassword));meta.passwordApplied=true;await fs.writeFile(metadataFile,JSON.stringify(meta,null,2),{mode:0o600});}return connection;}catch(error){if(!['ECONNREFUSED','ETIMEDOUT'].includes(error.code))throw error;}
  const binary=await findMysqlBinary();meta.binary=binary;await fs.writeFile(metadataFile,JSON.stringify(meta,null,2),{mode:0o600});
  const ready=await fs.access(path.join(meta.dataDirectory,'auto.cnf')).then(()=>true,()=>false);
  if(!ready){await fs.mkdir(meta.dataDirectory,{recursive:true});if((await fs.readdir(meta.dataDirectory)).length)throw Error('Incomplete review data directory retained. Inspect .local/review/mysql.log; no existing data will be overwritten.');
   await execute(binary,['--no-defaults','--initialize-insecure','--basedir='+path.dirname(path.dirname(binary)),'--datadir='+meta.dataDirectory,'--log-error='+path.join(reviewDirectory,'mysql.log')],{windowsHide:true,timeout:120000});
  }
  const child=spawn(binary,['--no-defaults','--basedir='+path.dirname(path.dirname(binary)),'--datadir='+meta.dataDirectory,'--port=33307','--bind-address=127.0.0.1','--mysqlx=0','--log-error='+path.join(reviewDirectory,'mysql.log'),'--pid-file='+path.join(reviewDirectory,'mysql.pid')],{windowsHide:true,detached:true,stdio:'ignore'});let spawnError;child.once('error',error=>spawnError=error);child.unref();
  for(let n=0;n<100;n++){if(spawnError)throw spawnError;try{const connection=await connect(settings,meta.passwordApplied?meta.adminPassword:'');await verifyOwned(connection,meta);if(!meta.passwordApplied){await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY "+connection.escape(meta.adminPassword));meta.passwordApplied=true;await fs.writeFile(metadataFile,JSON.stringify(meta,null,2),{mode:0o600});}return connection;}catch(error){if(!['ECONNREFUSED','ETIMEDOUT'].includes(error.code))throw error;}await sleep(300);}
  throw Error('Review MySQL did not become ready. Inspect .local/review/mysql.log.');
 }
 const connection=await connect(settings,meta.adminPassword);await verifyOwned(connection,meta);return connection;
}
export async function buildIfNeeded(env) {
 const targets=['JRS Applicant Portal/client/dist/index.html','jrs-hr-module/client/dist/index.html'];
 if((await Promise.all(targets.map(file=>fs.access(path.join(root,file)).then(()=>true,()=>false)))).every(Boolean))return;
 const npm=process.env.npm_execpath;if(!npm)throw Error('Run npm run build before starting the reviewer site.');
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[npm,'run','build'],{cwd:root,env:{...childEnvironment(env),NODE_ENV:'production'},stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Frontend build failed.')));});
}
export {metadata,root,reviewDirectory};
