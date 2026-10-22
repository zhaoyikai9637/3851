import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const client = new URL('../JRS Login and profile/client/', import.meta.url);
for (const name of ['forgot-password','check-email','set-new-password']) {
  test(`${name} renders the compact sign-in layout instead of the old split screen`, async () => {
    const pageURL = new URL(`pages/${name}/${name}.html`,client);
    const dom = new JSDOM(await fs.readFile(pageURL,'utf8'));
    const d = dom.window.document;
    try {
      for (const link of d.querySelectorAll('link[rel="stylesheet"]')) {
        if (/^https?:/.test(link.getAttribute('href'))) continue;
        const style = d.createElement('style');
        style.textContent = await fs.readFile(new URL(link.getAttribute('href'),pageURL),'utf8');
        d.head.append(style);
      }
      const computed = element => dom.window.getComputedStyle(element);
      assert.equal(computed(d.body).display,'block','recovery must not retain the split grid');
      assert.equal(computed(d.querySelector('.auth-card')).maxWidth,'440px');
      assert.equal(computed(d.querySelector('.auth-card')).boxShadow,'none');
      assert.equal(computed(d.querySelector('button[type="submit"]')).height,'auto','shared buttons can grow when their label wraps');
      assert.equal(computed(d.documentElement).getPropertyValue('--jrs-button-height').trim(),'40px');
      assert.ok(d.querySelector('a[href="../login/login.html"]'),'return to sign-in remains available');
      assert.equal(d.querySelectorAll('.logo-circles .circle').length,2);
    } finally {dom.window.close();}
  });
}
