import {createRequire} from 'node:module';
import {formalTemplates} from './formal-mail-templates.mjs';
import {defaultTemplates} from '../jrs-hr-module/server/src/seed.js';
import originalContent from '../jrs-hr-module/server/data/original-content.json' with {type:'json'};
import {createRecruitmentBridge} from './recruitment-bridge.mjs';
const require=createRequire(import.meta.url),nativeSeeds=require('../JRS HR/scripts/database.cjs').templates();
const matches=(row,t)=>row.template_name===t.templateName&&row.usage_type===t.usageType&&row.subject===t.subject&&row.body===t.body;

// The caller owns the transaction and private pre-change backup. Only verified
// seed content can be replaced; names alone never authorize a content overwrite.
export async function installFormalTemplates(connection,actorId){
 const [[actor]]=await connection.execute("SELECT user_id FROM HR_USER WHERE user_id=? AND account_status='ACTIVE' AND role='HR_MANAGER'",[actorId]);
 if(!actor)throw new Error('An active HR Manager must own the template maintenance operation.');
 const [rows]=await connection.query('SELECT * FROM EMAIL_TEMPLATE FOR UPDATE');
 const result={formalCount:formalTemplates.length,created:0,updated:0,archived:[],archivedNative:[]};
 for(const template of formalTemplates){
  const row=rows.find(r=>r.template_name===template.templateName);
  if(row&&matches(row,template)&&row.is_active)continue;
  if(row&&!defaultTemplates.some(t=>matches(row,t))&&!matches(row,template))throw new Error('Custom template requires review before replacement: '+template.templateName);
  if(row){await connection.execute('UPDATE EMAIL_TEMPLATE SET usage_type=?,subject=?,body=?,is_active=1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE template_id=?',[template.usageType,template.subject,template.body,actorId,row.template_id]);result.updated++;}
  else{await connection.execute('INSERT INTO EMAIL_TEMPLATE(template_name,usage_type,subject,body,is_active,created_by,updated_by) VALUES(?,?,?,?,1,?,?)',[template.templateName,template.usageType,template.subject,template.body,actorId,actorId]);result.created++;}
 }
 for(const row of rows)if(row.is_active&&originalContent.templates.some(t=>matches(row,t))){
  await connection.execute('UPDATE EMAIL_TEMPLATE SET is_active=0,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE template_id=?',[actorId,row.template_id]);result.archived.push(row.template_id);
 }
 // Retire the original, exactly matching native seed copies when shared
 // canonical templates become authoritative. Referenced rows remain in place.
 const [native]=await connection.query('SELECT * FROM recruiting_email_template FOR UPDATE');
 for(const row of native)if(row.active&&nativeSeeds.some(t=>t.id===row.id&&t.name===row.name&&t.kind===row.kind&&t.subject===row.subject&&t.body===row.body)){
  await connection.execute('UPDATE recruiting_email_template SET active=0,updated_at=? WHERE id=?',[new Date().toISOString(),row.id]);result.archivedNative.push(row.id);
 }
 await createRecruitmentBridge({}).templates(connection);
 return result;
}
