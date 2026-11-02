import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSettings } from '../server/config.mjs';
const local={DB_HOST:'127.0.0.1',DB_PORT:'3307',DB_NAME:'jrs_integrated_test_20261019',DB_USER:'test',DB_PASSWORD:'private-test-value',APP_ORIGIN:'http://localhost:3100',SESSION_SECRET:'s'.repeat(64),RESET_SECRET:'r'.repeat(64)};
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jrs-config-'));
const ca=path.join(directory,'ca.pem');fs.writeFileSync(ca,'test certificate fixture');
const team={...local,DB_MODE:'team',DB_HOST:'mysql.example.test',DB_EXPECTED_HOST:'mysql.example.test',DB_PORT:'16401',DB_NAME:'jrs_team',DB_USER:'jrs_team_app',DB_SSL_CA_PATH:ca};
test.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
test('team runtime requires explicit target and verified TLS rather than disabling local safety',()=>{
 const settings=loadSettings({env:team,envFile:null});
 assert.equal(settings.db.host,'mysql.example.test');assert.equal(settings.db.database,'jrs_team');
 assert.equal(settings.db.ssl.rejectUnauthorized,true);assert.equal(settings.db.ssl.verifyIdentity,true);
 assert.equal(settings.db.ssl.ca,'test certificate fixture');assert.equal(settings.production,false);
});
test('cloud configuration fails closed on missing CA, mismatched host, old database or admin account',()=>{
 for(const patch of [{DB_SSL_CA_PATH:''},{DB_EXPECTED_HOST:'other.test'},{DB_NAME:'jrs_hr_module_dev_team'},{DB_USER:'avnadmin'},{DB_MODE:'local'},{DB_PORT:'0'}])assert.throws(()=>loadSettings({env:{...team,...patch},envFile:null}));
});
test('production cookies require HTTPS and invalid public origins cannot be silently normalized',()=>{
 assert.throws(()=>loadSettings({env:{...team,NODE_ENV:'production'},envFile:null}));
 for(const APP_ORIGIN of ['https://example.test/path','https://user:secret@example.test','ftp://example.test'])assert.throws(()=>loadSettings({env:{...team,APP_ORIGIN},envFile:null}));
 assert.equal(loadSettings({env:{...team,NODE_ENV:'production',APP_ORIGIN:'https://jrs.example.test'},envFile:null}).production,true);
});
test('maintenance commands reject cloud configuration before connecting',async()=>{
 const {assertLocalDatabase}=await import('../server/config.mjs');
 assert.doesNotThrow(()=>assertLocalDatabase(loadSettings({env:local,envFile:null})));
 assert.throws(()=>assertLocalDatabase(loadSettings({env:team,envFile:null})),/local/i);
});
