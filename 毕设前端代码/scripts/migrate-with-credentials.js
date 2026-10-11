// Read the explicitly supplied local credential document without logging secrets.
// Coordinator credentials are used in this process only, never saved to .env.
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, ROOT } = require('../server/config/config');
const { createPool } = require('../server/config/db');
const { run } = require('./migrate');
function clean(value) { return value.trim().replace(/^[`'"]|[`'"]$/g, ''); }
async function main() {
    const text = fs.readFileSync(path.join(ROOT, '.local-backup/JRS_TEAM_DATABASE_CREDENTIALS.txt'), 'utf8');
    const section = text.match(/^Schema coordinator only:\s*\r?\n([^\r\n]+)/mi);
    const credentials = section?.[1].match(/username:\s*([^|\r\n]+)\|\s*password:\s*([^\r\n]+)/i);
    if (!credentials) throw new Error('Coordinator credentials not found in the supplied document.');
    const base = loadConfig();
    for (const [label, expected] of [['Host', base.db.host], ['Port', String(base.db.port)], ['Database', base.db.database]]) {
        const value = text.match(new RegExp('^' + label + ':\\s*(.+)$', 'mi'))?.[1];
        if (!value || clean(value) !== expected) throw new Error('Credential document target does not match current configuration.');
    }
    const config = { ...base, db: { ...base.db, user: clean(credentials[1]), password: clean(credentials[2]) } };
    const pool = createPool(config);
    try {
        const [rows] = await pool.query('SHOW GRANTS FOR CURRENT_USER');
        for (const row of rows) console.log(Object.values(row)[0].replace(/\sTO\s.*$/i, ''));
    } finally { await pool.end(); }
    const apply = process.argv.includes('--apply');
    const expectedDatabase = process.argv.find(s => s.startsWith('--database='))?.slice(11);
    await run({ config, apply, expectedDatabase, linkExisting: false });
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
