import assert from 'node:assert/strict';
import test from 'node:test';
import M from '../JRS HR/dist/state.js';
import {publicationState} from '../server/job-publications.mjs';

test('closed jobs block interview and offer progression without deleting existing records',()=>{
 const db=M.seed(),a=db.applications.find(a=>a.stage==='Pending Review'),j=db.jobs.find(j=>j.id===a.jobId);j.status='Closed';
 assert.throws(()=>M.apply(db,'move-interview',{applicationId:a.id}),/Activate|active/);assert.equal(a.stage,'Pending Review');
 a.stage='Interview';assert.throws(()=>M.apply(db,'schedule',{applicationId:a.id}),/active/);
 a.stage='Interview Results';a.feedback={rating:4};assert.throws(()=>M.apply(db,'offer',{applicationId:a.id}),/active/);
});
test('closing and reopening replaces the removed Stop action',()=>{
 const db=M.seed(),j=db.jobs[0];M.apply(db,'job-status',{id:j.id,status:'Closed'});assert.equal(j.status,'Closed');
 M.apply(db,'job-status',{id:j.id,status:'Active'});assert.equal(j.status,'Active');
 assert.throws(()=>M.apply(db,'job-status',{id:j.id,status:'Stopped'}),/Invalid job status/);
});
test('legacy stopped records remain readable while closed, stopped and draft jobs cannot accept intake',()=>{
 for(const status of ['Closed','Stopped','Draft'])assert.equal(publicationState(status).accepting,false);
 assert.equal(publicationState('Active').accepting,true);const db=M.seed(),j=db.jobs[0];j.status='Stopped';assert.ok(M.validate(db));
});
