import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const base=new URL('../JRS Login and profile/client/',import.meta.url);
async function page(name,fragment=''){
 const dom=new JSDOM(await fs.readFile(new URL(`pages/${name}/${name}.html`,base),'utf8'),{url:`http://localhost/pages/${name}/${name}.html${fragment}`,runScripts:'outside-only'});
 await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));
 dom.window.eval(await fs.readFile(new URL('utils/password-policy.js',base),'utf8'));
 return dom;
}
test('reset link initializes the password form and removes its token from the address bar',async()=>{
 const token='a'.repeat(64),dom=await page('set-new-password','#token='+token),w=dom.window;
 try{
  let submitted;
  w.JRS={request:async(_,options)=>{submitted=options.body;throw new Error('fixture response');}};
  w.validatePasswordLength=()=>true;
  w.eval(await fs.readFile(new URL('pages/set-new-password/set-new-password.js',base),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.equal(w.location.hash,'');assert.equal(w.sessionStorage.getItem('reset_token'),token);
  w.document.getElementById('newPassword').value='NewPassword1!';w.document.getElementById('confirmPassword').value='NewPassword1!';
  w.document.getElementById('resetPasswordForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await new Promise(r=>setTimeout(r,0));assert.equal(submitted.resetToken,token);
 }finally{w.close();}
});
test('reset form refuses a non-ASCII or incomplete password before making a request',async()=>{
 const dom=await page('set-new-password','#token='+'b'.repeat(64)),w=dom.window;
 try{
  let requests=0;w.JRS={request:async()=>{requests++;throw new Error('Unexpected request');}};
  w.validatePasswordLength=()=>true;
  w.eval(await fs.readFile(new URL('pages/set-new-password/set-new-password.js',base),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  for(const value of ['Chinese1!\u4e2d\u6587','lowercase1!']){
   w.document.getElementById('newPassword').value=value;
   w.document.getElementById('confirmPassword').value=value;
   w.document.getElementById('resetPasswordForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
   await new Promise(r=>setTimeout(r,0));
   assert.equal(requests,0);assert.ok(w.document.getElementById('newPasswordError').textContent);
  }
 }finally{w.close();}
});

test('reset password uses an accessible eye and hides the password on page restore',async()=>{
 const dom=await page('set-new-password','#token='+'c'.repeat(64)),w=dom.window,d=w.document;
 try{
  w.eval(await fs.readFile(new URL('pages/set-new-password/set-new-password.js',base),'utf8'));
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  const toggle=d.getElementById('togglePassword'),password=d.getElementById('newPassword');
  assert.equal(password.type,'password');
  assert.ok(toggle.querySelector('svg'));
  toggle.click(); assert.equal(password.type,'text'); assert.equal(toggle.getAttribute('aria-pressed'),'true');
  assert.equal(d.getElementById('passwordSlash').hasAttribute('hidden'),true);
  w.dispatchEvent(new w.Event('pageshow'));
  assert.equal(password.type,'password'); assert.equal(toggle.getAttribute('aria-pressed'),'false');
 }finally{w.close();}
});
for(const submit of ['button','form']) test(`reset ${submit} submission lists missing conditions without transport`,async()=>{
 const dom=await page('set-new-password','#token='+'d'.repeat(64)),w=dom.window,d=w.document;
 try{
  let requests=0;w.JRS={request:async()=>{requests++;throw new Error('fixture response');}};
  w.eval(await fs.readFile(new URL('pages/set-new-password/set-new-password.js',base),'utf8'));
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  for(const [value,message] of [['1111111as','Add at least one uppercase letter.'],['abc','Use at least 8 characters. Add at least one uppercase letter. Add at least one number.']]){
   d.getElementById('newPassword').value=value;d.getElementById('confirmPassword').value=value;
   if(submit==='button') d.getElementById('confirmBtn').click();else d.getElementById('resetPasswordForm').requestSubmit();
   await new Promise(r=>setTimeout(r,0));assert.equal(requests,0);assert.equal(d.getElementById('newPasswordError').textContent,message);
  }
  d.getElementById('newPassword').value='NoSymbols123';d.getElementById('confirmPassword').value='NoSymbols123';
  d.getElementById('confirmBtn').click();await new Promise(r=>setTimeout(r,0));assert.equal(requests,1);
 }finally{w.close();}
});
test('link confirmation does not request an OTP and retains resend and return actions',async()=>{
 const dom=await page('check-email'),w=dom.window;
 try{
  w.sessionStorage.setItem('reset_email','test@example.test');w.sessionStorage.setItem('reset_mode','link');w.JRS={request:async()=>({})};
  w.eval(await fs.readFile(new URL('pages/check-email/check-email.js',base),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.equal(w.document.querySelector('.otp-container').hidden,true);assert.equal(w.document.getElementById('verifyBtn').hidden,true);
  assert.match(w.document.querySelector('.auth-subtitle').textContent,/link/i);assert.ok(w.document.querySelector('a[href*="login"]'));
 }finally{w.close();}
});
