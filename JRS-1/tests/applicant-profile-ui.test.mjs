import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {JSDOM} from 'jsdom';
const base=new URL('../JRS Login and profile/client/',import.meta.url),read=f=>fs.readFile(new URL(f,base),'utf8');
async function fixture(){const html=await read('pages/profile/profile.html'),js=await read('pages/profile/profile.js'),utils=await Promise.all(['profile_utils.js','materials_summary_utils.js','skills_utils.js'].map(f=>read('utils/'+f)));const dom=new JSDOM(html,{url:'http://localhost/pages/profile/profile.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve,{once:true}));w.confirm=()=>true;for(const u of utils)w.eval(u);const p={full_name:'Example Candidate',first_name:'Example',last_name:'Candidate',email:'candidate@example.test',country_code:'+65',contact_number:'81234567',home_location:'Singapore',personal_summary:'A personal summary.',career:[],education:[],certifications:[],skills:['HTML','React'],languages:[{language_name:'English',can_read:true,can_write:true}]};const calls=[];w.JRS={request:async(url,options={})=>{calls.push({url,...options});if(url==='/me')return {};if(url==='/profile')return {profile:structuredClone(p)};if(url==='/profile/skills')p.skills=options.body.skills;if(url==='/profile/languages')p.languages=options.body.languages;return {valid:true};}};w.eval(js);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();return {dom,w,calls,p};}
const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
test('saved skills can be removed directly and saved languages hide the redundant add action',async()=>{const {dom,w,calls}=await fixture();try{assert.equal(w.document.querySelector('#addLanguageBtn').hidden,true);const buttons=w.document.querySelectorAll('#skillTags .remove-skill-btn');assert.equal(buttons.length,2);buttons[0].click();await settle();assert.deepEqual(calls.find(c=>c.url==='/profile/skills').body.skills,['React']);assert.equal(w.document.querySelectorAll('#skillTags .skill-chip').length,1);w.document.querySelector('[aria-label="Delete all languages"]').click();await settle();assert.equal(w.document.querySelector('#addLanguageBtn').hidden,false);assert.equal(w.document.querySelectorAll('#languageList .profile-record').length,0);}finally{w.close();}});
test('profile uses year selects, consistent record actions and avatar-only navigation without changing unrelated text limits',async()=>{const {dom,w}=await fixture();try{assert.equal(w.document.querySelectorAll('.section-desc').length,0);assert.equal(w.document.querySelectorAll('.sidebar-nav a[href="profile.html"]').length,0);for(const id of ['roleStartYear','roleEndYear','eduFinishedYear','certIssueYear','certExpiryYear'])assert.equal(w.document.getElementById(id).tagName,'SELECT');assert(w.document.querySelector('#summaryContent .record-actions .record-trash'));assert.equal(w.document.querySelector('#summaryInput').maxLength,2000);assert.equal(w.document.querySelector('#roleDescription').maxLength,-1);}finally{w.close();}});


test('profile editors expand inside their own cards and switching or cancelling never saves',async()=>{
 const {w,calls}=await fixture();try{
  const d=w.document;
  for(const [editorId,triggerId] of [['materialsDrawer','editMaterialsBtn'],['summaryDrawer','addSummaryBtn'],['roleDrawer','addRoleBtn'],['educationDrawer','addEducationBtn'],['licenceDrawer','addCertBtn'],['skillsDrawer','addSkillBtn'],['languageDrawer','addLanguageBtn']]){
   const editor=d.getElementById(editorId),trigger=d.getElementById(triggerId);
   assert.equal(editor.parentElement,trigger.closest('.profile-section,.user-info-card'));
   assert.equal(editor.hidden,true);assert.equal(editor.getAttribute('role'),'region');
  }
  assert.equal(d.querySelector('.drawer-backdrop'),null);assert.equal(d.querySelector('.drawer'),null);
  d.getElementById('addRoleBtn').click();assert.equal(d.getElementById('roleDrawer').hidden,false);assert.equal(d.activeElement.id,'roleTitle');
  d.getElementById('roleTitle').value='Unsaved role';d.getElementById('addEducationBtn').click();
  assert.equal(d.getElementById('roleDrawer').hidden,true);assert.equal(d.getElementById('educationDrawer').hidden,false);
  d.getElementById('cancelEducationBtn').click();assert.equal(d.getElementById('educationDrawer').hidden,true);
  assert.equal(calls.filter(c=>c.method&&c.method!=='GET').length,0);
 }finally{w.close();}
});

test('inline skill editing cancels draft changes and saves only when explicitly requested',async()=>{
 const {w,calls}=await fixture();try{
  const d=w.document,add=()=>{d.getElementById('skillInput').value='SQL';d.getElementById('addSkillTagBtn').click();};
  d.getElementById('addSkillBtn').click();add();d.getElementById('cancelSkillsBtn').click();
  assert.equal(calls.filter(c=>c.url==='/profile/skills').length,0);
  d.getElementById('addSkillBtn').click();assert.equal(d.querySelectorAll('#addedSkillsContainer .skill-chip').length,2);
  add();d.getElementById('saveSkillsBtn').click();await settle();
  assert.deepEqual(Array.from(calls.find(c=>c.url==='/profile/skills').body.skills),['HTML','React','SQL']);
  assert.equal(d.getElementById('skillsDrawer').hidden,true);assert.equal(d.querySelectorAll('#skillTags .skill-chip').length,3);
 }finally{w.close();}
});

test('failed inline saves keep entered text visible beside a local error',async()=>{
 const {w}=await fixture();try{
  const request=w.JRS.request;w.JRS.request=async(url,options)=>{if(url==='/profile/summary')throw Error('Could not save summary.');return request(url,options);};
  const d=w.document;d.querySelector('#summaryContent .record-edit').click();d.getElementById('summaryInput').value='My draft summary';
  d.getElementById('summaryForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.equal(d.getElementById('summaryDrawer').hidden,false);assert.equal(d.getElementById('summaryInput').value,'My draft summary');
  assert.match(d.querySelector('#summaryDrawer [role="alert"]').textContent,/Could not save/);
 }finally{w.close();}
});
