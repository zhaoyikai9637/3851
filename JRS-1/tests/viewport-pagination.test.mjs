import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';

test('viewport pagination reserves controls and footer, fits whole rows and keeps all later records',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(await readFile(new URL('../JRS HR/dist/pagination.js',import.meta.url),'utf8'));
  const fit=w.HRPagination.capacity;
  assert.equal(fit(700,200,80),6);
  assert.equal(fit(1100,200,80),10);
  assert.equal(fit(500,260,180),1);
  assert.equal(fit(200,240,180),1,'Never hide all content on small phones');
  assert.equal(fit(0,200,80),10,'Wait for a real measurement during loading');
  const rows=Array.from({length:18},(_,i)=>i),size=fit(700,200,80);
  assert.deepEqual(Array.from({length:Math.ceil(rows.length/size)},(_,p)=>rows.slice(p*size,(p+1)*size)).flat(),rows);
 }finally{w.close();}
});

test('measured row wrapping and fixed chrome determine capacity without clipping or a resize loop',async()=>{
 const dom=new JSDOM('<main><nav>Filters</nav><table><tbody>'+Array.from({length:10},()=>'<tr><td>Applicant</td></tr>').join('')+'</tbody></table><footer>Pages</footer></main>',{runScripts:'outside-only'}),w=dom.window;
 try{
  w.eval(await readFile(new URL('../JRS HR/dist/pagination.js',import.meta.url),'utf8'));
  const host=w.document.querySelector('main');
  host.getBoundingClientRect=()=>({height:1000});
  host.querySelectorAll('tr').forEach(row=>row.getBoundingClientRect=()=>({height:80}));
  const result=w.HRPagination.measure(host,700);
  assert.equal(result.size,6);
  host.querySelectorAll('tr').forEach((row,i)=>{if(i>=6)row.remove();});
  host.getBoundingClientRect=()=>({height:680});
  assert.equal(w.HRPagination.measure(host,700,result.rowHeight).size,6);
  host.querySelectorAll('tr').forEach(row=>row.getBoundingClientRect=()=>({height:180}));
  host.getBoundingClientRect=()=>({height:1280});
  assert.equal(w.HRPagination.measure(host,700).size,2,'Phone cards need fewer records than desktop rows');
 }finally{w.close();}
});
