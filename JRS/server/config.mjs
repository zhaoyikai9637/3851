import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
export const root = fileURLToPath(new URL('../', import.meta.url));
export function loadSettings() {
  const env = { ...dotenv.parse(fs.readFileSync(path.join(root, '.env'))), ...process.env };
  if (!['127.0.0.1', 'localhost'].includes(env.DB_HOST) || !['jrs_integrated_dev_20261019', 'jrs_integrated_test_20261019'].includes(env.DB_NAME) || Number(env.DB_PORT) !== 3307) throw new Error('Integration writes require an explicitly named isolated local JRS database on port 3307.');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Configure a private session secret in .env.');
  return { ...env, production: false, origin: new URL(env.APP_ORIGIN).origin, port: Number(env.PORT || 3100),
    db: { host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, timezone: 'Z', dateStrings: true, multipleStatements: false, connectionLimit: 8 } };
}
