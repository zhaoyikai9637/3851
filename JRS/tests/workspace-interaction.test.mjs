import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';

async function workspace(page='applications') {
  const source=file=>readFile(new URL('../JRS HR/dist/'+file,import.meta.url),'utf8');
  const dom=new JSDOM(await source('index.html'),{url:'http://localhost/recruitment/#/'+page,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  Object.defineProperty(w,'parent',{value:{},configurable:true});
  w.scrollTo=()=>{};
  for(const file of ['job-requirements.js','screening.js','state.js','icons.js','resume.js','views.js','review.js','hr-extra.js','layout.js'])w.eval(await source(file));
  const db=w.HRModel.seed();
  db.currentUser={id:'interaction-hr',name:'Example HR',role:'HR_MANAGER'};
  db.systemNotifications=[];db.mailLogs=[];
  w.HRRemote={boot:async()=>({db,user:db.currentUser,error:''})};
  if(page==='review')w.history.replaceState(null,'','#/review/'+db.applications[0].id);
  await w.eval(await source('app.js'));
  return dom;
}
const settled=()=>new Promise(resolve=>setTimeout(resolve,230));

test('trusted host capacity reduces list rows, preserves search focus and uses the next page for the remainder',async()=>{
 const dom=await workspace(),w=dom.window;
 try{
  await settled();
  const input=w.document.querySelector('[data-search]');input.focus();input.value='';input.setSelectionRange(0,0);
  w.HRPagination={measure:()=>({size:4,rowHeight:80})};
  Object.defineProperty(w,'parent',{value:{}});
  for(const [origin,source]of [['https://untrusted.example',w.parent],[w.location.origin,w]]){
   w.dispatchEvent(new w.MessageEvent('message',{origin,source,data:{type:'jrs:viewport',availableHeight:500}}));
   await settled();assert.equal(w.document.querySelectorAll('tbody tr').length,10);
  }
  w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w.parent,data:{type:'jrs:viewport',height:768,availableHeight:500}}));
  await settled();
  assert.equal(w.document.querySelectorAll('tbody tr').length,4);
  assert.equal(w.document.activeElement,w.document.querySelector('[data-search]'));
  assert.match(w.document.querySelector('.table-footer').textContent,/Showing 1–4/);
  w.document.querySelector('[aria-label="Next page"]').click();await settled();
  assert.match(w.document.querySelector('.table-footer').textContent,/Showing 5–8/);
 }finally{w.close();}
});

test('job information stays expanded when the host grows the iframe height',async()=>{
  const dom=await workspace('review'),w=dom.window;
  try{
    const details=w.document.querySelector('.job-facts-section');
    assert.ok(details);
    details.querySelector('summary').click();
    assert.equal(details.open,true);
    w.innerHeight+=180;w.dispatchEvent(new w.Event('resize'));
    await settled();
    assert.equal(w.document.querySelector('.job-facts-section'),details);
    assert.equal(details.open,true);
  }finally{w.close();}
});

test('interview and report lists use the same host pagination budget',async()=>{
 for(const page of ['interviews','reports']){
  const dom=await workspace(page),w=dom.window;
  try{
   if(page==='interviews'){const filter=w.document.querySelector('[data-filter="interviewStatus"]');filter.value='';filter.dispatchEvent(new w.Event('change',{bubbles:true}));}
   if(page==='reports'){w.document.querySelector('[data-action="section"][data-id="jobs"]').click();await settled();}
   await settled();
   w.HRPagination={measure:()=>({size:3,rowHeight:80})};
   w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w.parent,data:{type:'jrs:viewport',availableHeight:500}}));
   await settled();
   assert.equal(w.document.querySelectorAll('tbody tr').length,3,page);
   assert.match(w.document.querySelector('.table-footer').textContent,/Showing 1–3/);
  }finally{w.close();}
 }
});

test('search retains focus, selection and continued typing after iframe height changes',async()=>{
  const dom=await workspace(),w=dom.window;
  try{
    let input=w.document.querySelector('[data-search]');
    input.focus();input.value='Da';input.setSelectionRange(2,2);
    input.dispatchEvent(new w.InputEvent('input',{bubbles:true}));
    input=w.document.querySelector('[data-search]');
    w.innerHeight-=200;w.dispatchEvent(new w.Event('resize'));
    await settled();
    assert.equal(w.document.activeElement,input);
    assert.equal(input.selectionStart,2);
    input.value+='n';input.dispatchEvent(new w.InputEvent('input',{bubbles:true}));
    assert.equal(w.document.querySelector('[data-search]').value,'Dan');
  }finally{w.close();}
});

test('search does not replace the input during IME composition and filters on completion',async()=>{
  const dom=await workspace(),w=dom.window;
  try{
    const input=w.document.querySelector('[data-search]');input.focus();
    input.dispatchEvent(new w.CompositionEvent('compositionstart',{bubbles:true}));
    input.value='\u6d4b\u8bd5';
    input.dispatchEvent(new w.InputEvent('input',{bubbles:true,isComposing:true}));
    assert.equal(w.document.querySelector('[data-search]'),input);
    assert.equal(w.document.activeElement,input);
    input.dispatchEvent(new w.CompositionEvent('compositionend',{bubbles:true,data:'\u6d4b\u8bd5'}));
    assert.equal(w.document.querySelector('[data-search]').value,'\u6d4b\u8bd5');
    assert.match(w.document.querySelector('#content').textContent,/No applications/);
  }finally{w.close();}
});
