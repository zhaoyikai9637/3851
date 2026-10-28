# JRS Recruitment Workspace

This is the integrated development project. The integrated source lives in JRS/; teammate source archives may also be present at repository root.
After cloning, open JRS/ before running the commands below. Existing standalone local projects are not replaced.

## Deployment preparation

See [Railway deployment runbook](docs/RAILWAY_DEPLOYMENT.md) for the Docker build,
private production variables, persistent uploads, readiness checks and isolated
schema preparation. No production resources or public deployment have been created.
Infrastructure checks do not replace final applicant-module acceptance below.

## Modules

| Directory | Responsibility | Default runtime |
| --- | --- | --- |
| JRS Login and profile | Shared candidate/HR sign-in and candidate personal profile | Enabled |
| jrs-hr-module | Existing HR shell, notifications, templates, email history and HR profile | Enabled |
| JRS HR | HR recruitment business embedded inside the existing HR shell | Enabled |
| JRS Applicant Portal | SiHuanjia's updated applicant module | Explicit feature switch; local preview enabled |

Candidates use the shared sign-in and Personal Profile; the enabled applicant preview adds application routes. HR users enter /hr/.
Jobs, My Resume and Application Status in the login/profile module remain static demonstrations.
The updated applicant workflow is integrated locally; public-launch acceptance is a separate step.

## Local development

Use Node.js 24 and MySQL. Install the root dependency lockfile with npm.cmd ci.
Copy .env.example to a private .env and configure the dedicated local database and session secrets.
The existing development setup uses 127.0.0.1:3307 and jrs_integrated_dev_20261019.
The root runtime refuses other database targets. Tests use a separate test database.

On the already configured workstation, run:

```powershell
npm.cmd run build
npm.cmd start
```

Open http://localhost:3100/. The start-jrs.cmd launcher runs the same startup command.
Private local accounts are stored in .local/accounts.json; never commit or share this file.
These are local development credentials, not cloud database account passwords.

The startup script can restart the previously initialized isolated MySQL instance in .local/mysql.
It does not initialize a fresh machine or change the original MySQL service on port 3306.
A new machine needs explicit MySQL initialization and authorized HR profile import.
Review scripts/setup-database.mjs before running npm.cmd run db:setup. Do not target a shared or production database.
Cloud profile access is read-only with verified TLS; no cloud credentials, sessions or password hashes are copied.

## Experimental applicant module

The 2026-10-28 teacher-review update is integrated. See [team synchronization](docs/TEAM_UPDATE_20261028.md).
The default server does not import or mount its service, /applicant-api or /applicant/*.
Default HR writes do not update its business tables. Earlier isolated development data is retained.

Experimental routes live in server/experimental/applicant.mjs and use server/applicant-data.mjs.
Only explicitly setting ENABLE_EXPERIMENTAL_APPLICANT_PORTAL=true and running
npm.cmd run build:experimental enables the applicant flow. The root build compiles both clients; routing and database synchronization remain controlled by that explicit switch.

## Checks

```powershell
npm.cmd test
npm.cmd run check:english
npm.cmd run test:workflow
npm.cmd run test:experimental
npm.cmd run build
```

test:workflow checks the default login/profile/HR boundaries and prevents HR writes from entering applicant tables.
test:experimental enables the current applicant workflow for isolated end-to-end adapter checks; it is not public deployment acceptance.
MySQL checks require the dedicated local test schema and private local configuration.
Production SMTP, actual email delivery, final applicant acceptance and deployment remain pending.

The unused legacy SQLite job/interview implementation was removed from main.
Its source remains on the module branches and in Git history; its known failing tests are not part of the integrated test result.
Current job publication and interview features use the active HR module and MySQL adapters instead.

## Repository maintenance

All current branch snapshots use English filenames and text.
Run check:english before committing. The checker scans tracked and unignored UTF-8 text and filenames;
it does not rewrite user-entered database data or historical Git commits.

team-files retains the source-module layout from before integration.
Other branches are hr-login, hr-notifications, profile-cleanup, login-profile and project-structure.
Old personal reports, video, database snapshots, chat prompts and superseded handoff/review documents were removed from current snapshots.
Their earlier committed versions remain recoverable from Git history.
Never commit .env, credentials, private uploads, database files, node_modules or generated builds.
