import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';
test('Shen English dates retain ISO values, leap-day validation, constraints and filter events',async()=>{
 const dom=new JSDOM('<form><label>Meeting date<input type="date" name="date" data-filter="interviewDate" required min="2030-01-01" value="2030-12-31"></label></form>',{runScripts:'outside-only'});
 try{
  const w=dom.window,d=w.document;w.eval(await readFile(new URL('../JRS HR/dist/date-input.js',import.meta.url),'utf8'));w.HRDateInput.mount(d);
  const input=d.querySelector('input[name="date"]');assert.equal(input.type,'text');assert.equal(input.value,'2030-12-31');assert.equal(input.placeholder,'YYYY-MM-DD');
  for(const invalid of ['2031-02-29','2029-01-01']){input.value=invalid;input.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(input.checkValidity(),false);}
  assert.equal(w.HRDateInput.parseISO('2032-02-29').day,29);let changed='';input.addEventListener('change',()=>changed=input.value);
  input.value='2031-01-15';input.dispatchEvent(new w.Event('input',{bubbles:true}));input.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(changed,'2031-01-15');assert.equal(new w.FormData(d.querySelector('form')).get('date'),'2031-01-15');
  d.querySelector('.english-date-trigger').click();assert.ok(d.body.textContent.includes('January 2031'));
  d.querySelector('[data-date="2031-01-16"]').click();assert.equal(input.value,'2031-01-16');assert.equal(changed,'2031-01-16');
 }finally{dom.window.close();}
});
