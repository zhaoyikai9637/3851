import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
const source=file=>readFile(new URL('../JRS HR/dist/'+file,import.meta.url),'utf8');
test('native candidate view hides applicant write actions and retains manual-candidate controls',async()=>{
 for(const applicant of [true,false]){
  const dom=new JSDOM(await source('index.html'),{url:'http://localhost/recruitment/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
  try{
   await new Promise(resolve=>w.addEventListener('load',resolve,{once:true}));w.scrollTo=()=>{};
   for(const file of ['job-requirements.js','screening.js','state.js','icons.js','resume.js','views.js','review.js','hr-extra.js','layout.js'])w.eval(await source(file));
   const db=w.HRModel.seed(),person=db.candidates[0];db.currentUser={id:'policy-hr',name:'HR Tester',role:'HR_MANAGER'};db.systemNotifications=[];db.mailLogs=[];
   Object.assign(person,{profileSource:applicant?'applicant':'hr',canEditProfile:!applicant,canUploadResume:!applicant,canReceiveApplication:!applicant});
   w.history.replaceState(null,'','#/candidate/'+person.id);w.HRRemote={boot:async()=>({db,user:db.currentUser,error:''})};await w.eval(await source('app.js'));
   assert.equal(Boolean(w.document.querySelector('#content [data-action="candidate-edit"]')),!applicant);assert.equal(Boolean(w.document.querySelector('#content [data-action="resume-upload"]')),!applicant);
   w.history.replaceState(null,'','#/applications');w.dispatchEvent(new w.HashChangeEvent('hashchange'));w.document.querySelector('[data-action="application-new"]').click();await new Promise(resolve=>setImmediate(resolve));
   const choices=[...w.document.querySelectorAll('select[name="candidateId"] option')].map(option=>option.value);assert.equal(choices.includes(person.id),!applicant);
  }finally{w.close();}
 }
});
