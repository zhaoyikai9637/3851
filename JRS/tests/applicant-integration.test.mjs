import test from 'node:test';
import assert from 'node:assert/strict';
import {employmentCode} from '../JRS Applicant Portal/server/data/jobOptions.js';
test('the updated applicant source retains an importable integrated adapter',async()=>{
 await assert.doesNotReject(()=>import('../server/applicant-data.mjs'));
});
test('HR contract and internship jobs remain selectable after applicant normalization',()=>{
 assert.equal(employmentCode('Contract'),'CONTRACT');assert.equal(employmentCode('Internship'),'INTERNSHIP');
});
