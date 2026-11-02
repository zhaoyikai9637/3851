// Read-only metadata inventory. Never prints account records or credentials.
const { loadConfig } = require('../server/config/config');
const { createPool } = require('../server/config/db');
async function main() {
    const pool = createPool(loadConfig());
    try {
        const [columns] = await pool.query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND (TABLE_NAME IN ('MODULE_ACCOUNT', 'HR_USER') OR TABLE_NAME LIKE 'hr\\_%') ORDER BY TABLE_NAME, ORDINAL_POSITION");
        console.log(JSON.stringify(columns));
        const [roles] = await pool.query('SELECT role, COUNT(*) AS total FROM MODULE_ACCOUNT GROUP BY role');
        console.log(JSON.stringify(roles));
    } finally { await pool.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
