import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import request from 'supertest';
process.env.DB_NAME = 'jrs_integrated_test_20261019';
process.env.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL = 'true';

const runtime = await import('../server/runtime.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('integrated site serves login, applicant pages and the original HR shell without source exposure', async () => {
  assert.equal(typeof runtime.createRuntime, 'function', 'Integrated application assembly is missing');
  const site = await runtime.createRuntime();
  try {
    await request(site.app).get('/pages/login/login.html').expect(200);
    await request(site.app).get('/hr/notifications').expect('Content-Type', /html/).expect(200);
    await request(site.app).get('/applicant/jobs').expect('Content-Type', /html/).expect(200);
    await request(site.app).get('/.env').expect(404);
    await request(site.app).get('/server/runtime.mjs').expect(404);
    await request(site.app).get('/api/auth/me').expect(401);
    await request(site.app).get('/applicant-api/applications/me').expect(401);
    await request(site.app).post('/applicant-api/auth/demo-session').send({}).expect(404);
  } finally { await site.close(); }
});

test('a real applicant submission reaches HR, a real HR decision reaches applicant status, and shared logout revokes access', async () => {
  assert.equal(typeof runtime.createRuntime, 'function', 'Integrated application assembly is missing');
  const site = await runtime.createRuntime();
  try {
    const accounts = JSON.parse(await fs.readFile(new URL('../.local/accounts-test.json', import.meta.url)));
    const manager = request.agent(site.app), applicant = request.agent(site.app);
    const hrLogin = await manager.post('/api/login').send({ email: accounts[0].email, password: accounts[0].password }).expect(200);
    assert.equal(hrLogin.body.user.role, 'hr');
    const sharedCsrf = hrLogin.body.csrfToken;
    const hrIdentity = await manager.get('/api/auth/me').expect(200);
    assert.equal(hrIdentity.body.user.fullName, accounts[0].name);
    await manager.get('/applicant-api/applications/me').expect(403);
    const employee = request.agent(site.app);
    await employee.post('/api/login').send({ email: accounts[1].email, password: accounts[1].password }).expect(200);
    const staff = await employee.get('/api/auth/me').expect(200);
    assert.equal(staff.body.user.role, 'HR_STAFF');
    const before = await manager.get('/recruitment/api/hr/workspace').expect(200);
    const M = (await import('../JRS HR/dist/state.js')).default;
    const defaults = M.seed().jobs[0];
    const roleName = `Integration role ${randomUUID().slice(0, 8)}`;
    const created = await manager.post('/recruitment/api/hr/commands/job-save')
      .set('X-CSRF-Token', sharedCsrf).set('If-Match', String(before.body.revision)).set('Idempotency-Key', randomUUID())
      .send({ ...defaults, id: undefined, title: roleName, skills: defaults.skills.join(','), requirements: defaults.requirements.join('\n') }).expect(response => assert.equal(response.status, 200, JSON.stringify(response.body)));
    const jobs = await request(site.app).get('/applicant-api/jobs').expect(200);
    const job = jobs.body.jobs.find(row => row.title === roleName);
    assert.ok(job, 'HR-created job must be published to applicants');
    assert.equal(job.closingDate, null, 'Missing HR closing dates must not become invented application deadlines');
    const publications = await manager.get('/api/hr/job-publications').expect(200);
    const publishing = publications.body.items.find(row => row.title === roleName);
    assert.ok(publishing);
    await manager.put(`/api/hr/job-publications/${publishing.id}`).set('X-CSRF-Token', hrIdentity.body.csrfToken)
      .send({ salaryRange: 'SGD 5,000–6,000', closingDate: '2030-12-31', publishDate: '', unpublishDate: '' }).expect(200);
    const updatedJob = await request(site.app).get(`/applicant-api/jobs/${job.id}`).expect(200);
    assert.equal(updatedJob.body.job.salaryRange, 'SGD 5,000–6,000');
    assert.equal(updatedJob.body.job.closingDate, '2030-12-31');
    await manager.put(`/api/hr/job-publications/${publishing.id}`).set('X-CSRF-Token', hrIdentity.body.csrfToken)
      .send({ salaryRange: 'SGD 5,000–6,000', closingDate: '', publishDate: '2090-01-01', unpublishDate: '' }).expect(200);
    await site.repository.pool.execute('UPDATE jobs SET is_open=1 WHERE id=?', [job.id]);
    const scheduled = await request(site.app).get('/applicant-api/jobs').expect(200);
    assert.ok(!scheduled.body.jobs.some(row => row.id === job.id), 'Publishing schedules must be evaluated at read time, not only after HR edits');
    await manager.put(`/api/hr/job-publications/${publishing.id}`).set('X-CSRF-Token', hrIdentity.body.csrfToken)
      .send({ salaryRange: 'SGD 5,000–6,000', closingDate: '2030-12-31', publishDate: '', unpublishDate: '' }).expect(200);
    const email = `integration-${randomUUID()}@example.test`, password = `Local-${randomUUID()}!`;
    await applicant.post('/api/register').send({ email, password, first_name: 'Integration', last_name: 'Applicant' }).expect(201);
    const login = await applicant.post('/api/login').send({ email, password }).expect(200);
    const csrf = login.body.csrfToken;
    await applicant.get('/api/auth/me').expect(401);
    await applicant.get('/recruitment/api/auth/me').expect(403);
    const me = await applicant.get('/applicant-api/auth/me').expect(200);
    assert.equal(me.body.user.fullName, 'Integration Applicant');
    const resume = await applicant.post('/applicant-api/resumes').set('X-CSRF-Token', csrf)
      .attach('resume', Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'), { filename: 'integration-resume.pdf', contentType: 'application/pdf' }).expect(201);
    const application = await applicant.post('/applicant-api/applications').set('X-CSRF-Token', csrf).send({
      jobId: job.id, resumeId: resume.body.resume.id, phone: '+65 8123 4567', location: 'Singapore', coverLetter: 'Local integration verification only.',
      experiences: [{ companyName: 'Example Test Company', jobTitle: 'Developer', startDate: '2024-01', endDate: '', currentRole: true, responsibilities: 'Implemented and tested recruitment software.', achievements: '', skills: 'JavaScript' }], roleAnswers: {},
    }).expect(response => assert.equal(response.status, 201, JSON.stringify(response.body)));
    const workspace = await manager.get('/recruitment/api/hr/workspace').expect(200);
    const candidate = workspace.body.candidates.find(row => row.email === email);
    const hrApplication = workspace.body.applications.find(row => row.candidateId === candidate?.id && workspace.body.jobs.some(j => j.id === row.jobId && j.title === roleName));
    assert.ok(hrApplication, 'Applicant submission must reach the shared HR queue');
    const notices = await manager.get('/api/hr/notifications').expect(200);
    assert.ok(notices.body.items.some(row => row.title.includes('Integration Applicant')), 'Original Notification Center must receive the application event');
    await manager.post('/recruitment/api/hr/commands/move-interview').set('X-CSRF-Token', sharedCsrf)
      .set('If-Match', String(workspace.body.revision)).set('Idempotency-Key', randomUUID())
      .send({ applicationId: hrApplication.id, notify: false, notes: 'Integration verification.' }).expect(200);
    const status = await applicant.get('/applicant-api/applications/me').expect(200);
    assert.equal(status.body.application.id, application.body.application.id);
    assert.equal(status.body.application.status, 'Interview');
    await manager.post('/api/auth/logout').set('X-CSRF-Token', hrIdentity.body.csrfToken).send({}).expect(204);
    await manager.get('/api/me').expect(401);
    await manager.get('/recruitment/api/auth/me').expect(401);
  } finally { await site.close(); }
});
