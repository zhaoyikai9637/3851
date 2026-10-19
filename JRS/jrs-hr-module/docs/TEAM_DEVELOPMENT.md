# Team database and backend development guide

## Target architecture

All HR contributors use one GitHub repository and one shared integration MySQL service. Each contributor runs the React client and Express server locally while connecting to the shared integration database through TLS.

The shared database is an integration environment, not a production database. Production deployment requires a separate database, HTTPS, managed secrets, durable file storage and a reviewed release process.

## Recommended managed MySQL service

For the coursework integration environment, use an Aiven for MySQL Free service. The free service is suitable for a small student project but is single-node, resource-limited and not covered by a production SLA.

Create these resources in the Aiven Console:

1. One project owned by the team lead.
2. One MySQL Free service named `jrs-hr-integration`.
3. One database named `jrs_hr_module_dev_team`.
4. One migration service user reserved for the migration owner.
5. One runtime service user for each contributor.
6. The provider CA certificate downloaded from the service overview.

Do not share the default `avnadmin` credentials with contributors. Keep the admin and migration credentials with the database owner.

## Database access model

| Account | Intended privileges | Who receives it |
| --- | --- | --- |
| Provider administrator | Service administration and user creation | Team lead only |
| Migration owner | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `INDEX`, `REFERENCES`, and future reviewed schema privileges | One nominated migration owner |
| Runtime developer | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | One unique account per contributor |
| Read-only reviewer | `SELECT` | Optional supervisor or reviewer |

Use a unique account per person. Never use one shared password because individual access cannot be revoked or audited safely.

## Initial schema migration

The migration owner performs the initial bootstrap once. Everyone else must wait until it is complete.

1. Copy `server/.env.team.example` to `server/.env`.
2. Enter the managed hostname, port, database name, migration username, password and CA certificate.
3. For the initial empty database only, set `INTEGRATION_MODE=standalone` so migration `001-module` creates the complete baseline, including the four shared recruitment tables.
4. Set `DB_WRITE_CONFIRMED` to the exact database name.
5. Keep `DB_SHARED_INTEGRATION_CONFIRMED` blank during the initial standalone bootstrap.
6. Run `npm.cmd run db:migrate` from the project root.
7. Do not run `npm.cmd run db:seed`; the shared environment must receive real team-owned HR identities and workflow data.
8. Change `INTEGRATION_MODE` to `team` immediately after the initial migration.
9. Clear `DB_WRITE_CONFIRMED` in the normal runtime environment.

For every later reviewed migration, the migration owner temporarily sets both `DB_WRITE_CONFIRMED` and `DB_SHARED_INTEGRATION_CONFIRMED` to the exact database name, runs `npm.cmd run db:migrate`, verifies the result, and clears both values again.

## Contributor setup

Each contributor follows these steps:

1. Clone the `3851` repository and enter the `jrs-hr-module` directory.
2. Install Node.js 24 and run `npm.cmd ci`.
3. Copy `server/.env.team.example` to `server/.env`.
4. Enter their individual runtime database user, password, service host, port and CA certificate.
5. Generate their own local `SESSION_SECRET`; do not copy another contributor's secret.
6. Leave `DB_WRITE_CONFIRMED` and `DB_SHARED_INTEGRATION_CONFIRMED` blank.
7. Keep `MAIL_MODE=preview` and `MAIL_ALLOW_SMTP=false` during development.
8. Configure `TEAM_LOGIN_URL` and `TEAM_AUTH_ADAPTER` only after the authentication owner publishes the agreed contract.
9. Run `npm.cmd run dev` and open `http://localhost:5173`.

The database hostname, port and CA certificate can be shared with the team. Usernames and passwords must be delivered privately to the intended contributor and must never appear in GitHub, screenshots, reports or chat history.

## Backend ownership

Contributors should extend this backend rather than create separate Express servers or separate databases.

| Area | Owner | Extension rule |
| --- | --- | --- |
| Authentication and global user session | Authentication owner | Implement the trusted adapter in `server/src/team-auth.js` contract |
| Candidates | Candidate owner | Add routes/services against `CANDIDATE`; coordinate schema fields first |
| Job positions | Position owner | Add routes/services against `JOB_POSITION`; coordinate schema fields first |
| Applications | Application owner | Add workflow routes/services against `APPLICATION` |
| Interviews and offers | Assigned recruitment owners | Add new migrations and service boundaries; do not overload notification tables |
| Notifications, templates and logs | Notification owner | Preserve existing service contracts and event idempotency |
| Database migrations | Migration owner | Review and merge migrations in strict numeric order |

## Development workflow

1. Pull the latest `main` branch before starting.
2. Create a branch named `codex/<short-feature-name>` or the team-approved equivalent.
3. Add or update tests before production behavior changes.
4. Implement through routes, validation, services and models; do not put business logic directly in React components.
5. Add a new migration for every schema change. Never edit a migration already applied to the shared database.
6. Update OpenAPI and Postman examples when an API contract changes.
7. Run all relevant tests locally.
8. Open a pull request and request review from the module owner and migration owner.
9. Merge code before the migration owner applies its migration to the shared integration database.
10. Pull the merged commit and retest the integrated workflow.

## Rules that prevent team conflicts

- Never create another backend for a module that belongs in this server.
- Never create duplicate candidate, position, application or HR user tables.
- Never modify shared tables manually in MySQL Workbench.
- Never run `sequelize.sync({ force: true })` or `sequelize.sync({ alter: true })`.
- Never run the development seed command against the shared database.
- Never share the provider administrator account.
- Never commit `.env`, CA private material, passwords, session secrets, uploads or database exports containing personal data.
- Every workflow event must use a globally unique `eventKey`.
- A module writes only its owned tables unless a reviewed service contract explicitly permits otherwise.
- Use transactions for operations that update more than one table.

## API integration pattern

The application module owns workflow changes. When an application is created or its status changes, trusted backend code should:

1. Commit the application change.
2. Call the notification service with the application ID, event type and unique event key.
3. Select the required template.
4. Create an immutable email-history snapshot through the notification service.
5. Keep retry behavior idempotent by reusing the same event key.

Browser code must not write directly to notification or log tables and must not be allowed to submit trusted workflow-event fields.

## Verification before integration

Run from the project root:

```powershell
npm.cmd test
npm.cmd run test:jest
npm.cmd run test:mysql
npm.cmd run build
npm.cmd run lint
npm.cmd run format:check
npm.cmd run docs:check
```

The real-MySQL suite must continue using its isolated test database. It must never point at the shared integration database.

## Backup and recovery

- Use the managed provider's automated backups.
- Before a high-risk migration, create a provider backup or approved logical dump.
- Test restoration before the final demonstration.
- Do not treat a local developer database as the backup of the shared environment.
- Destructive migration rollback remains disabled; recovery requires a reviewed forward migration or a verified backup restore.
