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

test('embedded content hands wheel scrolling to the outer page rather than containing it in the frame',async()=>{
  const workspace=await readFile(new URL('../JRS HR/dist/workspace.css',import.meta.url),'utf8');
  const embedded=await readFile(new URL('../JRS HR/dist/embedded.css',import.meta.url),'utf8');
  const dom=new JSDOM('<style>'+workspace+'\n'+embedded+'</style><div id="app-shell"><div class="workspace"><main id="content"><div class="table-scroll"><table><tr><td>Interview</td></tr></table></div></main></div></div>');
  try{
    const w=dom.window;
    for(const element of w.document.querySelectorAll('html,body,#content,.table-scroll'))assert.equal(w.getComputedStyle(element).overscrollBehavior,'auto');
    assert.equal(w.getComputedStyle(w.document.querySelector('#content')).overflow,'visible');
  }finally{dom.window.close();}
});

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

test('embedded toolbars keep report sections and their export action on one accessible row', async () => {
  const dom=await views();
  try {
    dom.window.document.body.innerHTML='<main id="content"><div class="page-heading"><div><h2>Reports</h2></div><div class="heading-actions"><button>Export Report</button></div></div><nav class="section-tabs" aria-label="Report sections"><button>Overview</button></nav><section class="panel">Business data</section></main>';
    dom.window.eval(await readFile(new URL('../JRS HR/dist/layout.js',import.meta.url),'utf8'));
    const content=dom.window.document.querySelector('main');
    dom.window.HRLayout.apply(content,'reports',{});
    const toolbar=content.querySelector('.workspace-toolbar');
    assert.ok(toolbar);
    assert.equal(toolbar.querySelector('[aria-label="Report sections"]').textContent,'Overview');
    assert.equal(toolbar.querySelector('.heading-actions button').textContent,'Export Report');
    assert.equal(content.querySelector('.panel').textContent,'Business data');
  } finally {dom.window.close();}
});

test('embedded HR pages leave the shared path and account controls to the outer shell', async () => {
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
    assert.equal(getComputedStyle(header).display, 'none');
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
