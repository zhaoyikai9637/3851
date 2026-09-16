'use strict';
const path = require('node:path');
function config(env = process.env) {
  const dbName = env.DB_NAME || 'jrs_hr_fullstack';
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(dbName)) throw Error('DB_NAME must contain only letters, numbers and underscores.');
  const port = Number(env.PORT || 3000);
  const origin = new URL(env.APP_ORIGIN || `http://localhost:${port}`).origin;
  const secure = env.COOKIE_SECURE === 'true';
  if (env.NODE_ENV === 'production' && (!secure || !origin.startsWith('https://'))) throw Error('Production requires HTTPS APP_ORIGIN and COOKIE_SECURE=true.');
  return {
    port, host: env.HOST || '127.0.0.1', origin, secure,
    sessionHours: Math.max(1, Math.min(24, Number(env.SESSION_HOURS) || 8)),
    publicDir: path.resolve(__dirname, '../dist'),
    db: {host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD || '', database: dbName, charset: 'utf8mb4', timezone: 'Z', dateStrings: true, decimalNumbers: true, connectionLimit: 8, connectTimeout: 10000, multipleStatements: false},
    mail: {enabled: env.MAIL_ENABLED === 'true', host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true', user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.MAIL_FROM}
  };
}
module.exports = {config};
