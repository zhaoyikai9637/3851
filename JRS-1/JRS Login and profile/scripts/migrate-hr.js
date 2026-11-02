const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createPool } = require('../server/config/db');
const { loadConfig } = require('../server/config/config');
const { loadCoordinatorConfig } = require('./hr-coordinator-config');
const statements = fs.readFileSync(path.join(__dirname, '../migrations/002_hr_workspace.sql'), 'utf8').replace(/^--.*$/gm, '').split(';').map(sql => sql.trim()).filter(Boolean);
async function run({ config = loadConfig(), apply = false, expectedDatabase } = {}) {
    if (apply && expectedDatabase !== config.db.database) throw new Error('Require --apply --database=EXACT_DATABASE_NAME.');
    const pool = createPool(config);
    let conn;
    try {
        conn = await pool.getConnection();
        const [tables] = await conn.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
        const existing = new Set(tables.map(row => row.TABLE_NAME));
        const hasLedger = existing.has('JRS_HR_SCHEMA_MIGRATION');
        if (!hasLedger && statements.some(sql => existing.has(/^CREATE TABLE (\w+)/.exec(sql)?.[1]))) throw new Error('HR tables exist without a migration ledger; manual review required.');
        function validate(rows) {
            rows.sort((a, b) => a.step_id - b.step_id);
            rows.forEach((row, index) => {
                if (row.step_id !== index + 1 || row.step_id > statements.length || row.checksum !== crypto.createHash('sha256').update(statements[index]).digest('hex')) throw new Error('HR migration ledger mismatch; stop and review.');
            });
        }
        let completed = hasLedger ? (await conn.query('SELECT step_id, checksum FROM JRS_HR_SCHEMA_MIGRATION'))[0] : [];
        validate(completed);
        console.log(`HR schema steps pending: ${statements.length - completed.length}. Mode: ${apply ? 'APPLY' : 'READ-ONLY'}.`);
        if (!apply) return;
        const [[lock]] = await conn.query("SELECT GET_LOCK('jrs_hr_workspace_migration',0) AS acquired");
        if (lock.acquired !== 1) throw new Error('Another HR migration is running.');
        await conn.query('CREATE TABLE IF NOT EXISTS JRS_HR_SCHEMA_MIGRATION (step_id INT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
        [completed] = await conn.query('SELECT step_id, checksum FROM JRS_HR_SCHEMA_MIGRATION'); validate(completed);
        for (let i = completed.length; i < statements.length; i++) {
            await conn.query(statements[i]);
            await conn.execute('INSERT INTO JRS_HR_SCHEMA_MIGRATION(step_id,checksum) VALUES (?,?)', [i + 1, crypto.createHash('sha256').update(statements[i]).digest('hex')]);
            console.log(`Applied HR schema step ${i + 1}/${statements.length}.`);
        }
    } finally {
        if (conn) { try { await conn.query("SELECT RELEASE_LOCK('jrs_hr_workspace_migration')"); } finally { conn.release(); } }
        await pool.end();
    }
}
if (require.main === module) {
    const apply = process.argv.includes('--apply');
    run({ config: apply ? loadCoordinatorConfig() : loadConfig(), apply, expectedDatabase: process.argv.find(arg => arg.startsWith('--database='))?.slice(11) }).catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
}
module.exports = { run, statements };
