import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';

async function workspace(page='applications') {
  const source=file=>readFile(new URL('../JRS HR/dist/'+file,import.meta.url),'utf8');
  const dom=new JSDOM(await source('index.html'),{url:'http://localhost/recruitment/#/'+page,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
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
