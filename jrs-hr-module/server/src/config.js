import './env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 32 || secret.startsWith('replace_')) throw new Error('Set a random SESSION_SECRET (32+ characters) in server/.env.');
  const origin = env.APP_ORIGIN || 'http://localhost:5173';
  if (production && !origin.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS.');
  const mode = env.INTEGRATION_MODE || 'standalone';
  if (!['standalone', 'team'].includes(mode)) throw new Error('Invalid INTEGRATION_MODE.');
  if (production && mode === 'standalone') throw new Error('Standalone mode is limited to development. Integrate team authentication before production.');
  let teamLoginUrl = null;
  if (env.TEAM_LOGIN_URL?.trim()) {
    const value = new URL(env.TEAM_LOGIN_URL);
    if (!['https:', 'http:'].includes(value.protocol) || value.username || value.password ||
        (production && value.protocol !== 'https:')) throw new Error('TEAM_LOGIN_URL must be an absolute HTTP(S) URL without credentials (HTTPS in production).');
    teamLoginUrl = value.href;
  }
  const teamAuthAdapter = env.TEAM_AUTH_ADAPTER?.trim() ? path.resolve(serverRoot, env.TEAM_AUTH_ADAPTER.trim()) : null;
  const developmentUserId = env.DEV_HR_USER_ID ? Number(env.DEV_HR_USER_ID) : null;
  if (developmentUserId !== null && (!Number.isInteger(developmentUserId) || developmentUserId < 1)) throw new Error('DEV_HR_USER_ID must be a positive integer.');
  if (developmentUserId !== null && (production || mode !== 'standalone' || !['127.0.0.1','localhost'].includes(env.HOST || '127.0.0.1'))) {
    throw new Error('DEV_HR_USER_ID is allowed only for local standalone development.');
  }
  return { production, secret, origin: new URL(origin).origin, mode, teamLoginUrl, teamAuthAdapter, developmentUserId, companyName: env.COMPANY_NAME || 'JRS',
    port: Number(env.PORT || 3001), host: env.HOST || '127.0.0.1',
    uploadDir: path.resolve(serverRoot, env.UPLOAD_DIR || 'uploads') };
}
