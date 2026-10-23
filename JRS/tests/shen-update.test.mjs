import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {displayDate,isoDate} from '../jrs-hr-module/client/pages/jobs/model.js';
import model from '../JRS HR/dist/state.js';

test('integrated job dates use the same ISO input contract as Shen 2.6.2',()=>{
  assert.equal(displayDate('2031-02-28'),'2031-02-28');
  assert.equal(isoDate('2032-02-29'),'2032-02-29');
  assert.throws(()=>isoDate('2031-02-29'),/valid date/);
  assert.throws(()=>isoDate('28/02/2031'),/YYYY-MM-DD/);
});

test('review and results omit removed shortcuts while retaining documents and decisions',async()=>{
  const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
  try{
    w.icon=()=>'';
    for(const file of ['job-requirements.js','screening.js','state.js','views.js','resume.js','review.js'])w.eval(await readFile(new URL('../JRS HR/dist/'+file,import.meta.url),'utf8'));
    const db=w.HRModel.seed(),a=db.applications[0];
    a.submission={resumeUrl:'/recruitment/api/hr/applications/'+a.id+'/document',resumeName:'submitted.pdf',resumeType:'application/pdf',candidate:{name:'Submitted identity'}};
    for(const route of ['review','results']){
      w.document.body.innerHTML=w.HRReview.render([route,a.id],db,{page:1});
      assert.equal(w.document.querySelectorAll('[data-action="review-prev"],[data-action="review-next"],[data-action="activity"],.review-heading .heading-actions').length,0);
      assert.ok(w.document.querySelector('iframe[src*="/document"]'));
      assert.ok(w.document.querySelector('.review-decision-actions button'));
    }
  }finally{w.close();}
});

test('combined review booking rejects closed jobs and leaves all records untouched',()=>{
  const db=model.seed(),a=db.applications.find(row=>row.stage==='Pending Review');
  db.jobs.find(row=>row.id===a.jobId).status='Closed';
  const before=JSON.stringify(db);
  assert.throws(()=>model.apply(db,'move-interview',{applicationId:a.id,date:model.day(3),time:'10:00',location:'Room A',interviewer:'Example HR',format:'Video',duration:45,notify:true}),/Activate|active/);
  assert.equal(JSON.stringify(db),before);
});
