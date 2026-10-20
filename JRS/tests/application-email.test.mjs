import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

async function workspace(mailEnabled = false) {
  const html = await readFile(new URL('../JRS HR/dist/index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/recruitment/#/applications', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const file of ['job-requirements.js', 'screening.js', 'state.js', 'icons.js', 'resume.js', 'views.js', 'review.js', 'hr-extra.js']) {
    w.eval(await readFile(new URL('../JRS HR/dist/' + file, import.meta.url), 'utf8'));
  }
  const db = w.HRModel.seed();
  db.currentUser = { id: 'test-hr', name: 'Test HR', role: 'HR_MANAGER' };
  db.mailEnabled = mailEnabled;
  db.systemNotifications = [];
  db.notifications = [];
  db.templates = [];
  db.mailLogs = [];
  let sends = 0;
  w.HRRemote = {
    boot: async () => w.HRRemote, db, error: '',
    commit: async (command, payload) => w.HRModel.apply(db, command, payload),
    send: async (id) => { sends++; db.notifications.find(n => n.id === id).status = 'Sent'; },
    refresh: async () => db,
  };
  w.eval(await readFile(new URL('../JRS HR/dist/app.js', import.meta.url), 'utf8'));
  await new Promise(resolve => setImmediate(resolve));
  async function click(selector) {
    const button = w.document.querySelector(selector);
    assert.ok(button, 'Missing control: ' + selector);
    button.click();
    await new Promise(resolve => setImmediate(resolve));
  }
  return { dom, w, db, click, get sends() { return sends; } };
}

test('application emails retain drafts, reopen edits and preview without leaving the application', async () => {
  const t = await workspace();
  try {
    const app = t.db.applications[0];
    await t.click(`[data-action="application-messages"][data-id="${app.id}"]`);
    await t.click('#modal [data-action="message"]');
    let form = t.w.document.querySelector('#modal form');
    assert.ok(form, t.w.document.querySelector('#toast').textContent);
    form.elements.subject.value = 'Application update';
    form.elements.body.value = 'A saved candidate message.';
    form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(t.db.notifications.length, 1);
    const draft = t.db.notifications[0];
    assert.equal(draft.status, 'Draft');
    assert.equal(t.w.location.hash, '#/applications');
    await t.click(`#modal [data-action="message-edit"][data-id="${draft.id}"]`);
    form = t.w.document.querySelector('#modal form');
    assert.equal(form.elements.body.value, 'A saved candidate message.');
    form.elements.subject.value = 'Updated subject';
    form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(t.db.notifications.length, 1);
    assert.equal(draft.subject, 'Updated subject');
    await t.click(`#modal [data-action="mail-send"][data-id="${draft.id}"]`);
    assert.match(t.w.document.querySelector('#modal-body').textContent, /Updated subject/);
    assert.equal(t.w.document.querySelector('#modal [type="submit"]').disabled, true);
    assert.equal(t.sends, 0);
  } finally { t.dom.window.close(); }
});

test('email history is scoped to its application and sending requires explicit confirmation', async () => {
  const t = await workspace(true);
  try {
    const app = t.db.applications[0], other = t.db.applications[1];
    t.db.notifications.push({ id: 'mine', applicationId: app.id, to: 'candidate@example.test', subject: 'Current candidate', body: 'Reviewed body', status: 'Draft', createdAt: new Date().toISOString() }, { id: 'other', applicationId: other.id, subject: 'Other candidate private draft', status: 'Draft' });
    await t.click(`[data-action="application-messages"][data-id="${app.id}"]`);
    assert.ok(!t.w.document.querySelector('#modal-body').textContent.includes('Other candidate private draft'));
    await t.click('#modal [data-action="mail-send"]');
    assert.equal(t.sends, 0);
    const form = t.w.document.querySelector('#modal form');
    form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(t.sends, 1);
    assert.equal(t.db.notifications[0].status, 'Sent');
    assert.equal(t.w.location.hash, '#/applications');
  } finally { t.dom.window.close(); }
});
