const request = require('supertest');
const bcrypt = require('bcrypt');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createApp } = require('../server/app');
const { MemoryRepository } = require('./memory-repository');
jest.setTimeout(30000);
let repo, app, mailer, instant, uploadDir, passwordHash;
beforeAll(async () => { passwordHash = await bcrypt.hash('GoodPassword1!', 10); });
beforeEach(async () => {
    instant = new Date('2026-10-07T00:00:00Z'); repo = new MemoryRepository(() => instant);
    await repo.register('alice@example.test', passwordHash, 'Alice', 'Test');
    await repo.register('bob@example.test', passwordHash, 'Bob', 'Test');
    await fs.mkdir(path.join(__dirname, '../test-results'), { recursive: true });
    uploadDir = await fs.mkdtemp(path.join(__dirname, '../test-results/upload-'));
    mailer = { ready: true, sendCode: jest.fn().mockResolvedValue(undefined) };
    app = createApp({ repository: repo, mailer, now: () => instant, config: {
        origin: 'http://localhost:3001', production: false, resetSecret: 'x'.repeat(64), sessionMs: 3600000, uploadDir
    } });
});
afterEach(async () => { await fs.rm(uploadDir, { recursive: true, force: true }); });
async function login(email = 'alice@example.test', password = 'GoodPassword1!') {
    const client = request.agent(app);
    const response = await client.post('/api/login').send({ email, password }).expect(200);
    return { client, csrf: response.body.csrfToken, response };
}
const role = { job_title: 'Developer', company_name: 'Example', start_month_year: '2025-01', end_month_year: null, is_current_role: true, description: 'Build software' };
async function token(email = 'alice@example.test') {
    await request(app).post('/api/forgot-password').send({ email }).expect(200);
    const code = mailer.sendCode.mock.calls.at(-1)[1];
    const res = await request(app).post('/api/check-email').send({ email, code }).expect(200);
    return res.body.resetToken;
}
test('anonymous profile access and password reset without verification are rejected', async () => {
    await request(app).get('/api/profile?email=alice@example.test').expect(401);
    await request(app).put('/api/profile').send({ email: 'alice@example.test', fullName: 'Intruder' }).expect(401);
    await request(app).post('/api/set-new-password').send({ email: 'alice@example.test', newPassword: 'Password2!' }).expect(400);
    expect(repo.accounts[0].password_hash).toBe(passwordHash);
});
test('reorganized frontend is served while backend, local secrets and uploads stay private', async () => {
    const res = await request(app).get('/').expect(302);
    expect(res.headers.location).toBe('/pages/login/login.html');
    for (const page of ['login', 'forgot-password', 'check-email', 'set-new-password', 'profile']) {
        await request(app).get(`/pages/${page}/${page}.html`).expect('Content-Type', /html/).expect(200);
        await request(app).get(`/pages/${page}/${page}.js`).expect('Content-Type', /javascript/).expect(200);
    }
    await request(app).get('/assets/css/style.css').expect('Content-Type', /css/).expect(200);
    await request(app).get('/utils/api.js').expect(200);
    for (const file of ['/.env', '/.env.local', '/server/server.js', '/package.json', '/.local-backup/legacy-config/Code.env', '/uploads/private/test']) {
        await request(app).get(file).expect(404);
    }
});
test('registration hashes passwords; duplicate accounts fail; login supports logout and expiry', async () => {
    await request(app).post('/api/register').send({ email: 'new@example.test', password: 'NewPassword1!', first_name: 'New' }).expect(201);
    expect(await bcrypt.compare('NewPassword1!', repo.accounts[2].password_hash)).toBe(true);
    await request(app).post('/api/register').send({ email: 'new@example.test', password: 'NewPassword1!', first_name: 'New' }).expect(409);
    const { client, csrf, response } = await login();
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    await client.get('/api/me').expect(200);
    await client.post('/api/logout').set('X-CSRF-Token', csrf).expect(200);
    await client.get('/api/me').expect(401);
    const again = await login(); instant = new Date(instant.getTime() + 3600001);
    await again.client.get('/api/me').expect(401);
});
test('wrong, plaintext and non-candidate credentials cannot authenticate', async () => {
    await request(app).post('/api/login').send({ email: 'alice@example.test', password: 'wrong' }).expect(401);
    repo.accounts[0].password_hash = 'GoodPassword1!';
    await request(app).post('/api/login').send({ email: 'alice@example.test', password: 'GoodPassword1!' }).expect(401);
    repo.accounts[1].role = 'hr';
    await request(app).post('/api/login').send({ email: 'bob@example.test', password: 'GoodPassword1!' }).expect(401);
});
test('cross-origin login and writes without CSRF are rejected', async () => {
    await request(app).post('/api/login').set('Origin', 'https://evil.example').send({ email: 'alice@example.test', password: 'GoodPassword1!' }).expect(403);
    const { client, csrf } = await login();
    await client.put('/api/profile/summary').send({ personal_summary: 'Changed' }).expect(403);
    await client.put('/api/profile/summary').set('Origin', 'https://evil.example').set('X-CSRF-Token', csrf).send({ personal_summary: 'Changed' }).expect(403);
});
test('profile details and all section types survive a new authenticated request; edits retain IDs', async () => {
    const { client, csrf } = await login();
    await client.put('/api/profile').set('X-CSRF-Token', csrf).send({ first_name: 'Alice', last_name: 'Updated', country_code: '+65', contact_number: '91234567', home_location: 'Singapore', email: 'bob@example.test', account_id: 2 }).expect(200);
    await client.put('/api/profile/summary').set('X-CSRF-Token', csrf).send({ personal_summary: 'My summary' }).expect(200);
    const created = await client.post('/api/profile/career').set('X-CSRF-Token', csrf).send(role).expect(201);
    await client.put(`/api/profile/career/${created.body.id}`).set('X-CSRF-Token', csrf).send({ ...role, job_title: 'Senior Developer' }).expect(200);
    await client.post('/api/profile/education').set('X-CSRF-Token', csrf).send({ institution: 'University', qualification: 'BSc', is_current_study: false, finished_year: '2025', description: 'Project' }).expect(201);
    await client.post('/api/profile/certifications').set('X-CSRF-Token', csrf).send({ cert_name: 'Certificate', issuing_org: 'Issuer', no_expiry: false, issue_month_year: '2024-01', expiry_month_year: '2027-01', description: 'Details' }).expect(201);
    await client.put('/api/profile/skills').set('X-CSRF-Token', csrf).send({ skills: ['JavaScript'] }).expect(200);
    await client.put('/api/profile/languages').set('X-CSRF-Token', csrf).send({ languages: [{ language_name: 'English', can_read: true, can_write: false }] }).expect(200);
    const fresh = await login();
    const { body } = await fresh.client.get('/api/profile?email=bob@example.test').expect(200);
    expect(body.profile).toMatchObject({ email: 'alice@example.test', full_name: 'Alice Updated', contact_number: '91234567', home_location: 'Singapore', personal_summary: 'My summary', skills: ['JavaScript'] });
    expect(body.profile.career).toHaveLength(1);
    expect(body.profile.career[0]).toMatchObject({ role_id: created.body.id, job_title: 'Senior Developer' });
    expect(body.profile.education[0].description).toBe('Project');
    expect(body.profile.certifications[0].expiry_month_year).toBe('2027-01');
    expect(body.profile.languages[0].can_write).toBe(false);
    expect(repo.candidates[1].full_name).toBe('Bob Test');
});
test('another user cannot edit or delete a record by guessing its ID', async () => {
    const alice = await login(), bob = await login('bob@example.test');
    const created = await alice.client.post('/api/profile/career').set('X-CSRF-Token', alice.csrf).send(role);
    await bob.client.put(`/api/profile/career/${created.body.id}`).set('X-CSRF-Token', bob.csrf).send(role).expect(404);
    await bob.client.delete(`/api/profile/career/${created.body.id}`).set('X-CSRF-Token', bob.csrf).expect(404);
    await alice.client.delete(`/api/profile/career/${created.body.id}`).set('X-CSRF-Token', alice.csrf).expect(200);
});
test('server rejects invalid phone numbers, long summaries, reversed dates and duplicate skills', async () => {
    const { client, csrf } = await login();
    await client.put('/api/profile').set('X-CSRF-Token', csrf).send({ first_name: 'Alice', country_code: '+65', contact_number: 'abc91234567' }).expect(400);
    await client.put('/api/profile/summary').set('X-CSRF-Token', csrf).send({ personal_summary: 'a'.repeat(2001) }).expect(400);
    await client.post('/api/profile/career').set('X-CSRF-Token', csrf).send({ ...role, is_current_role: false, end_month_year: '2024-01' }).expect(400);
    await client.put('/api/profile/skills').set('X-CSRF-Token', csrf).send({ skills: ['SQL', 'sql'] }).expect(400);
});
test('password recovery emails a code, consumes the token once and revokes existing sessions', async () => {
    const existing = await login(); const resetToken = await token();
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/set-new-password').send({ resetToken, newPassword: 'NewPassword2!' })));
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    await existing.client.get('/api/me').expect(401);
    await request(app).post('/api/login').send({ email: 'alice@example.test', password: 'GoodPassword1!' }).expect(401);
    await login('alice@example.test', 'NewPassword2!');
});
test('OTP expires and five wrong attempts block the correct code', async () => {
    await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(200);
    const code = mailer.sendCode.mock.calls[0][1], wrong = code === '1111' ? '2222' : '1111';
    for (let i = 0; i < 5; i++) await request(app).post('/api/check-email').send({ email: 'alice@example.test', code: wrong }).expect(400);
    await request(app).post('/api/check-email').send({ email: 'alice@example.test', code }).expect(400);
    instant = new Date(instant.getTime() + 61000);
    await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(200);
    instant = new Date(instant.getTime() + 600001);
    await request(app).post('/api/check-email').send({ email: 'alice@example.test', code: mailer.sendCode.mock.calls.at(-1)[1] }).expect(400);
});
test('reset tokens expire; OTP cannot be reused after verification', async () => {
    const resetToken = await token();
    await request(app).post('/api/check-email').send({ email: 'alice@example.test', code: mailer.sendCode.mock.calls[0][1] }).expect(400);
    instant = new Date(instant.getTime() + 600001);
    await request(app).post('/api/set-new-password').send({ resetToken, newPassword: 'NewPassword2!' }).expect(400);
});
test('resend is limited and unknown accounts receive the same public response', async () => {
    const one = await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(200);
    await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(429);
    const unknown = await request(app).post('/api/forgot-password').send({ email: 'unknown@example.test' }).expect(200);
    expect(unknown.body).toEqual(one.body);
    expect(mailer.sendCode).toHaveBeenCalledTimes(1);
});
test('missing SMTP fails explicitly instead of claiming delivery', async () => {
    mailer.ready = false;
    await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(503);
    expect(mailer.sendCode).not.toHaveBeenCalled();
});
test('SMTP failure discards the undelivered code and preserves the public response', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        mailer.sendCode.mockRejectedValue(Object.assign(new Error('private SMTP detail'), { code: 'ECONNECTION' }));
        const response = await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(200);
        expect(response.body.message).toContain('If a candidate account exists');
        expect(repo.resets.size).toBe(0);
        expect(JSON.stringify(logged.mock.calls)).not.toContain('private SMTP detail');
    } finally { logged.mockRestore(); }
});
test('requesting a new code revokes an already verified reset token', async () => {
    const resetToken = await token();
    instant = new Date(instant.getTime() + 61000);
    await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(200);
    await request(app).post('/api/set-new-password').send({ resetToken, newPassword: 'NewPassword2!' }).expect(400);
    expect(repo.accounts[0].password_hash).toBe(passwordHash);
});
test('database failure after writing an upload removes the private file', async () => {
    const { client, csrf } = await login();
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(repo, 'addResume').mockRejectedValue(new Error('database failure'));
    try {
        await client.post('/api/profile/resume').set('X-CSRF-Token', csrf).attach('resume', Buffer.from('My resume'), 'resume.txt').expect(500);
        expect(await fs.readdir(uploadDir)).toEqual([]);
        expect(repo.files).toEqual([]);
    } finally { logged.mockRestore(); }
});
test('authenticated uploads are persisted and download ownership is enforced', async () => {
    const alice = await login(), bob = await login('bob@example.test');
    const content = Buffer.from('My resume\nExperience');
    const uploaded = await alice.client.post('/api/profile/resume').set('X-CSRF-Token', alice.csrf).attach('resume', content, 'resume.txt').expect(201);
    const download = await alice.client.get(`/api/profile/resume/${uploaded.body.id}`).expect(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.text).toBe(content.toString());
    await bob.client.get(`/api/profile/resume/${uploaded.body.id}`).expect(404);
    await request(app).get(`/api/profile/resume/${uploaded.body.id}`).expect(401);
    await alice.client.get('/uploads/private/anything').expect(404);
    expect((await alice.client.get('/api/profile')).body.profile.resumes).toHaveLength(1);
});
test('files with a forged extension or excessive size are rejected before storage', async () => {
    const { client, csrf } = await login();
    await client.post('/api/profile/resume').set('X-CSRF-Token', csrf).attach('resume', Buffer.from('<html>bad</html>'), 'resume.pdf').expect(400);
    await client.post('/api/profile/resume').set('X-CSRF-Token', csrf).attach('resume', Buffer.alloc(5 * 1024 * 1024 + 1, 65), 'huge.txt').expect(400);
    expect(repo.files).toHaveLength(0);
    expect(await fs.readdir(uploadDir)).toHaveLength(0);
});
