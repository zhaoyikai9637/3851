const request = require('supertest');
const crypto = require('node:crypto');
const { createApp } = require('../server/app');
const { hash, SESSION_COOKIE } = require('../server/utils/tokens');
const token = crypto.randomBytes(32).toString('hex');
const cookie = `${SESSION_COOKIE}=${token}`;
const sid = `candidate:${hash(token)}`;
let identity, workspaceUser, session, app, repository;
beforeEach(() => {
    identity = { user_id: 7, full_name: 'HR Test', email: 'hr@example.test', role: 'HR_MANAGER' };
    workspaceUser = { id: 'team-hr-7', email: identity.email, name: identity.full_name, role: identity.role, status: 'Active', employee_id: 'TEST-HR' };
    session = { account_id: 8, email: identity.email, role: 'hr', csrf: 'test-csrf' };
    repository = {
        pool: { execute: jest.fn(async () => [[workspaceUser].filter(Boolean)]) },
        session: jest.fn(async input => input === sid ? session : null),
        hrIdentity: jest.fn(async () => identity),
        logout: jest.fn(async () => { session = null; }),
        candidate: jest.fn(), changePassword: jest.fn(async () => true)
    };
    app = createApp({ repository, config: { origin: 'http://localhost:3001', production: false, sessionMs: 3600000 }, mailer: { ready: false } });
});
test('HR APIs reject anonymous callers and candidate sessions, including forged role headers', async () => {
    await request(app).get('/hr/api/auth/me').expect(401);
    session.role = 'candidate';
    await request(app).get('/hr/api/auth/me').set('Cookie', cookie).set('X-Role', 'HR_MANAGER').expect(403);
    expect(repository.hrIdentity).not.toHaveBeenCalled();
});
test('shared HR session resolves backend identity; HR cannot access candidate profile', async () => {
    const response = await request(app).get('/hr/api/auth/me').set('Cookie', cookie).expect(200);
    expect(response.body.user).toMatchObject({ id: 'team-hr-7', name: 'HR Test', role: 'HR_MANAGER' });
    await request(app).get('/api/profile').set('Cookie', cookie).expect(403);
    expect(repository.candidate).not.toHaveBeenCalled();
});
test('inactive or mismatched HR identities cannot enter the workspace', async () => {
    identity = null;
    await request(app).get('/hr/api/auth/me').set('Cookie', cookie).expect(403);
    identity = { user_id: 7, role: 'HR_STAFF' };
    await request(app).get('/hr/api/auth/me').set('Cookie', cookie).expect(403);
});
test('HR writes require shared CSRF token and trusted origin; logout invalidates shared session', async () => {
    await request(app).post('/hr/api/auth/logout').set('Cookie', cookie).send({}).expect(403);
    await request(app).post('/hr/api/auth/logout').set('Cookie', cookie).set('X-CSRF-Token', 'test-csrf').set('Origin', 'https://untrusted.invalid').send({}).expect(403);
    expect(repository.logout).not.toHaveBeenCalled();
    await request(app).post('/hr/api/auth/logout').set('Cookie', cookie).set('X-CSRF-Token', 'test-csrf').send({}).expect(200);
    expect(repository.logout).toHaveBeenCalledWith(sid);
    await request(app).get('/api/me').set('Cookie', cookie).expect(401);
});
test('standalone HR login is closed; HR assets and shared login are served from one app', async () => {
    await request(app).post('/hr/api/auth/login').send({ email: 'hr@example.test', password: 'ignored' }).expect(409);
    await request(app).get('/hr/').expect('Content-Type', /html/).expect(200);
    await request(app).get('/hr/api.js').expect('Content-Type', /javascript/).expect(200);
    await request(app).get('/hr/server/app.cjs').expect(404);
    await request(app).get('/pages/login/login.html').expect(200);
});
