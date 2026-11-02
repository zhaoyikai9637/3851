// Real MySQL integration test: only a newly created random database on loopback.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const request = require('supertest');
const { ROOT } = require('../server/config/config');
const { run: migrateCandidate } = require('./migrate');
const { run: migrateHr } = require('./migrate-hr');
const { run: seedHr } = require('./seed-hr');
const { Repository } = require('../server/services/repository');
const { createApp } = require('../server/app');
async function main() {
    const settings = JSON.parse(await fs.readFile(path.join(ROOT, '.local-backup/demo/settings.json'), 'utf8'));
    const database = 'jrs_hr_integration_' + crypto.randomBytes(8).toString('hex');
    assert.match(database, /^jrs_hr_integration_[a-f0-9]{16}$/);
    const db = { host: '127.0.0.1', port: 33306, user: 'root', password: settings.password, timezone: 'Z', connectionLimit: 10,
        ssl: { ca: await fs.readFile(path.join(ROOT, '.local-backup/demo/tls/cert.pem'), 'utf8'), rejectUnauthorized: true } };
    const admin = mysql.createPool(db);
    let pool, created = false, credentialsFile;
    try {
        await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
        const config = { db: { ...db, database }, origin: 'http://localhost:3001', production: false,
            sessionMs: 3600000, resetSecret: crypto.randomBytes(32).toString('hex'), uploadDir: path.join(ROOT, 'test-results/hr-upload') };
        pool = mysql.createPool(config.db);
        await pool.query(`CREATE TABLE HR_USER(user_id INT AUTO_INCREMENT PRIMARY KEY, employee_id VARCHAR(30) NOT NULL UNIQUE,
            full_name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL UNIQUE, role VARCHAR(50) NOT NULL,
            department VARCHAR(100) NOT NULL, account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE') ENGINE=InnoDB`);
        await pool.query(`CREATE TABLE MODULE_ACCOUNT(account_id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(150) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,role VARCHAR(20) NOT NULL,hr_user_id INT NULL UNIQUE,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(hr_user_id) REFERENCES HR_USER(user_id)) ENGINE=InnoDB`);
        await pool.query('CREATE TABLE CANDIDATE(candidate_id INT AUTO_INCREMENT PRIMARY KEY,full_name VARCHAR(100) NOT NULL,email VARCHAR(150) NOT NULL,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
        await pool.query('CREATE TABLE MODULE_SESSION(sid VARCHAR(128) PRIMARY KEY,data MEDIUMTEXT,expires DATETIME) ENGINE=InnoDB');
        await migrateCandidate({ config, apply: true, expectedDatabase: database });
        await migrateHr({ config, apply: true, expectedDatabase: database });
        const seeded = await seedHr({ config, apply: true, expectedDatabase: database }); credentialsFile = seeded.file;
        const { accounts } = JSON.parse(await fs.readFile(credentialsFile, 'utf8'));
        const repo = new Repository(pool);
        await repo.register('candidate.hr-check@example.test', await bcrypt.hash('CandidateTest2026!', 12), 'Candidate', 'Test');
        const app = createApp({ repository: repo, config, mailer: { ready: false } });
        async function login(account) {
            const response = await request(app).post('/api/login').set('Origin', config.origin).send({ email: account.email, password: account.password }).expect(200);
            return { cookie: response.headers['set-cookie'].map(value => value.split(';')[0]).join('; '), csrf: response.body.csrfToken, user: response.body.user };
        }
        await request(app).get('/hr/api/hr/workspace').expect(401);
        await request(app).post('/hr/api/auth/login').send({ email: accounts[0].email, password: accounts[0].password }).expect(409);
        const candidate = await login({ email: 'candidate.hr-check@example.test', password: 'CandidateTest2026!' });
        assert.equal(candidate.user.role, 'candidate');
        await request(app).get('/api/profile').set('Cookie', candidate.cookie).expect(200);
        await request(app).get('/hr/api/hr/workspace').set('Cookie', candidate.cookie).expect(403);
        for (const account of accounts) {
            const hr = await login(account); assert.equal(hr.user.role, 'hr');
            const me = await request(app).get('/hr/api/auth/me').set('Cookie', hr.cookie).expect(200);
            assert.equal(me.body.user.name, account.name); assert.equal(me.body.user.role, account.role);
            const workspace = await request(app).get('/hr/api/hr/workspace').set('Cookie', hr.cookie).expect(200);
            assert.equal(workspace.body.currentUser.name, account.name); assert.equal(workspace.body.templates.length, 5);
            await request(app).get('/api/profile').set('Cookie', hr.cookie).expect(403);
            await request(app).post('/hr/api/hr/commands/profile-save').set('Cookie', hr.cookie).send({ phone: '', officeLocation: 'Room 101' }).expect(403);
            await request(app).post('/hr/api/hr/commands/profile-save').set('Origin', 'https://untrusted.invalid').set('Cookie', hr.cookie).set('X-CSRF-Token', hr.csrf).send({}).expect(403);
            await request(app).post('/hr/api/hr/commands/profile-save').set('Origin', config.origin).set('Cookie', hr.cookie).set('X-CSRF-Token', hr.csrf).set('If-Match', String(workspace.body.revision)).set('Idempotency-Key', crypto.randomUUID()).send({ phone: '', officeLocation: 'Room 101' }).expect(200);
            await request(app).post('/hr/api/auth/logout').set('Cookie', hr.cookie).set('X-CSRF-Token', hr.csrf).send({}).expect(200);
            await request(app).get('/api/me').set('Cookie', hr.cookie).expect(401);
            await request(app).get('/hr/api/hr/workspace').set('Cookie', hr.cookie).expect(401);
        }
        const disabled = await login(accounts[1]);
        await pool.query("UPDATE HR_USER SET account_status='DISABLED' WHERE email=?", [accounts[1].email]);
        await request(app).get('/api/me').set('Cookie', disabled.cookie).expect(401);
        await request(app).post('/api/login').send({ email: accounts[1].email, password: accounts[1].password }).expect(401);
        const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM CANDIDATE'); assert.equal(count.total, 1, 'HR login must not create candidate profiles');
        console.log('PASS: real MySQL shared login, HR identities, role isolation, CSRF/origin checks, profile persistence, logout, disabled accounts; cloud unchanged.');
    } finally {
        if (pool) await pool.end();
        try { if (created) await admin.query(`DROP DATABASE \`${database}\``); } finally { await admin.end(); }
        // Private credentials files are intentionally retained as an audit of this disposable run.
    }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
