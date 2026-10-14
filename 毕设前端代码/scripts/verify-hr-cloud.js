// Verify newly seeded HR identities and existing durable records without changing business data.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysql = require('mysql2');
const request = require('supertest');
const { loadConfig, ROOT } = require('../server/config/config');
const { createPool } = require('../server/config/db');
const { Repository } = require('../server/services/repository');
const { createApp } = require('../server/app');
function argument(name, folder) {
    const value = process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
    if (!value) throw new Error(`Missing --${name}=PATH`);
    const resolved = path.resolve(ROOT, value);
    assert.ok(resolved.startsWith(path.join(ROOT, '.local-backup', folder) + path.sep));
    return resolved;
}
async function main() {
    const credentials = JSON.parse(await fs.readFile(argument('credentials', 'seed-hr'), 'utf8'));
    const backup = argument('backup', 'database');
    const manifest = JSON.parse(await fs.readFile(path.join(backup, 'manifest.json'), 'utf8'));
    const snapshot = await fs.readFile(path.join(backup, 'schema-and-data.sql'), 'utf8');
    assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'), manifest.sha256);
    const config = loadConfig();
    assert.equal(credentials.database, config.db.database); assert.equal(manifest.database, config.db.database);
    const pool = createPool({ ...config, db: { ...config.db, dateStrings: true } });
    try {
        let preserved = 0;
        for (const name of Object.keys(manifest.counts)) {
            // Session/rate-limit/reset tables are live operational state, not durable profile records.
            if (['MODULE_SESSION', 'JRS_RATE_LIMIT', 'JRS_PASSWORD_RESET'].includes(name)) continue;
            const prefix = `INSERT INTO ${mysql.escapeId(name)} (`;
            const original = snapshot.split('\n').filter(line => line.startsWith(prefix));
            if (!original.length) continue;
            const names = original[0].slice(prefix.length, original[0].indexOf(') VALUES (')).split(', ').map(key => key.slice(1, -1).replace(/``/g, '`'));
            const [rows] = await pool.query(`SELECT ${names.map(key => mysql.escapeId(key)).join(', ')} FROM ${mysql.escapeId(name)}`);
            const actual = new Set(rows.map(row => `${prefix}${Object.keys(row).map(key => mysql.escapeId(key)).join(', ')}) VALUES (${Object.values(row).map(value => mysql.escape(value, false, 'Z')).join(', ')});`));
            for (const row of original) { assert.ok(actual.has(row), `Existing row changed in ${name}`); preserved++; }
        }
        const app = createApp({ repository: new Repository(pool), config, mailer: { ready: false } });
        await request(app).get('/hr/api/hr/workspace').expect(401);
        for (const account of credentials.accounts) {
            const login = await request(app).post('/api/login').set('Origin', config.origin).send({ email: account.email, password: account.password }).expect(200);
            assert.equal(login.body.user.role, 'hr');
            const cookie = login.headers['set-cookie'].map(value => value.split(';')[0]).join('; ');
            try {
                const me = await request(app).get('/hr/api/auth/me').set('Cookie', cookie).expect(200);
                assert.equal(me.body.user.name, account.name); assert.equal(me.body.user.role, account.role);
                const workspace = await request(app).get('/hr/api/hr/workspace').set('Cookie', cookie).expect(200);
                assert.equal(workspace.body.currentUser.name, account.name); assert.equal(workspace.body.templates.length, 5);
                await request(app).get('/api/profile').set('Cookie', cookie).expect(403);
                await request(app).post('/hr/api/auth/logout').set('Cookie', cookie).send({}).expect(403);
                await request(app).post('/hr/api/auth/logout').set('Origin', 'https://untrusted.invalid').set('Cookie', cookie).set('X-CSRF-Token', login.body.csrfToken).send({}).expect(403);
                console.log(`Verified shared login and HR workspace: ${account.role}; ${workspace.body.templates.length} templates.`);
            } finally {
                await request(app).post('/hr/api/auth/logout').set('Cookie', cookie).set('X-CSRF-Token', login.body.csrfToken).send({}).expect(200);
            }
            await request(app).get('/api/me').set('Cookie', cookie).expect(401);
        }
        console.log(`PASS: ${preserved} pre-existing durable rows preserved; manager/staff login, HR workspace, role isolation, CSRF, origin and logout verified against cloud SQL. No mail sent.`);
    } finally { await pool.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
