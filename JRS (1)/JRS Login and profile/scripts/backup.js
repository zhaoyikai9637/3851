// Read-only table snapshot. Restore into an EMPTY recovery database after review.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2');
const { loadConfig, ROOT } = require('../server/config/config');
const { createPool } = require('../server/config/db');

async function main() {
    const config = loadConfig();
    if (!process.argv.includes(`--database=${config.db.database}`)) throw new Error('Pass --database=EXACT_DATABASE_NAME for the read-only snapshot.');
    const pool = createPool({ ...config, db: { ...config.db, dateStrings: true } });
    let connection;
    try {
        connection = await pool.getConnection();
        // ANSI/NO_TABLE_OPTIONS can omit engine/charset and quote DDL differently.
        // Normalize this read-only export session so SHOW CREATE retains full options.
        await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");
        // This exporter deliberately refuses objects it cannot faithfully preserve.
        for (const [table, schemaColumn, predicate] of [
            ['VIEWS', 'TABLE_SCHEMA', ''], ['TRIGGERS', 'TRIGGER_SCHEMA', ''],
            ['ROUTINES', 'ROUTINE_SCHEMA', ''], ['EVENTS', 'EVENT_SCHEMA', '']
        ]) {
            const [[row]] = await connection.query(`SELECT COUNT(*) AS total FROM information_schema.${table} WHERE ${schemaColumn} = DATABASE() ${predicate}`);
            if (row.total) throw new Error(`Found ${table}; use a full administrator backup instead of this table-only exporter.`);
        }
        const [tables] = await connection.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
        if (tables.some(t => t.ENGINE !== 'InnoDB')) throw new Error('Non-InnoDB tables need an administrator backup.');
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        const sql = ['-- JRS pre-migration table snapshot. Contains PRIVATE data; do not commit or share.',
            '-- Restore only into an empty recovery database. No DROP statements are included.',
            "SET NAMES utf8mb4;", "SET time_zone = '+00:00';",
            "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';", 'SET FOREIGN_KEY_CHECKS = 0;'];
        const counts = {};
        for (const { TABLE_NAME: name } of tables) {
            const quoted = mysql.escapeId(name);
            const [[definition]] = await connection.query(`SHOW CREATE TABLE ${quoted}`);
            sql.push(`${definition['Create Table']};`);
            const [rows] = await connection.query(`SELECT * FROM ${quoted}`);
            counts[name] = rows.length;
            for (const row of rows) {
                sql.push(`INSERT INTO ${quoted} (${Object.keys(row).map(key => mysql.escapeId(key)).join(', ')}) VALUES (${Object.values(row).map(value => mysql.escape(value, false, 'Z')).join(', ')});`);
            }
        }
        await connection.commit();
        sql.push('SET FOREIGN_KEY_CHECKS = 1;', '');
        const body = sql.join('\n');
        const directory = path.join(ROOT, '.local-backup', 'database', new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex'));
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, 'schema-and-data.sql'), body, { flag: 'wx', mode: 0o600 });
        await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ database: config.db.database,
            createdAt: new Date().toISOString(), counts, sha256: crypto.createHash('sha256').update(body).digest('hex'),
            scope: 'Base tables and rows; no credentials. Concurrent DDL must be paused during snapshot.' }, null, 2), { flag: 'wx', mode: 0o600 });
        console.log('Read-only snapshot saved:', path.relative(ROOT, directory));
        console.log('Tables:', tables.length, 'Rows:', Object.values(counts).reduce((a, b) => a + b, 0));
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
