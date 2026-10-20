import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

async function views() {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  dom.window.icon = () => '';
  dom.window.eval(await readFile(new URL('../JRS HR/dist/state.js', import.meta.url), 'utf8'));
  dom.window.eval(await readFile(new URL('../JRS HR/dist/views.js', import.meta.url), 'utf8'));
  return dom;
}

test('top-level pages do not repeat their title as a one-item breadcrumb', async () => {
  const dom = await views();
  try {
    for (const page of ['dashboard', 'applications', 'jobs', 'interviews', 'reports']) {
      assert.equal(dom.window.HRViews.secondaryNavigation([page], { applications: [] }, {}), '');
    }
  } finally { dom.window.close(); }
});

test('nested pages keep their parent link and current location', async () => {
  const dom = await views();
  try {
    dom.window.document.body.innerHTML = dom.window.HRViews.secondaryNavigation(['applications', 'interview-results'], { applications: [] }, {});
    assert.equal(dom.window.document.querySelector('a').getAttribute('href'), '#/applications');
    assert.equal(dom.window.document.querySelector('[aria-current="page"]').textContent, 'Interview Results');
  } finally { dom.window.close(); }
});

test('page headings omit explanatory subtitles without losing their actions', async () => {
  const dom = await views();
  try {
    dom.window.document.body.innerHTML = dom.window.HRViews.header('Reports', 'Recruitment totals calculated from this workspace.', '<button>Export Report</button>');
    assert.equal(dom.window.document.querySelector('h2').textContent, 'Reports');
    assert.equal(dom.window.document.querySelector('.page-heading p'), null);
    assert.equal(dom.window.document.querySelector('button').textContent, 'Export Report');
  } finally { dom.window.close(); }
});

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
