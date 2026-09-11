# JRS HR module checkpoint — 2026-09-09

Continue only in E:/textProject/jrs-hr-module. The user requested removal of the
module-owned login because a teammate owns it and has not built it yet.

The password form, POST /api/auth/login, login validation and password service are
removed. The HR API requires a trusted server identity adapter and ACTIVE HR profile.
Without the adapter it fails closed; the frontend shows the team-entry pending state.
No automatic demo login. The existing HR pages and business functions remain intact.

TEAM_LOGIN_URL and TEAM_AUTH_ADAPTER can be configured when the teammate supplies
the contract. See docs/TEAM_AUTH.md. Logout revokes the upstream session first, then
clears the separate jrs.hr.sid CSRF session and returns to team sign-in.
The legacy account table and data remain untouched, unused for runtime authentication.

Final checks: backend 157, frontend 38, real MySQL 12, build and docs export pass.
Edge browser journey: 14 checks, 23 screenshots, zero errors. A test-only upstream
identity fixture supplies authentication; it does not prove team login integration.
Latest results and prior failures: docs/VERIFICATION.md. Source before this change:
work/before-team-login-removal. Existing work/baseline is also preserved.

The two dedicated databases are already approved and initialized. Never rerun first
provisioning/recovery or execute legacy SQL. No team DB writes, real mail, publication
or GitHub push. Next: teammate identity/return/logout/HR mapping, other integration
contracts, Postman GUI and remaining dependency advisories.

Read AGENTS.md, docs/HANDOFF.md, docs/PLAN.md and docs/INTEGRATION.md before continuing.

P7: OpenAPI 22 operations / 316 JSON example entries validated with Swagger Parser/Ajv.
Postman collection and blank local environment generated together, with environment-only
CSRF values and logout last. Added real SQL concurrency and response-contract tests.
Vitest 4.1.11 resolves the newly reported mocker issue; Sequelize/UUID 2 moderate remain.
Offline clean manifest installation passed (373 packages). See docs/API_TESTING.md.
