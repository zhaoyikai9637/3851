import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {mailSettings} from './mail-settings.mjs';
export const root = fileURLToPath(new URL('../', import.meta.url));
export function assertDeploymentPolicy(settings,{requireMail=false}={}) {
  if(!settings.production||settings.DB_MODE!=='production')throw new Error('Deployment requires the isolated production target.');
  if(settings.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL!=='false')throw new Error('Set the reviewed applicant portal boundary explicitly to false.');
  if(requireMail&&(!settings.smtp.enabled||settings.smtp.mode!=='production'))throw new Error('Configure and verify production mail before public invitation.');
}
export function assertLocalDatabase(settings) {
  if (settings.DB_MODE === 'team' || !['127.0.0.1', 'localhost'].includes(settings.DB_HOST) || !['jrs_integrated_dev_20261019', 'jrs_integrated_test_20261019'].includes(settings.DB_NAME) || Number(settings.DB_PORT) !== 3307) throw new Error('Maintenance and tests require an isolated local JRS database on port 3307.');
}
export function loadSettings({env: overrides = process.env, envFile = process.env.JRS_ENV_FILE ?? (fs.existsSync(path.join(root,'.env')) ? path.join(root,'.env') : null)} = {}) {
  const base = envFile ? dotenv.parse(fs.readFileSync(envFile)) : {};
  const mailFile = overrides.JRS_MAIL_ENV_FILE || base.JRS_MAIL_ENV_FILE;
  const privateMail = mailFile ? dotenv.parse(fs.readFileSync(path.resolve(root,mailFile))) : {};
  if(Object.keys(privateMail).some(key=>!key.startsWith('SMTP_')))throw new Error('The private mail file may contain SMTP settings only.');
  const env = {...base,...privateMail,...overrides};
  if(env.SMTP_PASSWORD_FILE)env.SMTP_PASSWORD=fs.readFileSync(path.resolve(root,env.SMTP_PASSWORD_FILE),'utf8').replace(/\r?\n$/,'');
  let ssl;
  if(['team','production'].includes(env.DB_MODE)) {
    const target=env.DB_MODE==='production'?['jrs_production','jrs_production_app']:['jrs_team','jrs_team_app'];
    if(!env.DB_HOST || env.DB_HOST !== env.DB_EXPECTED_HOST || ['127.0.0.1','localhost'].includes(env.DB_HOST) || env.DB_NAME !== target[0] || env.DB_USER !== target[1] || !env.DB_PASSWORD || !Number.isInteger(Number(env.DB_PORT)) || Number(env.DB_PORT)<1 || Number(env.DB_PORT)>65535 || !(env.DB_SSL_CA_PATH||env.DB_SSL_CA_PEM)) throw new Error('Cloud runtime requires the explicit isolated target, restricted runtime account and a trusted CA.');
    ssl = { ca:env.DB_SSL_CA_PEM||fs.readFileSync(path.resolve(root,env.DB_SSL_CA_PATH),'utf8'), rejectUnauthorized:true, verifyIdentity:true };
  } else {
    if(env.DB_MODE && env.DB_MODE !== 'local') throw new Error('Unknown database mode.');
    assertLocalDatabase(env);
  }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || !env.RESET_SECRET || env.RESET_SECRET.length < 32 || (env.NODE_ENV==='production'&&env.SESSION_SECRET===env.RESET_SECRET)) throw new Error('Configure independent private session and reset secrets of at least 32 characters.');
  const origin = new URL(env.APP_ORIGIN), production = env.NODE_ENV === 'production';
  if(!['http:','https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (production && origin.protocol !== 'https:')) throw new Error('Configure a public HTTP(S) origin without a path; production requires HTTPS.');
  const port=Number(env.PORT || 3100),host=env.HOST || (production?'0.0.0.0':'127.0.0.1');
  if(!Number.isInteger(port)||port<1||port>65535||!['0.0.0.0','127.0.0.1','::'].includes(host))throw new Error('Configure a valid server HOST and PORT.');
  if(env.DB_MODE==='production'&&(!production||!env.JRS_DATA_DIR||!path.isAbsolute(env.JRS_DATA_DIR)))throw new Error('Production database mode requires NODE_ENV=production and an absolute persistent JRS_DATA_DIR.');
  if(env.DB_MODE==='production'&&env.RAILWAY_SERVICE_ID&&(!env.RAILWAY_VOLUME_MOUNT_PATH||path.resolve(env.RAILWAY_VOLUME_MOUNT_PATH)!==path.resolve(env.JRS_DATA_DIR)))throw new Error('Attach a Railway volume at the configured JRS_DATA_DIR before deployment.');
  if(production&&!['team','production'].includes(env.DB_MODE))throw new Error('Production cannot use a local test database.');
  if(production&&env.RAILWAY_SERVICE_ID&&env.DB_MODE!=='production')throw new Error('Railway requires the isolated production database mode.');
  const uploadDir=env.JRS_DATA_DIR?path.join(path.resolve(env.JRS_DATA_DIR),'uploads'):path.join(root,'.local/resumes');
  return { ...env, production, origin:origin.origin, port, host,uploadDir,
    smtp:mailSettings(env),
    db: { host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, timezone: 'Z', dateStrings: true, multipleStatements: false, connectionLimit: 8, ...(ssl ? {ssl} : {}) } };
}
