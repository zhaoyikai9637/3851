# Engineering handoff

## English-only repository cleanup - 2026-10-19

Current tracked filenames, comments, diagnostics and documentation use English.
The unused duplicate SQLite job/interview implementation was removed from main after confirming no runtime imports.
Its source is retained on module branches and in earlier commits; current HR job/interview routes remain active.
Unused personal attachments, screenshots, chat prompts and superseded handoff/review documents
were removed from current branch snapshots; earlier commits remain recoverable.
Run the integrated root check:english command before committing. It scans the whole repository
even when invoked from the JRS package subdirectory. User-entered database data and Git history are not rewritten.
Fresh checks: root unit tests 17, default workflow 1, experimental workflow 2, login/profile Jest 69,
HR frontend 69, backend 183, HR Jest 73 and isolated MySQL 12 passed. Both frontend builds succeeded.

## Independent integration workspace — 2026-10-19

This copy lives in `E:\textProject\JRS`; the original standalone project is unchanged.
The root runtime shares Zheng's canonical login session and embeds HR recruitment business
inside the user's existing HR UI. See the root README for the actual startup and DB boundary.
Zheng's renamed source is `JRS Login and profile`, including the latest profile page.
SiHuanjia's `JRS Applicant Portal` is unfinished: retained separately and disabled by default.
Do not interpret the historical standalone status below as the root integration status.

## Runtime architecture

- React and Bootstrap pages under `client/pages`; shared features under `client/src` and assets under `client/assets`.
- Express entry at `server/server.js`, configuration under `server/config`, HR routes under `server/routes`; services remain under `server/src`.
- MySQL through Sequelize with explicit Umzug migrations.
- Private uploads stored under the configured `UPLOAD_DIR`; database rows retain the private filename.
- The browser receives files only through authorized API routes.

## Authentication

Production requires a trusted team adapter implementing `resolve(req)` and `logout(req, res)`.

Local standalone development may set `DEV_HR_USER_ID`. This exposes `POST /api/auth/development-login`, binds the session to that active HR profile and remains unavailable in production or team mode.

If Vite is running alone, `/api/auth/config` fails and the local entry cannot appear. Run `npm.cmd run dev` for both services, or use `start-api.cmd` when the frontend is already running. Keep the launcher window open.

## Frontend structure

- `client/src/App.jsx`: route definitions and page boundary.
- `client/src/layout`: primary navigation and workspace shell.
- `client/src/features/logs`: log filters, grouping and activity rows.
- `client/src/features/notifications`: notification state/actions, filtering and grouping utilities, composed UI sections and feature-local styles.
- `client/pages/<feature>`: page-level data orchestration.
- `client/src/shared.jsx`: shared fields, dates, loading, errors and dialogs.

`Notifications.jsx` is now a route-level composition boundary. The feature hook owns API-backed state and mutations, while toolbar, list, row actions, undo feedback and application summary components remain presentation-focused.

## Code quality

- Templates uses a bounded native vertical scrollbar inside its list, leaving the panel heading/count and editor outside the scrolling area. Narrow screens use a 280px vertical list instead of horizontal cards; no plugin, data or API changes.

- Added four stage-specific rejection/offer-closure types and original English templates. Legacy types/content remain intact; no automatic event routing or teammate workflow changes. See `TEMPLATE_TYPES.md` for stage/decision-owner integration boundaries.

- Removed the persistent Logs provider disclaimer and Templates editor explanatory copy. The editor still shows `Unsaved changes` only when dirty. Email-history persistence and provider-acceptance semantics remain unchanged.

- Templates heading shows the API-backed saved count, refreshed after creation/deletion and blank during loading/errors. Logs has no heading subtitle or total; its activity-panel count, filters, pagination and email history remain unchanged.

- Jest now covers five suites/72 local tests (73 in GitHub, retaining its existing team-runtime test), including shared template types, cloud read-only safeguards and original-content installation. `npm run test:jest` regenerates `docs/UNIT_TEST_REPORT.md`; its five-file coverage is not whole-project coverage.

- Notifications, Templates and Logs share the same compact page-heading style; profile headings remain unchanged. Titles, descriptions and page actions are preserved.

- Template usage types have one definition in `shared/template-types.json`. Unknown stored types remain visible but cannot be saved until explicitly changed to a supported type. See `TEMPLATE_TYPES.md`.

- Biome 2.5.14 provides the single lint and formatting toolchain.
- Checks are intentionally scoped to the notification refactor files to avoid rewriting unrelated historical code.
- The browser-only data adapter remains removed; notification state continues to use the shared CSRF-aware API client and MySQL-backed endpoints.

## Data persistence

Templates, notification read state, profile changes, profile photos and email history are persisted by the API. Refreshing the page reloads authoritative values from MySQL.

## 2026-10-07 cloud and original content

The team cloud database was inspected over verified TLS in a read-only transaction.
All eight allowed business tables were empty; no records were imported and no cloud writes occurred.
Account credentials and sessions are excluded from export. Private snapshots stay under ignored `work/`.

Five AI-assisted original templates were installed into the existing local standalone database.
Installation requires an active HR ID, retains existing templates and is repeatable.
Fictional profile/notification examples remain documentation data, not fabricated live activity.
See `CLOUD_SYNC_AND_CONTENT.md`. Team login integration and the other HR modules remain separate.

## 2026-10-14 cloud HR profile application

Two active seed HR profiles (manager and staff) were read from the team cloud database over verified TLS in a read-only transaction. At the user's explicit request, the cloud is authoritative: the original local profile was overwritten, and local profile IDs 1 and 2 now match all cloud HR profile fields. The two newly imported duplicate records were removed only after checking that no foreign-key references existed. Existing references to local ID 1 were retained. Cloud writes were zero. No password hashes, account records, sessions or private photos were copied.

The local-only development entry now uses the imported manager profile. The staff profile is also stored locally, but no browser role switch or additional login system was added. These remain test profiles, not verified real staff identities. Team authentication and upstream-to-local ID mapping remain separate integration work. Private runtime configuration and database records are not committed to Git.

Verification: the overwrite transaction checked exact equality of all local/cloud HR profile fields before commit. Actual local-MySQL-backed development login and profile reads were rechecked for both final profile IDs; unauthenticated and logged-out profile reads returned 401. Backend tests: 182 passed; frontend tests: 68 passed; isolated MySQL tests: 12 passed; production build succeeded. No browser layout check was performed because UI code was unchanged.
# Navigation isolation update (2026-10-20)

- Communication tabs are restricted to Notifications, Templates and Logs.
- Other workspace routes retain the account menu and use the compact header.
- Added 13 route and navigation-transition regression cases. The integrated project also preserves embedded recruitment breadcrumbs while hiding duplicate shell controls.
- Verification: integrated frontend 82, backend/API 183, Jest 73 and isolated MySQL 12 tests passed; integrated boundary/unit tests 18 passed; production builds passed. Standalone frontend 81 tests passed on rerun; its pre-existing loading test raced on the first run. Desktop browser checks confirmed Applications retains its native navigation and Notifications retains its three tabs. Mobile visual testing was not repeated.
