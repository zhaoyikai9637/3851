import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = await fs.readFile(new URL('../JRS Login and profile/client/pages/login/login.js', import.meta.url), 'utf8');
for (const [role, experimental, query, expected] of [
  ['candidate', false, '', '../profile/profile.html'],
  ['candidate', false, '?returnTo=%2Fapplicant%2Fjobs', '../profile/profile.html'],
  ['candidate', true, '?returnTo=%2Fapplicant%2Fjobs', '/applicant/jobs'],
  ['hr', false, '', '/hr/'],
  ['candidate', true, '?returnTo=https%3A%2F%2Fevil.example', '../profile/profile.html'],
]) test(`shared login redirects ${role} safely (experimental=${experimental}, query=${query || 'none'})`, async () => {
  const dom = new JSDOM('<form id="loginForm"><button id="loginBtn"></button><input id="email" value="test@example.test"><input id="password" value="test-password"></form><button id="registerToggle"></button><div id="registerNames"></div><div id="emailError"></div>', { url: `http://localhost/pages/login/login.html${query}`, runScripts: 'outside-only' });
  await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
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
