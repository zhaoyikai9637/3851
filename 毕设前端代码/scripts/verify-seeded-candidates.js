// Verify only the seed accounts, plus preservation of the pre-migration snapshot.
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
async function main() {
    function localArgument(name, folder) {
        const value = process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
        if (!value) throw new Error(`Missing --${name}=PATH`);
        const resolved = path.resolve(ROOT, value);
        assert.ok(resolved.startsWith(path.join(ROOT, '.local-backup', folder) + path.sep));
        return resolved;
    }
    const credentials = JSON.parse(await fs.readFile(localArgument('credentials', 'seed-candidates'), 'utf8'));
    const backup = localArgument('backup', 'database');
    const snapshot = await fs.readFile(path.join(backup, 'schema-and-data.sql'), 'utf8');
    const manifest = JSON.parse(await fs.readFile(path.join(backup, 'manifest.json'), 'utf8'));
    assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'), manifest.sha256);
    const config = loadConfig();
    assert.equal(config.db.database, credentials.database);
    assert.equal(config.db.database, manifest.database);
    const pool = createPool({ ...config, db: { ...config.db, dateStrings: true } });
    try {
        // Compare original rows using only their original columns; new columns/rows are allowed.
        let preserved = 0;
        for (const name of Object.keys(manifest.counts)) {
            const prefix = `INSERT INTO ${mysql.escapeId(name)} (`;
            const original = snapshot.split('\n').filter(line => line.startsWith(prefix));
            if (!original.length) continue;
            const names = original[0].slice(prefix.length, original[0].indexOf(') VALUES (')).split(', ').map(key => key.slice(1, -1).replace(/``/g, '`'));
            const [rows] = await pool.query(`SELECT ${names.map(key => mysql.escapeId(key)).join(', ')} FROM ${mysql.escapeId(name)}`);
            const actual = new Set(rows.map(row => `${prefix}${Object.keys(row).map(key => mysql.escapeId(key)).join(', ')}) VALUES (${Object.values(row).map(value => mysql.escape(value, false, 'Z')).join(', ')});`));
            for (const line of original) { assert.ok(actual.has(line), `Original row changed in ${name}`); preserved++; }
        }
        const app = createApp({ repository: new Repository(pool), config, mailer: { ready: false } });
        for (const account of credentials.accounts) {
            const login = await request(app).post('/api/login').set('Origin', config.origin).send(account).expect(200);
            const cookie = login.headers['set-cookie'].map(value => value.split(';')[0]).join('; ');
            try {
                const result = await request(app).get('/api/profile').set('Cookie', cookie).expect(200);
                const p = result.body.profile;
                assert.equal(p.email, account.email);
                for (const section of ['career', 'education', 'certifications']) assert.equal(p[section].length, 1);
                assert.equal(p.skills.length, 4); assert.equal(p.languages.length, 2); assert.equal(p.resumes.length, 0);
                assert.ok(p.full_name && p.personal_summary);
            } finally {
                await request(app).post('/api/logout').set('Origin', config.origin).set('Cookie', cookie).set('X-CSRF-Token', login.body.csrfToken).expect(200);
            }
        }
        console.log(`Verified ${preserved} original rows preserved; all 3 seed accounts log in and load complete profiles; test sessions signed out.`);
    } finally { await pool.end(); }
}
main().catch(error => { console.error(error.code || (error.name === 'AssertionError' ? 'Seed verification assertion failed.' : error.message)); process.exitCode = 1; });
