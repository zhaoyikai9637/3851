import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
process.env.DB_NAME = 'jrs_integrated_test_20261019';
process.env.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL = 'false';
const { createRuntime } = await import('../server/runtime.mjs');

test('job editor saves job details and publishing together while retaining authentication, validation, concurrency and retry safety', async () => {
  const site = await createRuntime();
  try {
    const endpoint = '/recruitment/api/hr/job-postings';
    await request(site.app).get(endpoint).expect(401);
    const accounts = JSON.parse(await fs.readFile(new URL('../.local/accounts-test.json', import.meta.url)));
    const hr = request.agent(site.app);
    const login = await hr.post('/api/login').send({ email: accounts[0].email, password: accounts[0].password }).expect(200);
    const before = await hr.get(endpoint).expect(200);
    assert.ok(before.body.templates.every(item => item.requirements.length >= 8 && item.requirements.length <= 12));
    const M = (await import('../JRS HR/dist/state.js')).default;
    const job = M.seed().jobs[0], title = `Job editor test ${randomUUID()}`;
    const body = { title, department:job.department, type:job.type, mode:job.mode, location:job.location, experience:job.experience, description:job.description, skills:job.skills.join(','), requirements:job.requirements.join('\n'), status:'Draft', salaryRange:'SGD 5,000 - 6,000', publishDate:'2031-01-01', closingDate:'2031-01-31', unpublishDate:'2031-02-01' };
    const key = randomUUID();
    const save = (payload, revision, requestKey = randomUUID()) => hr.post(endpoint).set('X-CSRF-Token',login.body.csrfToken).set('If-Match',String(revision)).set('Idempotency-Key',requestKey).send(payload);
    const created = await save(body,before.body.revision,key).expect(200);
    const saved = created.body.items.find(row=>row.title===title);
    assert.ok(saved);
    assert.equal(saved.salaryRange,body.salaryRange);
    assert.equal(saved.closingDate,'2031-01-31');
    await save(body,before.body.revision,key).expect(200);
    assert.equal((await hr.get(endpoint)).body.items.filter(row=>row.title===title).length,1);
    await save({...body,id:saved.id,title:'Must not be saved',closingDate:'2030-01-01'},created.body.revision).expect(422);
    await save({...body,id:saved.id,title:'Invalid requirements',requirements:'Only one requirement'},created.body.revision).expect(422);
    await save({...body,id:saved.id,title:'Stale update'},before.body.revision).expect(409);
    const unchanged=(await hr.get(endpoint)).body.items.find(row=>row.id===saved.id);
    assert.equal(unchanged.title,title);
    assert.equal(unchanged.closingDate,'2031-01-31');
    await hr.post(endpoint).set('If-Match',String(created.body.revision)).set('Idempotency-Key',randomUUID()).send(body).expect(403);
    const status=await hr.post(endpoint+'/'+encodeURIComponent(saved.id)+'/status').set('X-CSRF-Token',login.body.csrfToken).set('If-Match',String(created.body.revision)).set('Idempotency-Key',randomUUID()).send({status:'Closed'}).expect(200);
    assert.equal(status.body.items.find(row=>row.id===saved.id).status,'Closed');
  } finally { await site.close(); }
});

test('default site keeps shared login/profile and HR available but does not expose the unfinished applicant portal', async () => {
  const site = await createRuntime();
  try {
    await request(site.app).get('/').expect(302).expect('Location', '/pages/login/login.html');
    await request(site.app).get('/pages/login/login.html').expect(200);
    await request(site.app).get('/pages/profile/profile.html').expect(200);
    await request(site.app).get('/hr/templates').expect(200);
    await request(site.app).get('/applicant/jobs').expect(404);
    await request(site.app).get('/applicant-api/jobs').expect(404);
    await request(site.app).get('/api/integration-config').expect(200).expect({ experimentalApplicantPortal: false });
    const accounts = JSON.parse(await fs.readFile(new URL('../.local/accounts-test.json', import.meta.url)));
    const hr = request.agent(site.app);
    const login = await hr.post('/api/login').send({ email: accounts[0].email, password: accounts[0].password }).expect(200);
    const identity = await hr.get('/api/auth/me').expect(200);
    assert.equal(identity.body.user.fullName, accounts[0].name);
    const workspace = await hr.get('/recruitment/api/hr/workspace').expect(200);
    const [[portalBefore]] = await site.repository.pool.query('SELECT COUNT(*) AS total FROM jobs');
    const M = (await import('../JRS HR/dist/state.js')).default;
    const job = M.seed().jobs[0], title = `Isolated HR role ${randomUUID()}`;
    await hr.post('/recruitment/api/hr/commands/job-save')
      .set('X-CSRF-Token', login.body.csrfToken).set('If-Match', String(workspace.body.revision)).set('Idempotency-Key', randomUUID())
      .send({ ...job, id: undefined, title, skills: job.skills.join(','), requirements: job.requirements.join('\n') }).expect(200);
    const [[portalAfter]] = await site.repository.pool.query('SELECT COUNT(*) AS total FROM jobs');
    assert.equal(portalAfter.total, portalBefore.total, 'Default HR writes must not create unfinished applicant-portal records');
    const [[canonical]] = await site.repository.pool.execute('SELECT COUNT(*) AS total FROM JOB_POSITION WHERE title=?', [title]);
    assert.equal(canonical.total, 1, 'The canonical HR record must still be persisted');
  } finally { await site.close(); }
});
