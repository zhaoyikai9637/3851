import { createHash, timingSafeEqual } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const cookieName = 'jrs_candidate_session';
export const httpError = (status, message) => Object.assign(new Error(message), { status });

export async function readSharedSession(req, repository) {
  const value = String(req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!/^[a-f0-9]{64}$/.test(value || '')) return null;
  const sid = `candidate:${hash(value)}`;
  const account = await repository.session(sid);
  return account ? { ...account, sid } : null;
}

export function verifySharedWrite(req, session, origin) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') throw httpError(403, 'Request origin is not allowed.');
  const token = req.headers['x-csrf-token'];
  if (!/^[a-f0-9]{64}$/.test(token || '') || !/^[a-f0-9]{64}$/.test(session?.csrf || '') || !timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf))) throw httpError(403, 'Invalid request token. Refresh before saving.');
}

export function createSharedIdentity(repository, config) {
  return {
    async resolve(req) {
      const account = await readSharedSession(req, repository);
      if (account?.role !== 'hr') return null;
      const hr = await repository.hrIdentity(account.account_id);
      if (!hr || hr.account_status !== 'ACTIVE' || !['HR_MANAGER', 'HR_STAFF'].includes(hr.role)) return null;
      return { subject: `account:${account.account_id}`, sessionId: hash(account.sid), role: 'HR', hrUserId: hr.user_id };
    },
    async logout(req, res) {
      const account = await readSharedSession(req, repository);
      if (account) await repository.logout(account.sid);
      res.clearCookie(cookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: Boolean(config.production) });
    },
  };
}
