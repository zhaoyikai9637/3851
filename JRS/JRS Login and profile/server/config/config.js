const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '../..');
function loadConfig() {
    const dotenv = require('dotenv');
    const envFile = process.env.ENV_FILE ? path.resolve(process.env.ENV_FILE) :
        path.join(ROOT, '.env');
    const localFile = path.join(ROOT, '.env.local');
    const env = { ...(fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {}),
        ...(fs.existsSync(localFile) ? dotenv.parse(fs.readFileSync(localFile)) : {}), ...process.env };
    const production = env.NODE_ENV === 'production';
    const port = Number(env.PORT || 3001);
    const origin = new URL(env.APP_ORIGIN || `http://localhost:${port}`).origin;
    if (production && !origin.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS.');
    const resetSecret = env.RESET_SECRET || env.SESSION_SECRET || '';
    if (resetSecret.length < 32) throw new Error('Set RESET_SECRET to at least 32 random characters.');
    const caSetting = env.DB_SSL_CA || 'jrs-ca.pem';
    const ca = caSetting.includes('-----BEGIN CERTIFICATE-----') ? caSetting.replace(/\\n/g, '\n') :
        fs.readFileSync(path.resolve(path.dirname(envFile), caSetting), 'utf8');
    return {
        port, host: env.HOST || '127.0.0.1', origin, production, resetSecret,
        uploadDir: path.resolve(ROOT, env.UPLOAD_DIR || 'uploads/private'), sessionMs: 8 * 60 * 60 * 1000,
        db: { host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
            user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
            ssl: { ca, rejectUnauthorized: true },
            timezone: 'Z', connectionLimit: 10, waitForConnections: true },
        smtp: { enabled: env.MAIL_ALLOW_SMTP === 'true', host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465),
            secure: env.SMTP_SECURE !== 'false', user: env.SMTP_USER,
            pass: env.SMTP_PASS, from: env.SMTP_FROM || env.SMTP_USER }
    };
}
module.exports = { loadConfig, ROOT };
