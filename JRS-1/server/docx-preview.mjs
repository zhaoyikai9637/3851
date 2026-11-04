import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
let running=0;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isDocx=file=>file.file_type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||/\.docx$/i.test(file.file_name||'');
export function previewPage(filename,text,{unavailable=false}={}){
 return '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(filename)+'</title><style>body{margin:0;background:#fff;color:#172033;font:15px/1.65 "Segoe UI",Arial,sans-serif}main{max-width:800px;margin:0 auto;padding:24px}h1{font-size:18px;margin:0 0 8px;overflow-wrap:anywhere}.note{color:#5f6f86;font-size:13px;margin:0 0 22px;padding-bottom:16px;border-bottom:1px solid #d8e1ee}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:0}</style></head><body><main><h1>'+escape(filename)+'</h1><p class="note">'+(unavailable?'Preview unavailable. Download the original document to view it.':'Text preview. Download the original document to keep its formatting.')+'</p><pre>'+escape(text||'This document has no readable text. Download the original document to view it.')+'</pre></main></body></html>';
}
async function extractDocx(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>5*1024*1024||running>=2)throw Error('Preview unavailable');running++;
 try{return await new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./docx-preview-worker.mjs',import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:96,maxYoungGenerationSizeMb:16}});let settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);};
  const timer=setTimeout(()=>finish(Error('Preview unavailable')),15000);
  worker.once('message',value=>value&&typeof value.text==='string'?finish(null,value.text):finish(Error('Preview unavailable')));
  worker.once('error',()=>finish(Error('Preview unavailable')));worker.once('exit',()=>{if(!settled)finish(Error('Preview unavailable'));});
 });}finally{running--;}
}

// Repeated iframe renders share bounded extraction work; the route still checks
// the HR session, application/file relationship and private storage on every read.
const previews=new Map(),pending=new Map(),maxCachedBytes=2*1024*1024;
export async function docxText(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>5*1024*1024)throw Error('Preview unavailable');
 const now=Date.now(),key=createHash('sha256').update(bytes).digest('hex');
 for(const [id,item]of previews)if(item.until<=now)previews.delete(id);
 const existing=previews.get(key);if(existing){previews.delete(key);previews.set(key,existing);return existing.text;}
 if(pending.has(key))return pending.get(key);
 const work=extractDocx(bytes).then(text=>{const size=Buffer.byteLength(text);if(size<=maxCachedBytes){previews.set(key,{text,size,until:Date.now()+30000});let total=[...previews.values()].reduce((n,item)=>n+item.size,0);while(previews.size>4||total>maxCachedBytes){const first=previews.keys().next().value;total-=previews.get(first).size;previews.delete(first);}}return text;});
 pending.set(key,work);try{return await work;}finally{pending.delete(key);}
}
