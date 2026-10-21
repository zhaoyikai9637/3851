import assert from 'node:assert/strict';
import test from 'node:test';
import M from '../JRS HR/dist/state.js';
import {publicationState} from '../server/job-publications.mjs';

test('closed intake still permits existing application interviews and offers',()=>{
 const db=M.seed(),a=db.applications.find(a=>a.stage==='Pending Review'),j=db.jobs.find(j=>j.id===a.jobId);
 j.status='Closed';
 M.apply(db,'move-interview',{applicationId:a.id});
 M.apply(db,'schedule',{applicationId:a.id,date:M.day(2),time:'10:00',duration:45,format:'Video',location:'Test room',interviewer:'Example HR'});
 a.stage='Interview Results';a.feedback={rating:4};
 M.apply(db,'offer',{applicationId:a.id,salary:5000,startDate:M.day(30),expiry:M.day(10),terms:'Standard terms'});
 assert.equal(a.stage,'Offer');
});

test('stopped and draft jobs block progression and scheduling without changing the application',()=>{
 for(const status of ['Stopped','Draft']){
  const db=M.seed(),a=db.applications.find(a=>a.stage==='Pending Review'),j=db.jobs.find(j=>j.id===a.jobId);j.status=status;
  assert.ok(M.validate(db));
  assert.throws(()=>M.apply(db,'move-interview',{applicationId:a.id}),/processing|Activate/);
  assert.equal(a.stage,'Pending Review');
  a.stage='Interview';
  assert.throws(()=>M.apply(db,'schedule',{applicationId:a.id}),/processing|active/);
 }
});

test('managers can explicitly stop and resume existing application processing',()=>{
 const db=M.seed(),j=db.jobs[0];
 M.apply(db,'job-status',{id:j.id,status:'Stopped'});assert.equal(j.status,'Stopped');
 M.apply(db,'job-status',{id:j.id,status:'Closed'});assert.equal(j.status,'Closed');
});

test('only Active accepts new applications and stopped jobs cannot advance offers',()=>{
 for(const status of ['Closed','Stopped','Draft'])assert.equal(publicationState(status).accepting,false);
 assert.equal(publicationState('Active').accepting,true);
 const db=M.seed(),a=db.applications.find(a=>a.stage==='Offer'),j=db.jobs.find(j=>j.id===a.jobId);j.status='Stopped';
 assert.throws(()=>M.apply(db,'approve-offer',{applicationId:a.id}),/processing/);
});
