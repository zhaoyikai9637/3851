import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('embedded navigation and content height use independent trusted messages and intrinsic content bounds', async () => {
  const dom = new JSDOM('<main id="content"></main><nav id="secondary-navigation"><ol><li><a href="#/applications">Applications</a></li><li><span>Offer</span></li></ol></nav><a href="#/templates">Templates</a><a href="#/mail-log">Logs</a>', { url: 'http://localhost/recruitment/#/applications/offer', runScripts: 'outside-only' });
  const messages = [];
  const w = dom.window;
  let resize;
  Object.defineProperty(w, 'parent', { value: { postMessage: (data, origin) => messages.push({ data: structuredClone(data), origin }) } });
  w.ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} };
  let contentHeight=1185;
  w.document.querySelector('#content').getBoundingClientRect = () => ({ height: contentHeight });
  Object.defineProperty(w.document.body, 'scrollHeight', { value: 6000 });
  try {
    w.eval(await readFile(new URL('../JRS HR/dist/embedded.js', import.meta.url), 'utf8'));
    w.document.querySelector('a[href="#/templates"]').click();
    assert.deepEqual(messages.pop(), { data: { type: 'jrs:navigate', path: '/templates' }, origin: 'http://localhost' });
    w.document.querySelector('a[href="#/mail-log"]').click();
    assert.deepEqual(messages.pop(), { data: { type: 'jrs:navigate', path: '/logs' }, origin: 'http://localhost' });
    w.dispatchEvent(new w.Event('load'));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(messages.some(m=>m.data.type==='jrs:location'&&m.data.items[1].label==='Offer'));
    assert.ok(messages.some(m=>m.data.type==='jrs:frame'&&m.data.height===1185),'Content must be fully reachable through the outer browser scrollbar');
    assert.equal(typeof resize,'function');
    const count=messages.length;resize();assert.equal(messages.length,count,'Unchanged intrinsic content must not create a resize loop');
    contentHeight=750;resize();assert.equal(messages.at(-1).data.height,750,'Shorter content shrinks without using body viewport height');
    contentHeight=0;resize();assert.equal(messages.at(-1).data.height,750,'A hidden loading shell must not collapse the host frame');
    for(const [origin,source,height]of [['https://untrusted.example',w.parent,844],['http://localhost',w,844],['http://localhost',w.parent,-1]]){
      w.dispatchEvent(new w.MessageEvent('message',{origin,source,data:{type:'jrs:viewport',height}}));
      assert.equal(w.document.documentElement.style.getPropertyValue('--host-viewport-height'),'');
    }
    w.dispatchEvent(new w.MessageEvent('message',{origin:'http://localhost',source:w.parent,data:{type:'jrs:viewport',height:844}}));
    assert.equal(w.document.documentElement.style.getPropertyValue('--host-viewport-height'),'844px');
  } finally { w.close(); }
});
