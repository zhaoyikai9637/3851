# Engineering handoff

## Runtime architecture

- React and Bootstrap client under `client/src`.
- Express API under `server/src`.
- MySQL through Sequelize with explicit Umzug migrations.
- Private uploads stored under the configured `UPLOAD_DIR`; database rows retain the private filename.
- The browser receives files only through authorized API routes.

## Authentication

Production requires a trusted team adapter implementing `resolve(req)` and `logout(req, res)`.

Local standalone development may set `DEV_HR_USER_ID`. This exposes `POST /api/auth/development-login`, binds the session to that active HR profile and remains unavailable in production or team mode.

## Frontend structure

- `client/src/App.jsx`: route definitions and page boundary.
- `client/src/layout`: primary navigation and workspace shell.
- `client/src/features/logs`: log filters, grouping and activity rows.
- `client/src/features/notifications`: notification state/actions, filtering and grouping utilities, composed UI sections and feature-local styles.
- `client/src/pages`: page-level data orchestration.
- `client/src/shared.jsx`: shared fields, dates, loading, errors and dialogs.

`Notifications.jsx` is now a route-level composition boundary. The feature hook owns API-backed state and mutations, while toolbar, list, row actions, undo feedback and application summary components remain presentation-focused.

## Code quality

- Biome 2.5.14 provides the single lint and formatting toolchain.
- Checks are intentionally scoped to the notification refactor files to avoid rewriting unrelated historical code.
- The browser-only data adapter remains removed; notification state continues to use the shared CSRF-aware API client and MySQL-backed endpoints.

## Data persistence

Templates, notification read state, profile changes, profile photos and email history are persisted by the API. Refreshing the page reloads authoritative values from MySQL.
