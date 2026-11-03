import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {applyCandidateOwnership,assertCandidateReadAccess,assertManualCandidateEmail} from '../server/candidate-ownership.mjs';
import {syncRecruitmentPerson,refreshCanonicalPeople} from '../server/canonical-applicant-profile.mjs';
const require=createRequire(import.meta.url),M=require('../JRS HR/dist/state.js'),{applyCommand}=require('../JRS HR/server/service.cjs');
const ownership={query:async()=>[[{recruiting_id:'registered-new',account_id:1},{recruiting_id:'registered-applied',account_id:2}]]};
test('registration alone is hidden while submitted and historical candidates remain readonly',async()=>{
 const db={candidates:[{id:'registered-new'},{id:'registered-applied'},{id:'manual'},{id:'manual-without-application'}],applications:[{id:'withdrawn',candidateId:'registered-applied',stage:'Rejected'},{id:'manual-intake',candidateId:'manual',stage:'Pending Review'}]};
 await applyCandidateOwnership(ownership,db,{visibleOnly:true});assert.deepEqual(db.candidates.map(c=>c.id),['registered-applied','manual']);
 assert.deepEqual(Object.fromEntries(['profileSource','canEditProfile','canUploadResume','canReceiveApplication'].map(k=>[k,db.candidates[0][k]])),{profileSource:'applicant',canEditProfile:false,canUploadResume:false,canReceiveApplication:false});
 assert.equal(db.candidates[1].canEditProfile,true);
});
test('transaction state retains hidden rows for safe saves but attaches server-derived ownership',async()=>{
 const db={candidates:[{id:'registered-new',canEditProfile:true}],applications:[]};await applyCandidateOwnership(ownership,db);assert.equal(db.candidates.length,1);assert.equal(db.candidates[0].canEditProfile,false);
});
test('unsubmitted applicant profile changes never create an HR candidate or link',async()=>{
 const calls=[],db={query:async(sql)=>{calls.push(sql);if(sql.includes('FROM CANDIDATE c'))return [[{account_id:1,candidate_id:7}]];return [[]];}};
 assert.equal(await syncRecruitmentPerson(db,1,{}),false);assert.ok(calls.some(sql=>sql.includes('FROM recruiting_application')));assert.ok(!calls.some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)));
});
test('workspace refresh selects only registered people with an application and does not rewrite untouched registrations',async()=>{
 const calls=[],db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async sql=>{calls.push(sql);return [[]];}};await refreshCanonicalPeople({getConnection:async()=>db});assert.equal(calls.length,2);assert.match(calls[1],/EXISTS\(SELECT 1 FROM recruiting_application/);assert.ok(!calls.some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)));
});
test('direct resume reads do not expose legacy unsubmitted registered candidates',async()=>{
 await assert.rejects(assertCandidateReadAccess({execute:async()=>[[{id:'registered-new',role:'candidate',has_application:0}]]},'registered-new'),{status:404});
 for(const row of [{id:'applied',role:'candidate',has_application:1},{id:'manual',role:null,has_application:1}])await assertCandidateReadAccess({execute:async()=>[[row]]},row.id);
});
test('HR cannot override registered applicant ownership through forged edit or receive payload flags',()=>{
 const db=M.seed();db.systemNotifications=[];const c=db.candidates[0],user={id:'hr-test',name:'HR Tester',role:'HR_MANAGER'};Object.assign(c,{canEditProfile:false,canReceiveApplication:false});
 assert.throws(()=>applyCommand(M.clone(db),'candidate-save',{id:c.id,name:'Forged',canEditProfile:true},user),{status:403});
 const job=db.jobs.find(j=>j.status==='Active'&&!db.applications.some(a=>a.candidateId===c.id&&a.jobId===j.id));assert.ok(job);
 assert.throws(()=>applyCommand(M.clone(db),'application-create',{candidateId:c.id,jobId:job.id,applicantSubmission:true},user),{status:403});
 const trusted=M.clone(db);applyCommand(trusted,'application-create',{candidateId:c.id,jobId:job.id},user,{applicantSubmission:true});assert.ok(trusted.applications.some(a=>a.candidateId===c.id&&a.jobId===job.id));
});

test('manual intake cannot duplicate a registered applicant through an unlinked email entry',async()=>{
 const calls=[];await assert.rejects(assertManualCandidateEmail({query:async(sql,args)=>{calls.push({sql,args});return [[{account_id:7}]];}},'registered@example.test'),{status:403});assert.deepEqual(calls[0].args,['registered@example.test','registered@example.test']);assert.match(calls[0].sql,/a.role='candidate'/);
 await assertManualCandidateEmail({query:async()=>[[]]},'external@example.test');
});
