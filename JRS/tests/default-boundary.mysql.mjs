import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
process.env.DB_NAME = 'jrs_integrated_test_20261019';
process.env.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL = 'false';
const { createRuntime } = await import('../server/runtime.mjs');

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
