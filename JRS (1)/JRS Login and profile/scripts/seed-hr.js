const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { loadConfig, ROOT } = require('../server/config/config');
const { createPool, transaction } = require('../server/config/db');
const { templates } = require('../integrations/hr/scripts/database.cjs');
async function run({ config = loadConfig(), apply = false, expectedDatabase } = {}) {
    if (apply && expectedDatabase !== config.db.database) throw new Error('Require --apply --database=EXACT_DATABASE_NAME.');
    const pool = createPool(config);
    try {
        await pool.query('SELECT user_id, employee_id, account_status FROM HR_USER LIMIT 0');
        await pool.query('SELECT id FROM jrs_portal_hr_user LIMIT 0');
        await pool.query('SELECT id FROM jrs_portal_hr_workspace LIMIT 0');
        if (!apply) { console.log('HR schema ready. No writes performed.'); return; }
        const accounts = [
            { email: 'jrs.seed.hr.manager@example.test', name: 'Taylor Chen', role: 'HR_MANAGER', employeeId: 'JRS-SEED-HR-001' },
            { email: 'jrs.seed.hr.staff@example.test', name: 'Casey Wong', role: 'HR_STAFF', employeeId: 'JRS-SEED-HR-002' }
        ].map(row => ({ ...row, password: 'Jrs!' + crypto.randomBytes(18).toString('base64url') }));
        const folder = path.join(ROOT, '.local-backup/seed-hr'); await fs.mkdir(folder, { recursive: true });
        const file = path.join(folder, crypto.randomUUID() + '.json');
        await fs.writeFile(file, JSON.stringify({ database: config.db.database, accounts }, null, 2), { flag: 'wx', mode: 0o600 });
        const hashes = await Promise.all(accounts.map(row => bcrypt.hash(row.password, 12)));
        const result = await transaction(pool, async db => {
            const at = new Date().toISOString();
            await db.execute('INSERT IGNORE INTO jrs_portal_hr_workspace(id,revision,created_at,updated_at) VALUES(1,0,?,?)', [at, at]);
            const added = [], skipped = [];
            for (const [index, row] of accounts.entries()) {
                const [[account]] = await db.execute('SELECT account_id FROM MODULE_ACCOUNT WHERE email=?', [row.email]);
                const [[hr]] = await db.execute('SELECT user_id FROM HR_USER WHERE email=? OR employee_id=?', [row.email, row.employeeId]);
                const [[workspaceUser]] = await db.execute('SELECT id FROM jrs_portal_hr_user WHERE email=? OR employee_id=?', [row.email, row.employeeId]);
                if (account || hr || workspaceUser) { skipped.push(row.email); continue; }
                const [identity] = await db.execute("INSERT INTO HR_USER(employee_id,full_name,email,role,department,account_status) VALUES(?,?,?,?,'Human Resources','ACTIVE')", [row.employeeId, row.name, row.email, row.role]);
                const [login] = await db.execute("INSERT INTO MODULE_ACCOUNT(email,password_hash,role,hr_user_id) VALUES(?,?,'hr',?)", [row.email, hashes[index], identity.insertId]);
                await db.execute("INSERT INTO jrs_portal_hr_user(id,email,password_hash,name,role,employee_id,created_at) VALUES(?,?,'shared-auth-only',?,?,?,?)", [`team-hr-${identity.insertId}`, row.email, row.name, row.role, row.employeeId, at]);
                added.push({ email: row.email, accountId: login.insertId, hrUserId: identity.insertId, role: row.role });
            }
            for (const row of templates()) {
                const [[exists]] = await db.execute('SELECT id FROM jrs_portal_hr_email_template WHERE id=?', [row.id]);
                if (!exists) await db.execute('INSERT INTO jrs_portal_hr_email_template(id,name,kind,subject,body,active,updated_at) VALUES(?,?,?,?,?,1,?)', [row.id,row.name,row.kind,row.subject,row.body,row.updatedAt]);
            }
            return { added, skipped };
        });
        await fs.writeFile(file + '.result.json', JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
        console.log(JSON.stringify(result)); console.log(`Private HR test credentials: ${file}`);
        return { file, result };
    } finally { await pool.end(); }
}
if (require.main === module) run({ apply: process.argv.includes('--apply'), expectedDatabase: process.argv.find(arg => arg.startsWith('--database='))?.slice(11) }).catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { run };
