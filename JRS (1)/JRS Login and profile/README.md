# JRS Login and Profile

Shared candidate/HR login, registration, logout, candidate profile and private resume APIs.
Actual routes are implemented in server/api.js; see API.md for their contract.

## Standalone setup

Use Node.js 22.12 or newer and MySQL. From this module directory:

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

Fill in private database, session-secret and optional SMTP values before starting.
Open http://localhost:3001/pages/login/login.html. Do not run business flows through Live Server.
Cloud MySQL connections require the team CA with certificate and hostname validation enabled.
Keep credentials, account passwords and uploaded files outside Git.

Public registration creates candidate accounts only. HR accounts require an active linked HR_USER.
The server authorizes roles and enforces CSRF; browser redirects do not grant permissions.
Candidate accounts enter Profile; HR accounts enter the HR workspace.
Email password recovery applies to candidates; HR password changes use the shared account.

## Integration boundary

Standalone mode includes the HR copy in integrations/hr under /hr/ with jrs_portal_hr_ tables.
Its jobs and application state do not automatically synchronize with candidate profile records.
Jobs, My Resume and Application Status demonstration pages are static, not a completed application flow.
Real email sending and automatic retention cleanup are disabled by the shared-login integration.

In the integrated main project, start the parent JRS application instead.
It supplies the shared session, original HR UI and a separate recruitment adapter.
The copied standalone HR mount is disabled there.

## Database maintenance

Run npm run db:check and npm run hr:check before considering schema changes.
Successful TLS connectivity does not authorize migrations.
Review SQL, back up data and obtain explicit permission before changing a shared database.
Use a dedicated runtime account rather than migration-administrator credentials.
Seed scripts create fictional accounts only for an explicitly confirmed target;
random passwords stay in the ignored .local-backup directory.
The Docker demo database is independent of the team's cloud database.

## Structure and tests

client/ contains pages and shared browser utilities; server/ contains the API and services.
migrations/ contains reviewed SQL; scripts/ contains checks, seed tools and backups.
integrations/hr/ contains the standalone HR adapter; tests/ contains automated coverage.
Run npm test -- --runInBand using the Node VM-modules option required by the Jest configuration.
The embedded HR module has separate Node test scripts. Passing module tests is not complete cross-member acceptance.
