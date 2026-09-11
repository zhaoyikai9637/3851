import crypto from 'node:crypto';
// Test fixture, not a login feature or an implementation of the team's service.
export function teamIdentityFixture() {
  const sessions = new Map();
  const cookieName = 'jrs.team.test';
  const tokenFrom = req => req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  return {
    issue(hrUserId, role = 'HR') {
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { subject:'test-user-' + hrUserId, sessionId:crypto.randomUUID(), hrUserId, role });
      return { name:cookieName, value:token };
    },
    adapter: {
      async resolve(req) { return sessions.get(tokenFrom(req)) || null; },
      async logout(req, res) { sessions.delete(tokenFrom(req)); res.clearCookie(cookieName, {path:'/'}); },
    },
  };
}
