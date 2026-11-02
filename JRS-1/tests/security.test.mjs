import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

const security = await import('../server/security.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

const token = 'a'.repeat(64);
const sid = `candidate:${createHash('sha256').update(token).digest('hex')}`;
const req = { headers: { cookie: `jrs_candidate_session=${token}` } };
function repository(role = 'hr') {
  return {
    async session(value) { return value === sid ? { account_id: 5, role, csrf: 'b'.repeat(64) } : null; },
    async hrIdentity() { return { user_id: 1, account_status: 'ACTIVE', role: 'HR_MANAGER' }; },
    async logout(value) { this.revoked = value; },
  };
}

test('verified shared HR session maps the canonical HR id, not a browser-supplied id', async () => {
  assert.equal(typeof security.createSharedIdentity, 'function', 'Shared identity integration is missing');
  const adapter = security.createSharedIdentity(repository(), { production: false });
  const identity = await adapter.resolve({ ...req, query: { hrUserId: 999 }, headers: { ...req.headers, 'x-role': 'HR_MANAGER' } });
  assert.equal(identity.hrUserId, 1);
  assert.equal(identity.subject, 'account:5');
  assert.equal(identity.role, 'HR');
  assert.notEqual(identity.sessionId, token);
});

test('candidate cookie never grants HR access', async () => {
  assert.equal(typeof security.createSharedIdentity, 'function', 'Shared identity integration is missing');
  const adapter = security.createSharedIdentity(repository('candidate'), {});
  assert.equal(await adapter.resolve(req), null);
});

test('inactive canonical HR is denied even with a valid account session', async () => {
  assert.equal(typeof security.createSharedIdentity, 'function', 'Shared identity integration is missing');
  const repo = repository();
  repo.hrIdentity = async () => ({ user_id: 1, account_status: 'DISABLED', role: 'HR_MANAGER' });
  assert.equal(await security.createSharedIdentity(repo, {}).resolve(req), null);
});

test('malformed and missing shared cookies are denied without querying the session store', async () => {
  assert.equal(typeof security.readSharedSession, 'function', 'Shared cookie validation is missing');
  const repo = { session() { throw new Error('Invalid cookies must not reach SQL'); } };
  assert.equal(await security.readSharedSession({ headers: {} }, repo), null);
  assert.equal(await security.readSharedSession({ headers: { cookie: 'jrs_candidate_session=forged' } }, repo), null);
});

test('HR logout revokes the upstream shared session and clears its cookie', async () => {
  assert.equal(typeof security.createSharedIdentity, 'function', 'Shared identity integration is missing');
  const repo = repository();
  const cookies = [];
  await security.createSharedIdentity(repo, { production: false }).logout(req, { clearCookie: (...args) => cookies.push(args) });
  assert.equal(repo.revoked, sid);
  assert.equal(cookies[0][0], 'jrs_candidate_session');
});

test('writes reject cross-origin requests and missing CSRF tokens', async () => {
  assert.equal(typeof security.verifySharedWrite, 'function', 'Shared write protection is missing');
  const session = { csrf: 'b'.repeat(64) };
  assert.throws(() => security.verifySharedWrite({ method: 'POST', headers: { origin: 'https://evil.test' } }, session, 'http://localhost:3100'), /origin/i);
  assert.throws(() => security.verifySharedWrite({ method: 'POST', headers: {} }, session, 'http://localhost:3100'), /token/i);
  assert.doesNotThrow(() => security.verifySharedWrite({ method: 'POST', headers: { origin: 'http://localhost:3100', 'x-csrf-token': session.csrf } }, session, 'http://localhost:3100'));
});
