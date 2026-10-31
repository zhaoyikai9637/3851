// Restore only into a random disposable database on LOOPBACK. Never reads .env.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
async function main() {
    if (!process.env.TEST_MYSQL_PASSWORD) throw new Error('Set the disposable local TEST_MYSQL_PASSWORD.');
    const arg = process.argv.find(s => s.startsWith('--directory='))?.slice(12);
    if (!arg) throw new Error('Pass --directory=PATH_TO_LOCAL_BACKUP.');
    const backupRoot = path.resolve(__dirname, '../.local-backup/database');
    const directory = path.resolve(arg);
    if (!directory.startsWith(backupRoot + path.sep)) throw new Error('Backup must be within .local-backup/database.');
    const sql = await fs.readFile(path.join(directory, 'schema-and-data.sql'), 'utf8');
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    assert.equal(crypto.createHash('sha256').update(sql).digest('hex'), manifest.sha256, 'Backup checksum mismatch');
    const database = 'jrs_backup_verify_' + crypto.randomBytes(8).toString('hex');
    const config = { host: '127.0.0.1', port: Number(process.env.TEST_MYSQL_PORT || 33306), user: 'root',
        password: process.env.TEST_MYSQL_PASSWORD, multipleStatements: true, timezone: 'Z', dateStrings: true };
    const admin = await mysql.createConnection(config);
    let db, created = false;
    try {
        await admin.query(`CREATE DATABASE \`${database}\``); created = true;
        db = await mysql.createConnection({ ...config, database });
        const statements = sql.split(/;\n/).map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < statements.length; i++) {
            try { await db.query(statements[i]); }
            catch (error) { console.error('Local restore statement:', i + 1); throw error; }
        }
        const [tables] = await db.query('SHOW TABLES');
        assert.equal(tables.length, Object.keys(manifest.counts).length);
        for (const [name, expected] of Object.entries(manifest.counts)) {
            const [[count]] = await db.query('SELECT COUNT(*) AS total FROM ' + mysql.escapeId(name));
            assert.equal(count.total, expected, `Restore row count mismatch: ${name}`);
        }
        // MySQL versions differ in printing an explicit charset next to COLLATE.
        // COLLATE already fixes that charset; normalize only this redundant DDL text.
        const canonicalDDL = text => text.replace(/ CHARACTER SET (\w+) COLLATE \1_/g, ' COLLATE $1_');
        for (const name of Object.keys(manifest.counts)) {
            const [[definition]] = await db.query('SHOW CREATE TABLE ' + mysql.escapeId(name));
            const original = statements.find(s => s.startsWith('CREATE TABLE ' + mysql.escapeId(name) + ' '));
            assert.equal(canonicalDDL(original), canonicalDDL(definition['Create Table']), `Restored table definition differs: ${name}`);
            const [rows] = await db.query('SELECT * FROM ' + mysql.escapeId(name));
            const prefix = `INSERT INTO ${mysql.escapeId(name)} (`;
            const originalRows = statements.filter(s => s.startsWith(prefix)).sort();
            const restoredRows = rows.map(row => `${prefix}${Object.keys(row).map(k => mysql.escapeId(k)).join(', ')}) VALUES (${Object.values(row).map(v => mysql.escape(v, false, 'Z')).join(', ')})`).sort();
            assert.deepEqual(restoredRows, originalRows, `Restored row contents differ: ${name}`);
        }
        console.log('PASS: backup restored locally; table definitions, row counts and full contents match.');
    } finally {
        if (db) await db.end();
        try { if (created) await admin.query(`DROP DATABASE \`${database}\``); }
        finally { await admin.end(); }
    }
}
main().catch(error => { console.error(error.name === 'AssertionError' ? error.message.split('\n')[0] : error.code || error.message); process.exitCode = 1; });
