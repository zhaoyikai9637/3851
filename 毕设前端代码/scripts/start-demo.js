// Persistent LOCAL MySQL demonstration. Cloud .env and runtime code are retained.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const { loadConfig, ROOT } = require('../server/config/config');
const { createPool } = require('../server/config/db');
const { Repository } = require('../server/services/repository');
const { run } = require('./migrate');
const { start } = require('../server/server');
const bcrypt = require('bcrypt');
const container = 'jrs-candidate-demo';
async function docker(args) {
    try { return (await execute('docker', args, { windowsHide: true, timeout: 120000 })).stdout.trim(); }
    catch { throw new Error('DEMO_DOCKER_FAILED: ensure Docker Desktop is running and port 33306 is available.'); }
}
async function main() {
    const directory = path.join(ROOT, '.local-backup/demo');
    const tlsDirectory = path.join(directory, 'tls');
    await fs.mkdir(tlsDirectory, { recursive: true });
    const settingsFile = path.join(directory, 'settings.json');
    let settings;
    try { settings = JSON.parse(await fs.readFile(settingsFile, 'utf8')); }
    catch (e) {
        if (e.code !== 'ENOENT') throw e;
        settings = { password: crypto.randomBytes(32).toString('hex'), database: 'jrs_candidate_demo' };
        await fs.writeFile(settingsFile, JSON.stringify(settings), { flag: 'wx', mode: 0o600 });
    }
    if (settings.database !== 'jrs_candidate_demo') throw new Error('Unexpected local demo database name.');
    const envFile = path.join(directory, 'mysql.env');
    await fs.writeFile(envFile, `MYSQL_ROOT_PASSWORD=${settings.password}\n`, { mode: 0o600 });
    const certFile = path.join(tlsDirectory, 'cert.pem');
    try { await fs.access(certFile); }
    catch {
        console.log('Preparing local TLS certificate...');
        await docker(['run', '--rm', '--entrypoint', 'openssl', '--mount', `type=bind,source=${tlsDirectory},target=/certs`,
            'mysql:8.4', 'req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '365',
            '-subj', '/CN=JRS-local-demo', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
            '-keyout', '/certs/key.pem', '-out', '/certs/cert.pem']);
    }
    // Copy keys into a Linux volume so mysqld can read its own 0600 key.
    await docker(['run', '--rm', '--entrypoint', 'sh',
        '--mount', `type=bind,source=${tlsDirectory},target=/input,readonly`,
        '--mount', 'type=volume,source=jrs-candidate-demo-tls,target=/tls', 'mysql:8.4', '-c',
        'cp /input/cert.pem /tls/cert.pem && cp /input/key.pem /tls/key.pem && chown mysql:mysql /tls/cert.pem /tls/key.pem && chmod 600 /tls/key.pem && chmod 644 /tls/cert.pem']);
    const names = await docker(['ps', '-a', '--format', '{{.Names}}']);
    if (names.split(/\r?\n/).includes(container)) {
        await docker(['start', container]);
    } else {
        console.log('Creating persistent local MySQL demonstration...');
        await docker(['run', '--detach', '--name', container, '--publish', '127.0.0.1:33306:3306',
            '--env-file', envFile, '--mount', 'type=volume,source=jrs-candidate-demo-data,target=/var/lib/mysql',
            '--mount', 'type=volume,source=jrs-candidate-demo-tls,target=/etc/mysql/demo-tls,readonly',
            'mysql:8.4', '--ssl-ca=/etc/mysql/demo-tls/cert.pem', '--ssl-cert=/etc/mysql/demo-tls/cert.pem',
            '--ssl-key=/etc/mysql/demo-tls/key.pem', '--require-secure-transport=ON']);
    }
    const base = loadConfig();
    const db = { host: '127.0.0.1', port: 33306, user: 'root', password: settings.password,
        ssl: { ca: await fs.readFile(certFile, 'utf8'), rejectUnauthorized: true }, timezone: 'Z', connectionLimit: 10 };
    const admin = createPool({ db });
    try {
        let connected = false;
        for (let i = 0; i < 60; i++) {
            try { await admin.query('SELECT 1'); connected = true; break; }
            catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
        }
        if (!connected) throw new Error('LOCAL_MYSQL_NOT_READY');
        await admin.query('CREATE DATABASE IF NOT EXISTS jrs_candidate_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    } finally { await admin.end(); }
    const config = { ...base, port: 3001, host: '127.0.0.1', origin: 'http://localhost:3001', production: false,
        uploadDir: path.join(ROOT, 'uploads/demo-private'), db: { ...db, database: settings.database } };
    const pool = createPool(config);
    try {
        await pool.query('CREATE TABLE IF NOT EXISTS HR_USER (user_id INT PRIMARY KEY) ENGINE=InnoDB');
        await pool.query(`CREATE TABLE IF NOT EXISTS MODULE_ACCOUNT (account_id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(150) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL,
            hr_user_id INT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (hr_user_id) REFERENCES HR_USER(user_id)) ENGINE=InnoDB`);
        await pool.query(`CREATE TABLE IF NOT EXISTS CANDIDATE (candidate_id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
        await pool.query('CREATE TABLE IF NOT EXISTS MODULE_SESSION (sid VARCHAR(128) PRIMARY KEY, data MEDIUMTEXT, expires DATETIME, INDEX(expires)) ENGINE=InnoDB');
        await run({ config, apply: true, expectedDatabase: settings.database, linkExisting: false });
        const repo = new Repository(pool);
        if (!await repo.findAccount('demo@example.test')) {
            await repo.register('demo@example.test', await bcrypt.hash('DemoPass2026!', 12), 'Demo', 'Candidate');
        }
    } finally { await pool.end(); }
    console.log('LOCAL DEMONSTRATION: real APIs + persistent MySQL; cloud configuration unchanged.');
    await start({ config });
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
