const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadConfig } = require('../server/config/config');
const { createPool, transaction } = require('../server/config/db');

const migrationFile = path.join(__dirname, '../migrations/001_candidate.sql');
const statements = fs.readFileSync(migrationFile, 'utf8').replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
function validateLedger(completed) {
    const ordered = [...completed].sort((a, b) => a.step_id - b.step_id);
    for (let i = 0; i < ordered.length; i++) {
        const row = ordered[i];
        if (row.step_id !== i + 1 || row.step_id > statements.length) throw new Error('Migration ledger has gaps or unknown steps. Stop and review.');
        const checksum = crypto.createHash('sha256').update(statements[i]).digest('hex');
        if (row.checksum !== checksum) throw new Error('Migration changed after application. Stop and review.');
    }
}
async function run(options = {}) {
    const config = options.config || loadConfig(), apply = options.apply ?? process.argv.includes('--apply');
    const linkExisting = options.linkExisting ?? process.argv.includes('--link-existing');
    const expectedDatabase = options.expectedDatabase ?? process.argv.find(s => s.startsWith('--database='))?.slice(11);
    if (apply && expectedDatabase !== config.db.database) throw new Error('For writes, pass --apply --database=EXACT_DATABASE_NAME after backup/review.');
    const pool = createPool(config);
    let lock;
    try {
        const [base] = await pool.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('MODULE_ACCOUNT', 'CANDIDATE', 'MODULE_SESSION')`);
        const required = { MODULE_ACCOUNT: ['account_id', 'email', 'password_hash', 'role'], CANDIDATE: ['candidate_id', 'full_name', 'email'], MODULE_SESSION: ['sid', 'data', 'expires'] };
        for (const [table, columns] of Object.entries(required)) for (const name of columns) {
            if (!base.some(c => c.TABLE_NAME === table && c.COLUMN_NAME === name)) throw new Error(`Missing baseline column ${table}.${name}. Stop and review the actual schema.`);
        }
        for (const [table, key] of [['MODULE_ACCOUNT', 'account_id'], ['CANDIDATE', 'candidate_id']]) {
            const col = base.find(c => c.TABLE_NAME === table && c.COLUMN_NAME === key);
            if (!/^int(?:\(\d+\))?$/.test(col.COLUMN_TYPE)) throw new Error(`${table}.${key} must match the reviewed signed INT schema.`);
        }
        const [[duplicates]] = await pool.query('SELECT COUNT(*) AS total FROM (SELECT email FROM CANDIDATE GROUP BY email HAVING COUNT(*) > 1) AS duplicate_emails');
        const [[legacyPasswords]] = await pool.query("SELECT COUNT(*) AS total FROM MODULE_ACCOUNT WHERE role = 'candidate' AND password_hash NOT REGEXP '^[$]2[aby][$][0-9]{2}[$]'");
        console.log(`Duplicate candidate email groups: ${duplicates.total}; candidate passwords requiring recovery: ${legacyPasswords.total}.`);
        if (linkExisting && duplicates.total) throw new Error('Resolve duplicate candidate emails before linking. No rows were linked.');
        const [tables] = await pool.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
        const tableSet = new Set(tables.map(t => t.TABLE_NAME));
        const hasLedger = tableSet.has('JRS_SCHEMA_MIGRATION');
        if (!hasLedger) {
            const newTables = statements.map(s => /^CREATE TABLE (\w+)/.exec(s)?.[1]).filter(Boolean);
            if (newTables.some(t => tableSet.has(t)) || base.some(c => c.TABLE_NAME === 'CANDIDATE' && c.COLUMN_NAME === 'account_id')) {
                throw new Error('Target schema already partly exists without this migration ledger. Review it manually; no automatic adoption.');
            }
        }
        let completed = [];
        if (hasLedger) [completed] = await pool.query('SELECT step_id, checksum FROM JRS_SCHEMA_MIGRATION');
        validateLedger(completed);
        console.log(`Schema steps pending: ${statements.length - completed.length}. Mode: ${apply ? 'APPLY' : 'READ-ONLY'}.`);
        if (!apply) { console.log('Review migrations/001_candidate.sql. No database writes were performed.'); return; }
        lock = await pool.getConnection();
        const [[result]] = await lock.query("SELECT GET_LOCK('jrs_candidate_migration', 0) AS acquired");
        if (result.acquired !== 1) throw new Error('Another migration is running.');
        await lock.query('CREATE TABLE IF NOT EXISTS JRS_SCHEMA_MIGRATION (step_id INT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
        // Reread after acquiring the lock to prevent using a stale preflight snapshot.
        [completed] = await lock.query('SELECT step_id, checksum FROM JRS_SCHEMA_MIGRATION');
        validateLedger(completed);
        for (let i = 0; i < statements.length; i++) {
            const sql = statements[i], checksum = crypto.createHash('sha256').update(sql).digest('hex');
            if (completed.some(r => r.step_id === i + 1 && r.checksum === checksum)) continue;
            // Crash between DDL and journal write is deliberately not auto-adopted.
            // An administrator must inspect/record that one step before resuming.
            await lock.query(sql);
            await lock.query('INSERT INTO JRS_SCHEMA_MIGRATION (step_id, checksum) VALUES (?, ?)', [i + 1, checksum]);
            console.log(`Applied schema step ${i + 1}/${statements.length}.`);
        }
        if (linkExisting) {
            await transaction(pool, async db => {
                // Lock profiles and recheck after DDL; preflight may have become stale.
                await db.query('SELECT candidate_id FROM CANDIDATE FOR UPDATE');
                const [[duplicates]] = await db.query('SELECT COUNT(*) AS total FROM (SELECT email FROM CANDIDATE GROUP BY email HAVING COUNT(*) > 1) AS duplicate_emails');
                if (duplicates.total) throw new Error('Duplicate candidate emails detected; no rows linked.');
                const [result] = await db.query(`UPDATE CANDIDATE c JOIN MODULE_ACCOUNT a ON c.email = a.email
                    SET c.account_id = a.account_id WHERE c.account_id IS NULL AND a.role = 'candidate'
                    AND NOT EXISTS (SELECT 1 FROM (SELECT account_id FROM CANDIDATE WHERE account_id IS NOT NULL) linked WHERE linked.account_id = a.account_id)`);
                console.log(`Linked existing profiles: ${result.affectedRows}. Original names and IDs retained.`);
            });
        }
        console.log('Migration complete. Unlinked historical candidates remain unchanged.');
    } finally {
        try { if (lock) await lock.query("SELECT RELEASE_LOCK('jrs_candidate_migration')"); }
        finally { if (lock) lock.release(); await pool.end(); }
    }
}
if (require.main === module) run().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { statements, validateLedger, run };
