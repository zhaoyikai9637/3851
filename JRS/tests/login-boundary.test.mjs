import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { TextEncoder } from 'node:util';

const source = await fs.readFile(new URL('../JRS Login and profile/client/pages/login/login.js', import.meta.url), 'utf8');
for (const [role, experimental, query, expected] of [
  ['candidate', false, '', '../profile/profile.html'],
  ['candidate', false, '?returnTo=%2Fapplicant%2Fjobs', '../profile/profile.html'],
  ['candidate', true, '?returnTo=%2Fapplicant%2Fjobs', '/applicant/jobs'],
  ['hr', false, '', '/hr/'],
  ['candidate', true, '?returnTo=https%3A%2F%2Fevil.example', '../profile/profile.html'],
]) test(`shared login redirects ${role} safely (experimental=${experimental}, query=${query || 'none'})`, async () => {
  const html = await fs.readFile(new URL('../JRS Login and profile/client/pages/login/login.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: `http://localhost/pages/login/login.html${query}`, runScripts: 'outside-only' });
  await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
  dom.window.TextEncoder = TextEncoder;
  dom.window.document.getElementById('email').value = 'test@example.test';
  dom.window.document.getElementById('password').value = 'test-password';
  // Network and navigation are external boundaries; exercise the actual submit handler.
  const location = { search: query, href: '' };
  dom.window.JRS = { request: async endpoint => endpoint === '/login' ? { user: { role } } : { experimentalApplicantPortal: experimental } };
  dom.window.Function('window', source)( { location } );
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  dom.window.document.getElementById('loginForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(location.href, expected);
  dom.window.close();
});
