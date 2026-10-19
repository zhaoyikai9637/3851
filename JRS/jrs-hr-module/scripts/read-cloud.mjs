import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { inspectCloudDatabase } from '../server/src/cloud-sync.js';

const root = fileURLToPath(new URL('../', import.meta.url));
let connection;
try {
  // Private handoff is read only on this workstation; it is never copied into Git.
  const handoff = process.argv.indexOf('--team-handoff');
  let config;
  if (handoff >= 0) {
    if (!process.argv[handoff + 1]) throw new Error('Provide a private team handoff path.');
    const filename = path.resolve(process.argv[handoff + 1]);
    const raw = await fs.readFile(filename, 'utf8');
    const field = key => raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();
    const personal = raw.split(/\r?\n/).find(line => line.startsWith('- zhaoyikai |'));
    const user = personal?.match(/username:\s*([^|]+)/)?.[1].trim();
    const password = personal?.match(/password:\s*([^|]+)/i)?.[1].trim();
    if (!user || !password) throw new Error('Personal credentials are missing.');
    config = { host: field('Host'), port: Number(field('Port')), database: field('Database'), user, password,
      ssl: { ca: await fs.readFile(path.join(path.dirname(filename), 'jrs-ca.pem'), 'utf8'), rejectUnauthorized: true, verifyIdentity: true } };
  } else {
    const env = dotenv.parse(await fs.readFile(path.join(root, 'server/.env.cloud')));
    if (!env.DB_HOST || !env.DB_NAME || !env.DB_USER || !env.DB_PASSWORD || !env.DB_SSL_CA_FILE) throw new Error('Configure the private server/.env.cloud with database settings and DB_SSL_CA_FILE.');
    config = { host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
      ssl: { ca: await fs.readFile(path.resolve(root, env.DB_SSL_CA_FILE), 'utf8'), rejectUnauthorized: true, verifyIdentity: true } };
  }
  connection = await mysql.createConnection({ ...config, connectTimeout: 15000, multipleStatements: false });
  const snapshot = await inspectCloudDatabase(connection);
  const date = new Date().toISOString();
  const output = path.join(root, 'work/cloud-sync', date.replace(/[:.]/g, '-') + '.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ inspectedAt: date, database: config.database, ...snapshot }, null, 2));
  console.log(JSON.stringify({ database: config.database, counts: snapshot.counts,
    capturedBusinessRows: snapshot.importableRows, privateSnapshot: output, cloudWrites: 0 }, null, 2));
} catch (error) {
  console.error('Cloud inspection stopped:', error.code || error.name);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
