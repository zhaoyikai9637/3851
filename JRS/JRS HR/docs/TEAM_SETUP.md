# Shared Database Setup

A successful verified TLS connection is not evidence of schema compatibility or integration.
The shared canonical tables differ from this standalone module's hr_* tables.
Compare ownership, keys, enums and authentication before running any migration.
Do not create a second set of business tables merely to make db:check pass.

The standalone module reads root configuration through its package scripts.
DB_HOST, DB_PORT and DB_NAME identify the target; DB_USER and DB_PASSWORD must be private contributor credentials.
DB_SSL_CA supports a verified CA path or PEM value. INTEGRATION_MODE=team requires TLS.
Do not disable certificate or hostname verification.
Keep MAIL_MODE=preview and MAIL_ALLOW_SMTP=false for ordinary development.

DB_WRITE_CONFIRMED and DB_SHARED_INTEGRATION_CONFIRMED must both match DB_NAME to permit shared writes.
Leave them empty during read-only inspection. Login also writes session/rate-limit rows,
so a read-only configuration is not a usable read-only signed-in application.

## Reviewed migration

1. Compare database/schema.sql, API.md, retention rules and existing shared tables.
2. Resolve conflicting meanings and cross-module keys before applying changes.
3. Back up the target. Use a temporary migration account and explicit DB_SCHEMA_CONFIRMED.
4. Run the reviewed migration, then rerun npm run db:check.
5. Confirm actual account roles, password format and all write/cleanup responsibilities before enabling writes.

Runtime accounts must not inherit migration-administrator credentials.
Do not run db:init, db:seed or integration tests against the shared cloud database.
An environment file alone does not implement single sign-on.
Other writers must follow workspace locking, revision, stage and retention rules, preferably through the API.
The integrated main project has its own identity/database adapters; use its root setup instead of these standalone steps.
