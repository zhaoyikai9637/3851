import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateMailSettings,createCandidateRecoveryMailer} from '../server/candidate-mail.mjs';
const env={CANDIDATE_MAIL_PROVIDER:'mailjet',MAILJET_API_KEY:'a'.repeat(32),MAILJET_SECRET_KEY:'b'.repeat(32),MAILJET_FROM_EMAIL:'sender@example.test',CANDIDATE_MAIL_ALLOWLIST:'recipient@example.test'};
const settings=candidateMailSettings(env);
test('Mailjet configuration requires explicit credentials and sandbox recipients',()=>{
 assert.equal(candidateMailSettings({}).provider,'smtp');
 for(const field of ['MAILJET_API_KEY','MAILJET_SECRET_KEY','MAILJET_FROM_EMAIL','CANDIDATE_MAIL_ALLOWLIST'])assert.throws(()=>candidateMailSettings({...env,[field]:''}));
 assert.throws(()=>candidateMailSettings({...env,CANDIDATE_MAIL_PROVIDER:'unknown'}));
});
test('candidate code uses fixed HTTPS endpoint and HR handlers remain unchanged',async()=>{
 const hr=async()=>{},base={ready:false,sendHrAssistance:hr};let captured;
 const mailer=createCandidateRecoveryMailer(base,settings,{fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({Messages:[{Status:'success',To:[{Email:'recipient@example.test'}]}]})};}});
 assert.equal(mailer.sendHrAssistance,hr);assert.equal(mailer.ready,false);assert.equal(mailer.candidateCodeReady,true);
 await mailer.sendCode('recipient@example.test','1234');
 assert.equal(captured.url,'https://api.mailjet.com/v3.1/send');assert.equal(captured.options.redirect,'error');
 assert.equal(captured.options.headers.Authorization,'Basic '+Buffer.from('a'.repeat(32)+':'+ 'b'.repeat(32)).toString('base64'));
 const payload=JSON.parse(captured.options.body);assert.equal(payload.Messages.length,1);assert.equal(payload.Messages[0].From.Email,settings.from);assert.match(payload.Messages[0].TextPart,/1234/);assert.equal(payload.Messages[0].To[0].Email,'recipient@example.test');
 assert.equal(payload.SandboxMode,undefined);
});
test('sandbox rejects other recipients before contacting provider',async()=>{
 let calls=0;const mailer=createCandidateRecoveryMailer({},settings,{fetchImpl:async()=>{calls++;}});
 await assert.rejects(mailer.sendCode('other@example.test','1234'),/allowlist/);
 await assert.rejects(mailer.sendCode('recipient@example.test','bad'),/Invalid/);assert.equal(calls,0);
});
test('provider failures and partial rejection expose no response details or credentials',async()=>{
 for(const response of [{ok:false},{ok:true,json:async()=>({Messages:[{Status:'error',Errors:[{ErrorMessage:'private details'}]}]})},{ok:true,json:async()=>({Messages:[{Status:'success',To:[{Email:'wrong@example.test'}]}]})}]){
 const mailer=createCandidateRecoveryMailer({},settings,{fetchImpl:async()=>response});await assert.rejects(mailer.sendCode('recipient@example.test','1234'),/^Error: CANDIDATE_MAIL_DELIVERY_FAILED$/);
 }
 const mailer=createCandidateRecoveryMailer({},settings,{fetchImpl:async()=>{throw new Error('secret transport details');}});await assert.rejects(mailer.sendCode('recipient@example.test','1234'),/^Error: CANDIDATE_MAIL_DELIVERY_FAILED$/);
});
test('SMTP selection preserves existing transport object',()=>{const base={ready:true};assert.equal(createCandidateRecoveryMailer(base,candidateMailSettings({})),base);});
