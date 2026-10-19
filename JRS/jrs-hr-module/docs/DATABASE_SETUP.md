# Database setup

1. Create a new dedicated database named `jrs_hr_module_dev_<suffix>`.
2. Create a non-root application user scoped to that database.
3. Copy `server/.env.example` to `server/.env` and set the connection values.
4. Set `DB_WRITE_CONFIRMED` to the exact database name.
5. Run `npm.cmd run db:migrate`.
6. Run `npm.cmd run db:seed`.

The application never uses `sync({ force: true })` or `sync({ alter: true })`. Migrations refuse unrelated, incomplete or unconfirmed databases.

The local development account intentionally does not need broad schema permissions. Migration 002 therefore retires old activity at the data layer without requiring an `ALTER` grant on an already-created database.
