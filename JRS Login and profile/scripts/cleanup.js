const { loadConfig } = require('../server/config/config');
const { createPool } = require('../server/config/db');
async function run() {
    const config = loadConfig();
    if (!process.argv.includes(`--database=${config.db.database}`)) throw new Error('Pass --database=EXACT_DATABASE_NAME to clean expired candidate auth data.');
    const pool = createPool(config);
    try {
        await pool.query("DELETE FROM MODULE_SESSION WHERE sid LIKE 'candidate:%' AND expires < UTC_TIMESTAMP()");
        await pool.query('DELETE FROM JRS_RATE_LIMIT WHERE expires_at < UTC_TIMESTAMP()');
        await pool.query('DELETE FROM JRS_PASSWORD_RESET WHERE expires_at < UTC_TIMESTAMP() AND (token_expires_at IS NULL OR token_expires_at < UTC_TIMESTAMP())');
        console.log('Expired candidate authentication data removed. Team sessions retained.');
    } finally { await pool.end(); }
}
run().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
