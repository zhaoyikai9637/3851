// Deliberately does not load .env: this harness can only target loopback.
const mysql = require('mysql2/promise');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const fs = require('node:fs/promises');
const path = require('node:path');
const { run, statements } = require('./migrate');
const { Repository } = require('../server/services/repository');
const { createApp } = require('../server/app');

async function main() {
    if (!process.env.TEST_MYSQL_PASSWORD) throw new Error('Set TEST_MYSQL_PASSWORD for the disposable local MySQL server.');
    const database = `jrs_isolated_${crypto.randomBytes(8).toString('hex')}`;
    const connection = { host: '127.0.0.1', port: Number(process.env.TEST_MYSQL_PORT || 33306),
        user: 'root', password: process.env.TEST_MYSQL_PASSWORD, timezone: 'Z', connectionLimit: 10 };
    const admin = mysql.createPool(connection);
    let pool, uploadDir, created = false;
    try {
        await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        created = true;
        pool = mysql.createPool({ ...connection, database });
        await pool.query('CREATE TABLE HR_USER (user_id INT PRIMARY KEY) ENGINE=InnoDB');
        await pool.query(`CREATE TABLE MODULE_ACCOUNT (account_id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(150) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL,
            hr_user_id INT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (hr_user_id) REFERENCES HR_USER(user_id)) ENGINE=InnoDB`);
        await pool.query(`CREATE TABLE CANDIDATE (candidate_id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
        await pool.query('CREATE TABLE MODULE_SESSION (sid VARCHAR(128) PRIMARY KEY, data MEDIUMTEXT, expires DATETIME, INDEX(expires)) ENGINE=InnoDB');
        const hash = await bcrypt.hash('GoodPassword1!', 10);
        await pool.query("INSERT INTO MODULE_ACCOUNT(email,password_hash,role) VALUES ('legacy@example.test',?,'candidate')", [hash]);
        await pool.query("INSERT INTO CANDIDATE(full_name,email) VALUES ('Original Name','legacy@example.test')");
        const options = { config: { db: { ...connection, database } }, expectedDatabase: database, apply: true };
        await run({ ...options, apply: false });
        const [[before]] = await pool.query("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=?", [database]);
        assert.equal(before.total, 4, 'read-only migration must not create a ledger');
        await run(options);
        await run({ ...options, linkExisting: true });
        const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM JRS_SCHEMA_MIGRATION');
        assert.equal(count.total, statements.length);
        const [[legacy]] = await pool.query('SELECT * FROM CANDIDATE WHERE candidate_id=1');
        assert.equal(legacy.account_id, 1); assert.equal(legacy.full_name, 'Original Name');
        await pool.query("INSERT INTO CANDIDATE(full_name,email) VALUES ('Duplicate','legacy@example.test')");
        await assert.rejects(run({ ...options, linkExisting: true }), /duplicate candidate emails/i);
        await pool.query('DELETE FROM CANDIDATE WHERE candidate_id<>1');

        const repo = new Repository(pool);
        const aliceId = await repo.register('alice@example.test', hash, 'Alice', 'Test');
        const bobId = await repo.register('bob@example.test', hash, 'Bob', 'Test');
        await assert.rejects(repo.register('rollback@example.test', hash, 'a'.repeat(101), 'Test'));
        assert.equal(await repo.findAccount('rollback@example.test'), undefined, 'failed profile insert rolls back account');
        const candidate = await repo.candidate(aliceId);
        await fs.mkdir(path.join(__dirname, '../test-results'), { recursive: true });
        uploadDir = await fs.mkdtemp(path.join(__dirname, '../test-results/mysql-upload-'));
        let code;
        const app = createApp({ repository: repo, config: { origin: 'http://localhost:3001', production: false,
            sessionMs: 3600000, resetSecret: 'isolated-test-secret'.repeat(4), uploadDir },
            mailer: { ready: true, async sendCode(email, value) { code = value; } } });
        async function login(email, password = 'GoodPassword1!') {
            const client = request.agent(app);
            const res = await client.post('/api/login').send({ email, password }).expect(200);
            return { client, csrf: res.body.csrfToken };
        }
        const alice = await login('alice@example.test'), bob = await login('bob@example.test');
        await alice.client.put('/api/profile').set('X-CSRF-Token', alice.csrf).send({ first_name: 'Alice', last_name: 'Updated', country_code: '+65', contact_number: '91234567', home_location: 'Singapore' }).expect(200);
        await alice.client.put('/api/profile/summary').set('X-CSRF-Token', alice.csrf).send({ personal_summary: 'Persisted in MySQL' }).expect(200);
        const values = {
            career: { job_title: 'Developer', company_name: 'Example', is_current_role: true, start_month_year: '2025-01', description: 'Build' },
            education: { institution: 'University', qualification: 'BSc', is_current_study: false, finished_year: '2025' },
            certifications: { cert_name: 'SQL', issuing_org: 'Example', no_expiry: true, issue_month_year: '2025-01' }
        };
        for (const [section, body] of Object.entries(values)) {
            const res = await alice.client.post(`/api/profile/${section}`).set('X-CSRF-Token', alice.csrf).send(body).expect(201);
            await alice.client.put(`/api/profile/${section}/${res.body.id}`).set('X-CSRF-Token', alice.csrf).send({ ...body, description: 'Edited' }).expect(200);
            await bob.client.put(`/api/profile/${section}/${res.body.id}`).set('X-CSRF-Token', bob.csrf).send(body).expect(404);
            await bob.client.delete(`/api/profile/${section}/${res.body.id}`).set('X-CSRF-Token', bob.csrf).expect(404);
        }
        await alice.client.put('/api/profile/skills').set('X-CSRF-Token', alice.csrf).send({ skills: ['SQL'] }).expect(200);
        await assert.rejects(repo.replaceList(candidate.candidate_id, 'skills', ['duplicate', 'duplicate']));
        assert.deepEqual((await repo.profile(aliceId)).skills, ['SQL'], 'failed list replacement rolls back');
        await alice.client.put('/api/profile/languages').set('X-CSRF-Token', alice.csrf).send({ languages: [{ language_name: 'English', can_read: true, can_write: false }] }).expect(200);
        const file = await alice.client.post('/api/profile/resume').set('X-CSRF-Token', alice.csrf).attach('resume', Buffer.from('Local MySQL resume'), 'resume.txt').expect(201);
        await alice.client.get(`/api/profile/resume/${file.body.id}`).expect(200);
        await bob.client.get(`/api/profile/resume/${file.body.id}`).expect(404);
        const fresh = await login('alice@example.test');
        const profile = (await fresh.client.get('/api/profile').expect(200)).body.profile;
        assert.equal(profile.personal_summary, 'Persisted in MySQL'); assert.equal(profile.full_name, 'Alice Updated');
        for (const section of Object.keys(values)) assert.equal(profile[section][0].description, 'Edited');
        assert.equal(profile.languages[0].can_write, 0); assert.equal(profile.resumes.length, 1);

        // Preserve team-owned sessions, even when their payload names the same account.
        await pool.query('INSERT INTO MODULE_SESSION VALUES (?, ?, ?)', ['team-session', JSON.stringify({ account_id: aliceId }), new Date(Date.now() + 3600000)]);
        await pool.query('INSERT INTO MODULE_SESSION VALUES (?, ?, ?)', ['candidate:invalid-json', 'not json', new Date(Date.now() + 3600000)]);
        await request(app).post('/api/forgot-password').send({ email: 'alice@example.test' }).expect(200);
        const verification = await request(app).post('/api/check-email').send({ email: 'alice@example.test', code }).expect(200);
        const results = await Promise.all([1, 2].map(() => request(app).post('/api/set-new-password').send({ resetToken: verification.body.resetToken, newPassword: 'NewPassword2!' })));
        assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
        await alice.client.get('/api/me').expect(401); await fresh.client.get('/api/me').expect(401);
        await bob.client.get('/api/me').expect(200);
        const [[team]] = await pool.query("SELECT COUNT(*) AS total FROM MODULE_SESSION WHERE sid='team-session'");
        assert.equal(team.total, 1);
        await login('alice@example.test', 'NewPassword2!');

        // Contend for the account lock: an old-password login can never survive reset.
        const now = new Date(), newHash = await bcrypt.hash('FinalPassword3!', 10);
        await repo.saveReset(aliceId, 'a'.repeat(64), new Date(+now + 600000), new Date(+now + 61000));
        await repo.verifyCode(aliceId, 'a'.repeat(64), 'b'.repeat(64), new Date(+now + 600000), now);
        const sid = 'candidate:concurrent-login';
        await Promise.all([
            repo.login('alice@example.test', 'NewPassword2!', { sid, csrf: 'test', expires: new Date(+now + 3600000) }, hash),
            repo.consumeReset('b'.repeat(64), newHash, now)
        ]);
        assert.equal(await repo.session(sid), null);
        assert.equal((await repo.candidate(bobId)).full_name, 'Bob Test');
        console.log('PASS: real MySQL migration/replay/linking, persistence, ownership, rollback, reset concurrency and team-session isolation.');
    } finally {
        if (pool) await pool.end();
        try { if (created) await admin.query(`DROP DATABASE \`${database}\``); }
        finally { await admin.end(); if (uploadDir) await fs.rm(uploadDir, { recursive: true, force: true }); }
    }
}
main().catch(error => { console.error('Local MySQL integration failed:', error.code || error.message); process.exitCode = 1; });
