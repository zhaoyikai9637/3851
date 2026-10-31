import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { HttpError } from './validation.js';

// Only a trusted server adapter may produce this identity. Never construct it
// from unverified browser headers, query parameters, localStorage or decoded JWTs.
export function verifiedHrIdentity(value) {
  if (!value) throw new HttpError(401, 'Continue through the team sign-in page.');
  if (value.role !== 'HR' || !Number.isInteger(value.hrUserId) || value.hrUserId < 1 || value.hrUserId > 2147483647 ||
      typeof value.subject !== 'string' || !value.subject.trim() || value.subject.length > 256 ||
      typeof value.sessionId !== 'string' || !value.sessionId.trim() || value.sessionId.length > 256) {
    throw new HttpError(403, 'A verified HR identity and profile mapping are required.');
  }
  return { subject:value.subject, sessionId:value.sessionId, role:'HR', hrUserId:value.hrUserId };
}
export function assertIdentityAdapter(adapter) {
  if (!adapter || typeof adapter.resolve !== 'function' || typeof adapter.logout !== 'function') {
    throw new Error('Team authentication adapter must implement resolve(req) and logout(req, res).');
  }
  return adapter;
}
export function createDevelopmentIdentityAdapter(config, models) {
  if (config.production || config.mode !== 'standalone' || !config.developmentUserId) return null;
  return assertIdentityAdapter({
    async resolve(req) {
      const identity = req.session?.developmentIdentity;
      return identity?.hrUserId === config.developmentUserId ? identity : null;
    },
    async login(req) {
      const user = await models.HrUser.findOne({ where: { userId: config.developmentUserId, accountStatus: 'ACTIVE' } });
      if (!user) throw new HttpError(403, 'The configured local HR profile is not active.');
      const identity = { subject: `local-hr:${user.userId}`, sessionId: crypto.randomUUID(), role: 'HR', hrUserId: user.userId };
      req.session.developmentIdentity = identity;
      return identity;
    },
    async logout(req) { delete req.session.developmentIdentity; },
  });
}
export async function loadIdentityAdapter(config, models) {
  if (!config.teamAuthAdapter) return createDevelopmentIdentityAdapter(config, models);
  // This is a local, explicitly configured server file, never a browser-supplied URL.
  const module = await import(pathToFileURL(path.resolve(config.teamAuthAdapter)).href);
  if (typeof module.createIdentityAdapter !== 'function') throw new Error('Team adapter must export createIdentityAdapter({ config, models }).');
  return assertIdentityAdapter(await module.createIdentityAdapter({config,models}));
}
