# HR shared login integration — 2026-10-13

Source: the user's downloaded `3851-main/JRS HR` folder. The source folder is unchanged. The user explicitly selected the complete JRS HR workspace; the separate jrs-hr-module notification project was not integrated.

The copied HR frontend and backend are in `integrations/hr`. Its application, candidate, job, interview, offer, task, notification, template and profile pages remain the original workspace. Integration edits replace standalone login with the shared JRS cookie, mount the application under `/hr/` and its API under `/hr/api/`, and prefix SQL tables with `jrs_portal_hr_`. No new npm dependency was needed. Backend source and credential files are not served.

## Authentication

- Public registration always creates a candidate; a submitted role cannot create HR privileges.
- Shared `/api/login` verifies bcrypt passwords in MODULE_ACCOUNT. Candidate accounts retain their original flow. HR accounts require role `hr`, a linked active HR_USER and an allowed HR_MANAGER/HR_STAFF role.
- The login page sends candidates to `/pages/profile/profile.html`, and HR accounts to `/hr/`.
- HR API requests validate the original server session, its CSRF token, active canonical HR identity and matching workspace role. Candidates are denied HR APIs, and HR accounts are denied candidate profile APIs. Role headers and frontend values do not grant permissions.
- HR logout revokes the shared session. The HR password-change API uses the canonical MODULE_ACCOUNT bcrypt hash and revokes all sessions for that account. The old standalone HR login endpoint is closed in the integrated app.
- The original HR password-reset email flow is not wired to the candidate recovery endpoint. Test HR emails use `.test` and cannot receive mail.

## Database changes applied with user authorization

The cloud already had canonical MODULE_ACCOUNT and HR_USER; the independent HR workspace tables were added after explicit user authorization. `migrations/002_hr_workspace.sql` contains 21 additive CREATE TABLE statements; `scripts/migrate-hr.js` uses a separate JRS_HR_SCHEMA_MIGRATION ledger (one additional table) and checksums. It does not alter or adopt existing tables.

`scripts/seed-hr.js` prepares two fictional accounts (Taylor Chen, HR_MANAGER; Casey Wong, HR_STAFF), their canonical/workspace profiles, one workspace header, and the source project's five email templates. Passwords are random, bcrypt-hashed, and stored only under ignored `.local-backup/seed-hr/`. Email collisions cause a skip rather than replacing existing data.

The HR workspace has its own candidate/job/application records. It does not automatically mirror the candidate module or its presentation-only pages. This is an initial login integration, not a completed cross-module recruitment data adapter. No 115-record original demo dataset is imported into the team cloud. No SMTP is enabled, and no automatic retention cleanup or background worker is started by the shared server.

For another environment, obtain authorization and create a fresh backup before running:

```powershell
node scripts/migrate-hr.js --apply --database=jrs_hr_module_dev_team
node scripts/seed-hr.js --apply --database=jrs_hr_module_dev_team
npm start
```

The migration coordinator credentials are read privately from the previously supplied local document only for DDL. Ordinary application credentials are used for seeding and runtime. TLS verification remains enabled.

## Verification so far

- `npm test -- --runInBand`: 12 suites / 69 tests passed, including shared HR authorization, role isolation, wrong-origin/CSRF rejection, identity mismatch, logout and asset visibility.
- `node --test integrations/hr/tests/backend.test.cjs integrations/hr/tests/http.test.cjs integrations/hr/tests/mail.test.cjs integrations/hr/tests/retention.test.cjs integrations/hr/tests/workflow.test.cjs`: 47 passed outside the sandbox. The initial sandbox run blocked loopback HTTP; the approved repeat passed.
- `node scripts/migrate-hr.js`: final cloud READ-ONLY check passed; 0 pending statements. All 21 HR migration steps applied successfully.
- The disposable local SQL harness was not completed; real cloud API and browser integration checks passed instead.
- Original frontend rendering/routing tests: `node --test integrations/hr/tests/frontend.test.cjs` — 12 passed. Standalone config tests have not been claimed as passed after integration edits.

The separate local candidate demo keeps its own database. Production integration uses `npm start` and the existing cloud configuration; restart the server after integrating.



Current status: both candidate and HR cloud migrations are complete. Two fictional HR accounts and five templates were added with authorization. Existing durable rows were preserved. Real cloud API and browser login/role/logout checks passed. Test passwords are provided privately by the maintainer, not in this repository.
