import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createMailer}=require('../JRS Login and profile/server/services/mailer.js');
const smtp={enabled:true,host:'sandbox.example.test',port:587,secure:false,user:'fixture',pass:'fixture',from:'JRS <test@example.test>',mode:'sandbox',allowlist:['test@example.test']};
test('sandbox reset mail sends only to allowlisted inboxes with the full link in the body',async()=>{
 const sent=[],mailer=createMailer({smtp},{transport:{sendMail:async message=>{sent.push(message);return {accepted:[message.to]};}}});
 assert.equal(mailer.ready,true);
 const link='https://jrs.example.test/pages/set-new-password/set-new-password.html#token='+'a'.repeat(64);
 await mailer.sendResetLink('test@example.test',link);
 assert.equal(sent.length,1);assert.ok(sent[0].text.includes(link));assert.ok(!sent[0].subject.includes('a'.repeat(64)));
 await assert.rejects(()=>mailer.sendResetLink('real-person@example.test',link),/allowlist/i);assert.equal(sent.length,1);
});
test('missing SMTP and an empty sandbox allowlist cannot claim recovery is ready',()=>{
 assert.equal(createMailer({smtp:{...smtp,pass:''}}).ready,false);
 assert.equal(createMailer({smtp:{...smtp,allowlist:[]}}).ready,false);
});
