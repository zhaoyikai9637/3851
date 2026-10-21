import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../server/mail-settings.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('one explicit SMTP configuration enables both mail paths without opening sandbox recipients',()=>{
 assert.equal(typeof mod.mailSettings,'function','Unified SMTP configuration is missing');
 const smtp=mod.mailSettings({SMTP_ENABLED:'true',SMTP_HOST:'smtp.example.test',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'test@example.test',SMTP_PASSWORD:'fixture',SMTP_FROM:'test@example.test',SMTP_MODE:'sandbox',SMTP_RECIPIENT_ALLOWLIST:'test@example.test'});
 const native=mod.recruitmentMailSettings(smtp);assert.equal(native.enabled,true);assert.equal(native.password,'fixture');assert.deepEqual(native.allowlist,['test@example.test']);assert.equal(native.mode,'sandbox');
 assert.throws(()=>mod.mailSettings({SMTP_ENABLED:'true',SMTP_MODE:'typo'}));
 assert.throws(()=>mod.mailSettings({SMTP_ENABLED:'true',SMTP_MODE:'sandbox'}));
 assert.equal(mod.mailSettings({}).enabled,false);
});
