'use strict';
const path = require('node:path');
const fs = require('node:fs');
const {X509Certificate} = require('node:crypto');
function config(env = process.env, {migration = false} = {}) {
  const dbName = env.DB_NAME || 'jrs_hr_fullstack';
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(dbName)) throw Error('DB_NAME must contain only letters, numbers and underscores.');
  const port = Number(env.PORT || 3000);
  const origin = new URL(env.APP_ORIGIN || `http://localhost:${port}`).origin;
  const secure = env.COOKIE_SECURE === 'true';
  if (env.NODE_ENV === 'production' && (!secure || !origin.startsWith('https://'))) throw Error('Production requires HTTPS APP_ORIGIN and COOKIE_SECURE=true.');
  const team = env.INTEGRATION_MODE === 'team';
  const caSetting = env.DB_SSL_CA_FILE || env.DB_SSL_CA;
  let ssl;
  if (caSetting) {
    const ca = caSetting.includes('-----BEGIN CERTIFICATE-----') ? caSetting.replace(/\\n/g, '\n') : fs.readFileSync(path.resolve(__dirname, '..', caSetting), 'utf8');
    new X509Certificate(ca); // Reject an invalid CA before attempting a connection.
    ssl = {ca, rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2'};
  }
  if (team && !ssl) throw Error('Team database requires DB_SSL_CA or DB_SSL_CA_FILE with a valid CA certificate.');
  if (team && !migration && env.DB_USER === 'jrs_migration_owner') throw Error('Use your personal developer database account for the backend, not the schema migration account.');
  if (env.TEAM_AUTH_ADAPTER) throw Error('TEAM_AUTH_ADAPTER is not implemented in this standalone HR module. Coordinate the shared login adapter before enabling it.');
  const writesEnabled = !team || (env.DB_WRITE_CONFIRMED === dbName && env.DB_SHARED_INTEGRATION_CONFIRMED === dbName);
  return {
    port, host: env.HOST || '127.0.0.1', origin, secure,
    team, writesEnabled,
    sessionHours: Math.max(1, Math.min(24, Number(env.SESSION_HOURS) || 8)),
    publicDir: path.resolve(__dirname, '../dist'),
    db: {host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD || '', database: dbName, ...(ssl ? {ssl} : {}), charset: 'utf8mb4', timezone: 'Z', dateStrings: true, decimalNumbers: true, connectionLimit: 8, connectTimeout: 10000, multipleStatements: false},
    mail: {enabled: writesEnabled && env.MAIL_MODE !== 'preview' && (team ? env.MAIL_ALLOW_SMTP === 'true' && env.MAIL_ENABLED === 'true' : env.MAIL_ENABLED === 'true'), host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true', user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.MAIL_FROM}
  };
}
module.exports = {config};
