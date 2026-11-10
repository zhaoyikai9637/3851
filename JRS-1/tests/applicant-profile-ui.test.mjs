import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const base=new URL('../JRS Login and profile/client/',import.meta.url),read=f=>fs.readFile(new URL(f,base),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
async function fixture(){
 const dom=new JSDOM(await read('pages/profile/profile.html'),{url:'http://localhost/pages/profile/profile.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve,{once:true}));w.confirm=()=>true;
 for(const name of ['profile_utils.js','materials_summary_utils.js','skills_utils.js'])w.eval(await read('utils/'+name));
 const p={full_name:'Example Candidate',first_name:'Example',last_name:'Candidate',email:'candidate@example.test',country_code:'+65',contact_number:'81234567',home_location:'Singapore',personal_summary:'A personal summary.',career:[{role_id:11,job_title:'Developer',company_name:'Example',description:'Existing work',start_month_year:'2020-01',end_month_year:null,is_current_role:true}],education:[{education_id:12,institution:'Example University',qualification:'Computer Science',qualification_level:'BACHELOR',start_year:'2020',finished_year:'2024',is_current_study:false,description:'Keep existing highlights'}],certifications:[{cert_id:13,cert_name:'Certificate',issuing_org:'Issuer',no_expiry:true}],skills:['HTML','React'],languages:[{language_name:'English',language_code:'en',reading_level:'Advanced',writing_level:'Native',can_read:true,can_write:true}]};
 const calls=[];let nextId=20;
 w.JRS={request:async(url,options={})=>{calls.push({url,...options});if(url==='/profile'&&!options.method)return {profile:structuredClone(p)};return {valid:true,...(options.method==='POST'?{id:++nextId}:{})};}};
 w.eval(await read('pages/profile/profile.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();return {w,p,calls};
}
const field=(form,key)=>form.querySelector('[data-field="'+key+'"]');
const save=form=>form.requestSubmit();
const writes=calls=>calls.filter(call=>call.method);

test('saved profile values use compact cards and editors open only for add or edit',async()=>{
 const {w,calls}=await fixture();try{
  const d=w.document;
  for(const id of ['summaryContent','careerList','educationList','certList','skillTags','languageList'])assert.ok(d.querySelector('#'+id+' .profile-entry-form'));
  assert.equal(d.querySelector('.drawer-backdrop,.profile-inline-editor'),null);
  for(const id of ['summaryContent','careerList','educationList','certList','skillTags','languageList'])assert.equal(d.querySelector('#'+id+' form').hidden,true);
  assert.equal(d.querySelector('#summaryContent .record-trash'),null);
  assert.equal(d.querySelector('#summaryContent .profile-entry-delete'),null);
  assert.equal(d.querySelector('.user-info-card form').hidden,true);
  d.querySelector('#educationList .record-edit').click();assert.equal(d.querySelector('#educationList form').hidden,false);
  assert.equal(d.querySelector('#educationList .profile-saved-view').hidden,true);
  assert.equal(field(d.querySelector('#educationList form'),'eduCourse').value,'Computer Science');
  assert.equal(field(d.querySelector('#careerList form'),'roleTitle').value,'Developer');
  assert.equal(d.querySelector('.sidebar-nav a[href="profile.html"]'),null);
  assert.equal(writes(calls).length,0,'Opening a profile does not write or manufacture records');
  assert.equal(field(d.querySelector('#summaryContent form'),'summaryInput').maxLength,2000);
 }finally{w.close();}
});

test('Add appends an independent education card; cancel and failed saves preserve other drafts',async()=>{
 const {w,calls}=await fixture();try{
  const d=w.document,original=d.querySelector('#educationList form');d.querySelector('#educationList .record-edit').click();field(original,'eduCourse').value='Unsaved existing qualification';
  d.getElementById('addEducationBtn').click();const forms=d.querySelectorAll('#educationList form');assert.equal(forms.length,2);
  const added=forms[1];field(added,'eduCourse').value='New qualification';field(added,'eduInstitution').value='New school';
  added.querySelector('[data-field="cancelEducationBtn"]').click();assert.equal(d.querySelectorAll('#educationList form').length,1);assert.equal(field(original,'eduCourse').value,'Unsaved existing qualification');assert.equal(writes(calls).length,0);
  const request=w.JRS.request;w.JRS.request=async(url,options)=>{if(options?.method==='PUT'&&url.includes('/education/'))throw Error('Save unavailable.');return request(url,options);};
  save(original);await settle();assert.equal(field(original,'eduCourse').value,'Unsaved existing qualification');assert.match(original.querySelector('[role="status"]').textContent,/Save unavailable/);
 }finally{w.close();}
});

test('education saves qualification level and years while preserving legacy highlights; subsequent save updates rather than duplicates',async()=>{
 const {w,calls}=await fixture();try{
  const d=w.document,form=d.querySelector('#educationList form');d.querySelector('#educationList .record-edit').click();field(form,'eduLevel').value='MASTER';field(form,'eduStartYear').value='2022';field(form,'eduFinishedYear').value='2025';
  save(form);await settle();assert.equal(form.hidden,true);assert.match(d.querySelector('#educationList .profile-saved-view').textContent,/Computer Science/);const update=calls.find(call=>call.url==='/profile/education/12');assert.equal(update.method,'PUT');assert.equal(update.body.qualification_level,'MASTER');assert.equal(update.body.start_year,'2022');assert.equal(update.body.finished_year,'2025');assert.equal(update.body.description,'Keep existing highlights');
  d.getElementById('addEducationBtn').click();const added=d.querySelectorAll('#educationList form')[1];field(added,'eduInstitution').value='New school';field(added,'eduCourse').value='Diploma';save(added);await settle();save(added);await settle();
  assert.equal(calls.filter(call=>call.url==='/profile/education'&&call.method==='POST').length,1);assert.equal(calls.filter(call=>call.url==='/profile/education/21'&&call.method==='PUT').length,1);
 }finally{w.close();}
});

test('skills use add-one-at-a-time removable chips and persist only on Save',async()=>{
 const {w,calls}=await fixture();try{
  w.document.getElementById('addSkillBtn').click();const form=w.document.querySelector('#skillTags form'),input=form.querySelector('[aria-label="Add a skill"]');
  input.value='SQL';input.dispatchEvent(new w.Event('input'));input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  assert.equal(form.querySelectorAll('.profile-selected-skill').length,3);assert.equal(writes(calls).length,0);
  form.querySelector('[aria-label="Remove HTML"]').click();save(form);await settle();
  assert.deepEqual(Array.from(calls.find(call=>call.url==='/profile/skills').body.skills),['React','SQL']);assert.equal(input.value,'');
 }finally{w.close();}
});

test('language cards share resume language and proficiency choices; adding and deleting does not erase other languages',async()=>{
 const {w,calls}=await fixture();try{
  const d=w.document,first=d.querySelector('#languageList form');assert.equal(field(first,'language').value,'en');assert.equal(field(first,'readingLevel').value,'Advanced');
  assert.equal(field(first,'otherLanguage').disabled,true);d.getElementById('addLanguageBtn').click();const added=d.querySelectorAll('#languageList form')[1];
  field(added,'language').value='other';field(added,'language').dispatchEvent(new w.Event('change'));field(added,'otherLanguage').value='Esperanto';field(added,'readingLevel').value='Basic';field(added,'writingLevel').value='Intermediate';save(added);await settle();
  const body=calls.find(call=>call.url==='/profile/languages').body;assert.equal(body.languages.length,2);assert.equal(body.languages[0].writing_level,'Native');assert.equal(body.languages[1].language_name,'Esperanto');assert.equal(body.languages[1].language_code,'other');
  first.querySelector('.profile-entry-delete').click();await settle();const last=calls.filter(call=>call.url==='/profile/languages').at(-1);assert.equal(last.body.languages.length,1);assert.equal(last.body.languages[0].language_name,'Esperanto');assert.equal(d.querySelectorAll('#languageList form').length,1);
 }finally{w.close();}
});

test('saving one card keeps another section draft and current-role empty end dates intact',async()=>{
 const {w,calls}=await fixture();try{
  const d=w.document,career=d.querySelector('#careerList form'),education=d.querySelector('#educationList form');field(education,'eduCourse').value='Another unsaved draft';save(career);await settle();
  assert.equal(calls.find(call=>call.url==='/profile/career/11').body.end_month_year,null);assert.equal(field(education,'eduCourse').value,'Another unsaved draft');assert.equal(field(career,'roleEndYear').disabled,true);
  career.querySelector('.profile-entry-delete').click();await settle();assert.equal(calls.at(-1).method,'DELETE');assert.equal(d.querySelectorAll('#careerList form').length,0);
 }finally{w.close();}
});


test('Cancel closes summary editing without deleting or saving the stored text',async()=>{
 const {w,calls}=await fixture();try{const d=w.document,form=d.querySelector('#summaryContent form');d.querySelector('#summaryContent .record-edit').click();field(form,'summaryInput').value='Unsaved text';form.querySelector('[data-field="cancelSummaryBtn"]').click();assert.equal(form.hidden,true);assert.match(d.querySelector('#summaryContent .profile-saved-view').textContent,/A personal summary/);assert.equal(writes(calls).length,0);assert.equal(form.querySelector('.profile-entry-delete'),null);assert.equal(form.querySelector('legend').classList.contains('profile-visually-hidden'),true);}finally{w.close();}
});


test('editing and saving an existing record returns to its display card and Cancel restores the saved value',async()=>{
 const {w,calls}=await fixture();try{const d=w.document,form=d.querySelector('#educationList form');d.querySelector('#educationList .record-edit').click();field(form,'eduCourse').value='Saved qualification';save(form);await settle();assert.equal(form.hidden,true);assert.match(d.querySelector('#educationList .profile-saved-view').textContent,/Saved qualification/);d.querySelector('#educationList .record-edit').click();field(form,'eduCourse').value='Discard this';form.querySelector('[data-field="cancelEducationBtn"]').click();assert.equal(form.hidden,true);assert.equal(field(form,'eduCourse').value,'Saved qualification');assert.equal(calls.filter(call=>call.method==='PUT'&&call.url==='/profile/education/12').length,1);}finally{w.close();}
});
