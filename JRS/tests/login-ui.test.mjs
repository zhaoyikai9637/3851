import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {TextEncoder} from 'node:util';
import {JSDOM} from 'jsdom';
const base = new URL('../JRS Login and profile/client/pages/login/', import.meta.url);
async function loginPage(query='') {
  const dom = new JSDOM(await fs.readFile(new URL('login.html', base), 'utf8'), {
    url: 'http://localhost/pages/login/login.html'+query, runScripts: 'outside-only'
  });
  await new Promise(resolve => dom.window.addEventListener('load', resolve, {once:true}));
  dom.window.TextEncoder = TextEncoder;
  const policyPath = new URL('../../utils/password-policy.js', base);
  dom.window.eval(await fs.readFile(policyPath, 'utf8'));
  dom.window.eval(await fs.readFile(new URL('login.js', base), 'utf8'));
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
}
test('password visibility is accessible and registration restores private password entry', async () => {
  const dom = await loginPage(), w = dom.window, d = w.document;
  try {
    const toggle = d.querySelector('button[aria-controls="password"]');
    assert.ok(toggle, 'password visibility control is available');
    toggle.click();
    assert.equal(d.getElementById('password').type, 'text');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    d.getElementById('registerToggle').click();
    assert.equal(d.getElementById('password').type, 'password');
    assert.equal(d.getElementById('password').autocomplete, 'new-password');
    assert.equal(d.getElementById('registerNames').hidden, false);
    assert.equal(d.getElementById('forgotPasswordLink').hidden, true);
  } finally { w.close(); }
});
test('the visitor registration link opens account creation without losing its application return target',async()=>{
 const dom=await loginPage('?mode=register&returnTo=%2Fapplicant%2Fapply%2Frole-a');
 try{
  assert.equal(dom.window.document.getElementById('registerNames').hidden,false);
  assert.equal(dom.window.document.getElementById('password').autocomplete,'new-password');
  assert.equal(new URLSearchParams(dom.window.location.search).get('returnTo'),'/applicant/apply/role-a');
 }finally{dom.window.close();}
});
test('password icon reflects hidden and revealed states and returning to login hides the password', async () => {
  const dom = await loginPage(), w = dom.window, d = w.document;
  try {
    const password = d.getElementById('password'), toggle = d.getElementById('togglePassword');
    const slash = d.getElementById('passwordSlash');
    assert.equal(password.type, 'password');
    assert.equal(slash.hasAttribute('hidden'), false, 'hidden password uses the crossed eye');
    toggle.click();
    assert.equal(password.type, 'text');
    assert.equal(slash.hasAttribute('hidden'), true, 'revealed password uses the open eye');
    toggle.click();
    assert.equal(password.type, 'password');
    assert.equal(slash.hasAttribute('hidden'), false);
    d.getElementById('registerToggle').click();
    toggle.click();
    d.getElementById('registerToggle').click();
    assert.equal(password.type, 'password');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    toggle.click();
    w.dispatchEvent(new w.Event('pageshow'));
    assert.equal(password.type, 'password', 'restored pages do not expose a password');
  } finally { w.close(); }
});
for (const value of ['lowercase1!', 'UPPERCASE1!', 'NoDigitsHere!', '1111111as', 'Chinese1!\u4e2d\u6587', 'Emoji1!\u{1f600}']) {
  test('registration blocks a password missing the required character policy: ' + JSON.stringify(value), async () => {
    const dom = await loginPage(), w = dom.window, d = w.document;
    try {
      let sent = false;
      w.JRS = {request: async () => { sent = true; return {}; }};
      d.getElementById('registerToggle').click();
      d.getElementById('registerFirstName').value = 'Example';
      d.getElementById('email').value = 'example@example.test';
      d.getElementById('password').value = value;
      d.getElementById('loginForm').dispatchEvent(new w.Event('submit', {cancelable:true}));
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(sent, false);
      assert.equal(d.getElementById('password').getAttribute('aria-invalid'), 'true');
      assert.ok(d.getElementById('passwordError').textContent);
    } finally { w.close(); }
  });
}
test('invalid fields block network requests and focus the first invalid field', async () => {
  const dom = await loginPage(), w = dom.window, d = w.document;
  try {
    let requests = 0;
    w.JRS = {request: async () => { requests++; return {}; }};
    d.getElementById('loginForm').dispatchEvent(new w.Event('submit', {cancelable:true}));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(requests, 0);
    assert.equal(d.activeElement.id, 'email');
    assert.equal(d.getElementById('email').getAttribute('aria-invalid'), 'true');
  } finally { w.close(); }
});

for (const submit of ['button', 'form']) test(`registration ${submit} submission lists missing password conditions`, async () => {
  const dom = await loginPage('?mode=register'), w = dom.window, d = w.document;
  try {
    let requests=0; w.JRS={request:async()=>{requests++;return {};}};
    d.getElementById('registerFirstName').value='Example';
    d.getElementById('email').value='candidate@example.test';
    for (const [value, message] of [['1111111as','Add at least one uppercase letter.'],['abc','Use at least 8 characters. Add at least one uppercase letter. Add at least one number.']]) {
      d.getElementById('password').value=value;
      if(submit==='button') d.getElementById('loginBtn').click();
      else d.getElementById('loginForm').requestSubmit();
      await new Promise(resolve=>setTimeout(resolve,0));
      assert.equal(d.getElementById('passwordError').textContent,message);
      assert.equal(requests,0);
    }
  } finally {w.close();}
});
test('registration uses the shared endpoint and returns to sign-in without trimming passwords', async () => {
  const dom = await loginPage(), w = dom.window, d = w.document;
  try {
    let submitted;
    w.JRS = {request: async (path, options) => { submitted = {path, ...options}; return {}; }};
    d.getElementById('registerToggle').click();
    d.getElementById('registerFirstName').value = 'Example';
    d.getElementById('email').value = 'candidate@example.test';
    d.getElementById('password').value = ' Password123 ';
    d.getElementById('loginForm').dispatchEvent(new w.Event('submit', {cancelable:true}));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(submitted.path, '/register');
    assert.equal(submitted.body.password, ' Password123 ');
    assert.equal(d.getElementById('registerNames').hidden, true);
    assert.equal(d.getElementById('password').autocomplete, 'current-password');
    assert.equal(d.getElementById('formMessage').hidden, false);
  } finally { w.close(); }
});
