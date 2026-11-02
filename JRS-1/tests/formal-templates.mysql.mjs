import test from 'node:test';import assert from 'node:assert/strict';import mysql from 'mysql2/promise';import {randomUUID} from 'node:crypto';
import {loadSettings,assertLocalDatabase} from '../server/config.mjs';
import {formalTemplates} from '../server/formal-mail-templates.mjs';
import originalContent from '../jrs-hr-module/server/data/original-content.json' with {type:'json'};
const {installFormalTemplates}=await import('../server/install-formal-templates.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('formal template installation archives only verified seeds and preserves logs and custom JRS content',async()=>{
 assert.equal(typeof installFormalTemplates,'function','Safe template installer is missing');
 const settings=loadSettings();assertLocalDatabase(settings);const db=await mysql.createConnection({...settings.db,database:'jrs_integrated_test_20261019'});
 try{
  await db.beginTransaction();const [[hr]]=await db.query("SELECT user_id FROM HR_USER WHERE account_status='ACTIVE' ORDER BY user_id LIMIT 1");
  const name='JRS custom '+randomUUID();
  const [custom]=await db.execute('INSERT INTO EMAIL_TEMPLATE(template_name,usage_type,subject,body,is_active,created_by,updated_by) VALUES(?,?,?,?,1,?,?)',[name,'IN_PROGRESS','Custom subject','Custom content',hr.user_id,hr.user_id]);
  const [before]=await db.query('SELECT * FROM NOTIFICATION_LOG ORDER BY log_id');
  const result=await installFormalTemplates(db,hr.user_id);
  assert.equal(result.formalCount,10);
  const [[untouched]]=await db.execute('SELECT * FROM EMAIL_TEMPLATE WHERE template_id=?',[custom.insertId]);assert.equal(untouched.is_active,1);assert.equal(untouched.body,'Custom content');
  const [active]=await db.query('SELECT * FROM EMAIL_TEMPLATE WHERE is_active=1');assert.equal(active.filter(t=>formalTemplates.some(f=>f.templateName===t.template_name)).length,10);
  const [after]=await db.query('SELECT * FROM NOTIFICATION_LOG ORDER BY log_id');assert.deepEqual(after,before);
  const [seedRows]=await db.query("SELECT * FROM EMAIL_TEMPLATE WHERE template_name LIKE 'JRS%'");assert.ok(seedRows.filter(t=>originalContent.templates.some(s=>s.templateName===t.template_name&&s.body===t.body)).every(t=>t.is_active===0));
  const repeated=await installFormalTemplates(db,hr.user_id);assert.equal(repeated.created,0);assert.equal(repeated.updated,0);assert.equal(repeated.archived.length,0);
 }finally{await db.rollback();await db.end();}
});
