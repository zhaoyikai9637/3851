import { describe, it, expect } from 'vitest';
import { verifiedHrIdentity, assertIdentityAdapter, loadIdentityAdapter } from '../src/team-auth.js';
import { loadConfig } from '../src/config.js';
const principal={subject:'team-user-1',sessionId:'team-session-1',hrUserId:1,role:'HR'};
describe('Team identity boundary and entry configuration', () => {
  it('stays closed when no server adapter is configured', async () => {
    expect(await loadIdentityAdapter({},{})).toBeNull();
    expect(() => verifiedHrIdentity(null)).toThrow(expect.objectContaining({status:401}));
  });
  it.each([{role:'CANDIDATE'},{hrUserId:'1'},{hrUserId:0},{hrUserId:2147483648},{subject:''},{subject:' '},{sessionId:''},{sessionId:null}])('rejects invalid or non-HR mapped identities %j', patch => {
    expect(() => verifiedHrIdentity({...principal,...patch})).toThrow(expect.objectContaining({status:403}));
  });
  it('projects the identity to its required fields', () => {
    expect(verifiedHrIdentity({...principal,privateToken:'excluded'})).toEqual(principal);
  });
  it('requires upstream revocation as well as authentication', () => {
    expect(() => assertIdentityAdapter({resolve:async()=>principal})).toThrow('logout');
  });
  it('has no implicit login URL or adapter', () => {
    expect(loadConfig({SESSION_SECRET:'a'.repeat(40)})).toMatchObject({teamLoginUrl:null,teamAuthAdapter:null});
  });
  it.each(['javascript:alert(1)','data:text/html,test','https://user:password@example.test/','/login','//example.test/login'])('rejects unsafe or ambiguous login addresses %s', url => {
    expect(() => loadConfig({SESSION_SECRET:'a'.repeat(40),TEAM_LOGIN_URL:url})).toThrow();
  });
  it('accepts an explicit absolute login URL without inventing return query parameters', () => {
    expect(loadConfig({SESSION_SECRET:'a'.repeat(40),TEAM_LOGIN_URL:'https://team.example.test/login?returnTo=hr'}).teamLoginUrl).toBe('https://team.example.test/login?returnTo=hr');
  });
});
