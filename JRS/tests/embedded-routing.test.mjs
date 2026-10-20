import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('embedded communication links have distinct destinations and resize reports never navigate', async () => {
  const dom = new JSDOM('<main id="content"></main><a href="#/templates">Templates</a><a href="#/mail-log">Logs</a>', { url: 'http://localhost/recruitment/#/applications', runScripts: 'outside-only' });
  const messages = [];
  const w = dom.window;
  let resize;
  Object.defineProperty(w, 'parent', { value: { postMessage: (data, origin) => messages.push({ data: structuredClone(data), origin }) } });
  w.ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} };
  w.document.querySelector('#content').getBoundingClientRect = () => ({ height: 300 });
  Object.defineProperty(w.document.body, 'scrollHeight', { value: 6000 });
  try {
    w.eval(await readFile(new URL('../JRS HR/dist/embedded.js', import.meta.url), 'utf8'));
    w.document.querySelector('a[href="#/templates"]').click();
    assert.deepEqual(messages.pop(), { data: { type: 'jrs:navigate', path: '/templates' }, origin: 'http://localhost' });
    w.document.querySelector('a[href="#/mail-log"]').click();
    assert.deepEqual(messages.pop(), { data: { type: 'jrs:navigate', path: '/logs' }, origin: 'http://localhost' });
    resize();
    assert.equal(messages.at(-1).data.type, 'jrs:frame');
    assert.equal(messages.at(-1).data.route, undefined);
    assert.equal(messages.at(-1).data.path, undefined);
    assert.equal(messages.at(-1).data.height, 324);
  } finally { w.close(); }
});
