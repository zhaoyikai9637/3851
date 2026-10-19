import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root } from '../server/config.mjs';
const projects = ['jrs-hr-module/client'];
if (process.argv.includes('--experimental-applicant')) projects.push('JRS Applicant Portal/client');
for (const project of projects) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: path.join(root, project), stdio: 'inherit', env: { ...process.env, VITE_AUTH_LOGIN_URL: '/pages/login/login.html', VITE_ENABLE_DEMO_AUTH: 'false' } });
  if (result.status !== 0) process.exit(result.status || 1);
}
