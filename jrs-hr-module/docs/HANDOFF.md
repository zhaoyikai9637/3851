# Engineering handoff

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

- Templates and Logs heading subtitles show API-backed counts rather than explanatory copy. Template counts refresh after creation/deletion; log counts use the full result total and label filtered results. Counts remain blank during loading/errors, never a fabricated zero.

- Jest now covers five suites/64 local tests (65 in GitHub, retaining its existing team-runtime test), including shared template types, cloud read-only safeguards and original-content installation. `npm run test:jest` regenerates `docs/UNIT_TEST_REPORT.md`; its five-file coverage is not whole-project coverage.

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
