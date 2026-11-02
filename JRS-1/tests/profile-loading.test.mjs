import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import repository from '../JRS Login and profile/server/services/repository.js';
const base=new URL('../JRS Login and profile/client/',import.meta.url);
async function pageFixture(fail=false) {
 const html=await fs.readFile(new URL('pages/profile/profile.html',base),'utf8');
 const js=await fs.readFile(new URL('pages/profile/profile.js',base),'utf8');
 const dom=new JSDOM(html,{url:'https://jrs.example/pages/profile/profile.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 for(const name of ['profile_utils.js','materials_summary_utils.js','skills_utils.js'])w.eval(await fs.readFile(new URL('utils/'+name,base),'utf8'));
 let release;const gate=new Promise(resolve=>release=resolve);
 const profile={full_name:'Loaded Candidate',email:'loaded@example.test',country_code:'+65',contact_number:'81234567',personal_summary:'',career:[],education:[],certifications:[],skills:[],languages:[]};
 const calls=[];w.JRS={request:async url=>{calls.push(url);if(url==='/profile'){await gate;if(fail)throw new Error('Unavailable');return {profile};}return {};}};
 w.eval(js);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(resolve=>setTimeout(resolve,10));
 return {w,release,calls};
}
test('profile shows loading without fabricated identity and enables editing only after data arrives',async()=>{
 const {w,release,calls}=await pageFixture();try {
  const d=w.document;assert.equal(d.querySelector('#userName').textContent,'');assert.equal(d.querySelector('#userEmail').textContent,'');assert.equal(d.querySelector('#userPhone').textContent,'');assert.equal(d.querySelector('#avatarCircle').textContent,'');
  assert.equal(d.querySelector('#profileMain').getAttribute('aria-busy'),'true');assert.equal(d.querySelector('#profileLoading').hidden,false);assert.equal(d.querySelector('#editMaterialsBtn').disabled,true);
  assert.deepEqual(calls,['/me','/profile']);release();await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(d.querySelector('#userName').textContent,'Loaded Candidate');assert.equal(d.querySelector('#userEmail').textContent,'loaded@example.test');assert.equal(d.querySelector('#profileLoading').hidden,true);assert.equal(d.querySelector('#profileMain').getAttribute('aria-busy'),'false');assert.equal(d.querySelector('#editMaterialsBtn').disabled,false);
 }finally{release();w.close();}
});
test('profile failures show a usable retry and hide incomplete cards',async()=>{
 const {w,release}=await pageFixture(true);try {release();await new Promise(resolve=>setTimeout(resolve,20));const d=w.document;assert.equal(d.querySelector('.profile-grid').hidden,true);assert.equal(d.querySelector('#profileRetryBtn').hidden,false);assert.equal(d.querySelector('#profileRetryBtn').disabled,false);assert.equal(d.querySelector('#profileLoading').hidden,true);assert.match(d.querySelector('#profileMessage').textContent,/Unable to load your profile/);}finally{release();w.close();}
});
test('profile queries all sections concurrently and keeps every query scoped to the verified candidate',async()=>{
 const pending=[],calls=[];const pool={query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT * FROM CANDIDATE'))return [[{candidate_id:17,full_name:'Candidate'}]];return new Promise(resolve=>pending.push({sql,resolve}));}};
 const result=new repository.Repository(pool).profile(7);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(pending.length,6);
 for(const {args} of calls.slice(1))assert.deepEqual(args,[17]);
 for(const q of pending)q.resolve([q.sql.includes('FROM SKILL')?[{skill_name:'React'}]:[]]);
 const profile=await result;assert.equal(profile.candidate_id,17);assert.deepEqual(profile.skills,['React']);assert.deepEqual(profile.languages,[]);assert.deepEqual(profile.resumes,[]);
});
test('a missing candidate cannot query another candidate sections',async()=>{
 let calls=0;const pool={query:async()=>{calls++;return [[]];}};assert.equal(await new repository.Repository(pool).profile(7),null);assert.equal(calls,1);
});