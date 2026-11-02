import test from 'node:test';
import assert from 'node:assert/strict';
import {employmentCode} from '../JRS Applicant Portal/server/data/jobOptions.js';
test('the updated applicant source retains an importable integrated adapter',async()=>{
 await assert.doesNotReject(()=>import('../server/applicant-data.mjs'));
});
test('applicant employment filters omit the retired contract and internship options',()=>{
 assert.equal(employmentCode('Contract'),null);assert.equal(employmentCode('Internship'),null);
});

test('current intake upgrades availability without removing vacancy-specific questions or mutating snapshots',async()=>{
 const {applicationQuestions}=await import('../server/applicant-questions.mjs');
 const historical=[{id:'portfolio',label:'Portfolio',type:'short',required:true,maxLength:240},{id:'availability',type:'short',required:true,maxLength:120}];
 const before=JSON.stringify(historical),questions=applicationQuestions(historical);
 assert.deepEqual(questions[0],historical[0]);assert.equal(questions[1].type,'select');assert.ok(questions[1].options.includes('Within 1 month'));assert.equal(JSON.stringify(historical),before);
});
test('legacy skill codes remain readable beside new free-form skill names',async()=>{
 const {canonicalSkills}=await import('../JRS Applicant Portal/shared/contactFields.js');
 assert.deepEqual(canonicalSkills(['NODE_JS','node.js','UX_RESEARCH','Stakeholder engagement']),['Node.js','Stakeholder engagement','UX research']);
});
