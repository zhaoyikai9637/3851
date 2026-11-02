import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadSettings,assertLocalDatabase,assertDeploymentPolicy} from '../server/config.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jrs-deploy-'));
const ca=path.join(directory,'ca.pem');fs.writeFileSync(ca,'fixture CA');
const env={NODE_ENV:'production',DB_MODE:'production',DB_HOST:'production.example.test',DB_EXPECTED_HOST:'production.example.test',DB_PORT:'3306',DB_NAME:'jrs_production',DB_USER:'jrs_production_app',DB_PASSWORD:'fixture-only',DB_SSL_CA_PATH:ca,APP_ORIGIN:'https://jrs.example.test',SESSION_SECRET:'s'.repeat(64),RESET_SECRET:'r'.repeat(64),JRS_DATA_DIR:directory,HOST:'0.0.0.0',PORT:'8080',ENABLE_EXPERIMENTAL_APPLICANT_PORTAL:'false'};
test.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
test('production runtime accepts an isolated target with TLS, injected environment and persistent storage',()=>{
 const settings=loadSettings({env,envFile:null});
 assert.equal(settings.db.database,'jrs_production');
 assert.equal(settings.db.ssl.rejectUnauthorized,true);
 assert.equal(settings.db.ssl.verifyIdentity,true);
 assert.equal(settings.host,'0.0.0.0');assert.equal(settings.port,8080);
 assert.equal(settings.uploadDir,path.join(directory,'uploads'));
 assert.throws(()=>assertLocalDatabase(settings),/isolated local/);
});
test('production refuses shared/admin targets, ephemeral storage and invalid server settings',()=>{
 for(const patch of [{DB_NAME:'jrs_team'},{DB_USER:'root'},{DB_USER:'avnadmin'},{DB_EXPECTED_HOST:'wrong.test'},{DB_SSL_CA_PATH:''},{JRS_DATA_DIR:''},{JRS_DATA_DIR:'relative'},{APP_ORIGIN:'http://jrs.example.test'},{SESSION_SECRET:env.RESET_SECRET},{HOST:'bad host'},{PORT:'0'},{PORT:'NaN'}]) {
   assert.throws(()=>loadSettings({env:{...env,...patch},envFile:null}));
 }
});
test('Railway production refuses a missing or mismatched volume and accepts a provider CA variable',()=>{
 assert.throws(()=>loadSettings({env:{...env,RAILWAY_SERVICE_ID:'fixture-service',RAILWAY_VOLUME_MOUNT_PATH:directory,DB_MODE:'team',DB_NAME:'jrs_team',DB_USER:'jrs_team_app'},envFile:null}),/production database/i);
 for(const RAILWAY_VOLUME_MOUNT_PATH of ['',path.join(directory,'wrong')])assert.throws(()=>loadSettings({env:{...env,RAILWAY_SERVICE_ID:'fixture-service',RAILWAY_VOLUME_MOUNT_PATH},envFile:null}),/volume/i);
 const settings=loadSettings({env:{...env,RAILWAY_SERVICE_ID:'fixture-service',RAILWAY_VOLUME_MOUNT_PATH:directory,DB_SSL_CA_PATH:'',DB_SSL_CA_PEM:'provider CA fixture'},envFile:null});
 assert.equal(settings.db.ssl.ca,'provider CA fixture');assert.equal(settings.db.ssl.rejectUnauthorized,true);
});
test('deployment CLI refuses unsafe configuration without logging private values',()=>{
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-deployment.mjs',import.meta.url))],{encoding:'utf8',env:{...process.env,...env,JRS_ENV_FILE:'',DB_PASSWORD:'DO-NOT-PRINT-PRIVATE',DB_NAME:'jrs_team'}});
 assert.equal(result.status,1);assert.match(result.stderr,/Deployment check failed/);
 assert.doesNotMatch(result.stdout+result.stderr,/DO-NOT-PRINT-PRIVATE|fixture-only|production.example.test/);
});
test('a test deployment can disable mail but cannot pass an explicit public mail acceptance gate',()=>{
 const settings=loadSettings({env:{...env,SMTP_ENABLED:'false'},envFile:null});
 assert.doesNotThrow(()=>assertDeploymentPolicy(settings));
 assert.throws(()=>assertDeploymentPolicy(settings,{requireMail:true}),/mail/i);
 assert.throws(()=>assertDeploymentPolicy({...settings,DB_MODE:'team'}),/production/i);
});
