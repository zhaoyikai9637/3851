const { loadConfig } = require('./config/config');
const { createPool } = require('./config/db');
const { Repository } = require('./services/repository');
const { createMailer } = require('./services/mailer');
const { createApp } = require('./app');

async function start({ config = loadConfig() } = {}) {
    const pool = createPool(config);
    try {
        // Startup is read-only; run schema migrations separately.
        await pool.query('SELECT account_id, first_name, personal_summary FROM CANDIDATE LIMIT 0');
        await pool.query('SELECT account_id FROM JRS_PASSWORD_RESET LIMIT 0');
        const app = createApp({ repository: new Repository(pool), config, mailer: createMailer(config) });
        const server = app.listen(config.port, config.host, () => {
            console.log(`JRS: ${config.origin}/pages/login/login.html`);
            if (!config.smtp.host || !config.smtp.pass) console.log('Configure SMTP to enable password recovery.');
        });
        const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        return server;
    } catch (error) {
        await pool.end();
        if (['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
            console.error('Startup stopped: required JRS database tables or columns are missing; migrations are incomplete.');
            console.error('Run npm run db:check first. Back up the target and obtain shared-database write approval before applying reviewed migrations and restarting.');
            console.error('Startup did not modify the database. Error code:', error.code);
        } else {
            console.error('Startup failed. Check database TLS/configuration and the reviewed migration. Error code:', error.code || 'CONFIGURATION');
        }
        throw error;
    }
}
if (require.main === module) start().catch(error => { if (!error.code) console.error(error.message); process.exitCode = 1; });
module.exports = { start };
