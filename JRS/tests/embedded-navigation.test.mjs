import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('embedded HR pages retain their contextual navigation without duplicate account controls', async () => {
  const html = await readFile(new URL('../JRS HR/dist/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../JRS HR/dist/embedded.css', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  try {
    const { document, getComputedStyle } = dom.window;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    const header = document.querySelector('#app-shell > .workspace > .topbar');
    const navigation = document.querySelector('#secondary-navigation');
    header.classList.add('has-secondary-nav');
    navigation.hidden = false;
    navigation.innerHTML = '<a href="#/applications">Applications</a>';
    assert.notEqual(getComputedStyle(header).display, 'none');
    assert.notEqual(getComputedStyle(navigation).display, 'none');
    assert.equal(getComputedStyle(header.querySelector('.account-menu')).display, 'none');
    assert.equal(getComputedStyle(document.querySelector('#app-shell > .sidebar')).display, 'none');
    header.classList.remove('has-secondary-nav');
    navigation.hidden = true;
    assert.equal(getComputedStyle(header).display, 'none');
  } finally {
    dom.window.close();
  }
});
