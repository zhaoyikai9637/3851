import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('embedded links have distinct destinations and publish usable parent paths without resize feedback', async () => {
  const dom = new JSDOM('<main id="content"></main><nav id="secondary-navigation"><ol><li><a href="#/applications">Applications</a></li><li><span>Offer</span></li></ol></nav><a href="#/templates">Templates</a><a href="#/mail-log">Logs</a>', { url: 'http://localhost/recruitment/#/applications/offer', runScripts: 'outside-only' });
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
    w.dispatchEvent(new w.Event('load'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(messages.at(-1).data, { type: 'jrs:location', items: [{ label:'Applications', route:'applications' }, { label:'Offer', route:null }] });
    assert.equal(resize, undefined, 'Content resizing must not resize the iframe viewport');
  } finally { w.close(); }
});
