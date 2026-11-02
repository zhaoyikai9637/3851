import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';

test('embedded sections remain usable until hosted and only accept trusted matching selection commands',async()=>{
 const dom=new JSDOM('<main id="content"><nav class="section-tabs" aria-label="Report sections"><button data-action="section" data-id="summary" class="selected">Overview</button><button data-action="section" data-id="jobs">Job performance</button></nav></main>',{url:'http://localhost/recruitment/#/reports',runScripts:'outside-only'}),w=dom.window,messages=[];
 Object.defineProperty(w,'parent',{value:{postMessage:data=>messages.push(data)}});
 w.ResizeObserver=class{observe(){}};
 try{
  w.eval(await readFile(new URL('../JRS HR/dist/embedded.js',import.meta.url),'utf8'));
  w.dispatchEvent(new w.Event('load'));
  await new Promise(resolve=>setImmediate(resolve));
  const sections=messages.find(message=>message.type==='jrs:sections');
  assert.ok(sections);
  assert.equal(sections.items[0].selected,true);
  const nav=w.document.querySelector('nav');
  assert.equal(nav.classList.contains('header-sections-hosted'),false);
  const message=(data,origin=w.location.origin,source=w.parent)=>w.dispatchEvent(new w.MessageEvent('message',{origin,source,data}));
  message({type:'jrs:sections-mounted',key:sections.key},'https://untrusted.example');
  assert.equal(nav.classList.contains('header-sections-hosted'),false);
  message({type:'jrs:sections-mounted',key:sections.key});
  assert.equal(nav.classList.contains('header-sections-hosted'),true);
  let clicks=0;nav.children[1].addEventListener('click',()=>clicks++);
  message({type:'jrs:select-section',key:sections.key,index:1},w.location.origin,w);
  message({type:'jrs:select-section',key:'stale',index:1});
  assert.equal(clicks,0);
  message({type:'jrs:select-section',key:sections.key,index:1});assert.equal(clicks,1);
  // Rendering a replacement of the same navigation must not flash a duplicate.
  nav.outerHTML=nav.outerHTML.replace('header-sections-hosted','');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('nav').classList.contains('header-sections-hosted'),true);
 }finally{w.close();}
});
