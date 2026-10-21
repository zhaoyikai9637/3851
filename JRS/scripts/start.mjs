import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { root, loadSettings } from '../server/config.mjs';
const settings = loadSettings();
async function databaseListening() {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: 3307 });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(500); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.once('timeout', () => finish(false));
  });
}
try {
  if (settings.DB_MODE !== 'team' && !await databaseListening()) {
    const binary = settings.MYSQLD_PATH || 'C:/Program Files/MySQL/MySQL Server 26.7/bin/mysqld.exe';
    await fs.access(binary);
    await fs.access(path.join(root, '.local/mysql/auto.cnf'));
    const child = spawn(binary, ['--no-defaults', `--basedir=${path.dirname(path.dirname(binary))}`, `--datadir=${path.join(root, '.local/mysql')}`, '--port=3307', '--bind-address=127.0.0.1', '--mysqlx=0', `--log-error=${path.join(root, '.local/mysql.log')}`], { detached: true, windowsHide: true, stdio: 'ignore' });
    child.unref();
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) { if (await databaseListening()) { ready = true; break; } await new Promise(resolve => setTimeout(resolve, 500)); }
    if (!ready) throw new Error('Isolated MySQL did not start. Inspect .local/mysql.log; the original MySQL service was not changed.');
  }
  const projects = ['jrs-hr-module/client'];
  if (settings.ENABLE_EXPERIMENTAL_APPLICANT_PORTAL === 'true') projects.push('JRS Applicant Portal/client');
  for (const folder of projects) await fs.access(path.join(root, folder, 'dist/index.html'));
  await import('../server/index.mjs');
} catch (error) { console.error('Start stopped:', error.code || error.message, 'See README.md for setup and npm run build.'); process.exitCode = 1; }
