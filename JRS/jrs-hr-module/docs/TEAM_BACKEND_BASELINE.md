# Shared HR backend and database baseline

## Decision

This repository is suitable as the shared starting point for the HR team's backend and database, but it is not yet a complete recruitment backend.

The implemented server owns notifications, email templates, notification history, HR profiles, private profile photos, authorized attachment downloads, sessions, validation, CSRF protection and API documentation. The recruitment workflow modules still need to supply authentication, candidates, job positions, applications and their workflow events.

The team should share the source code, migrations and API contract. Do not share a developer's live database password, session secret, `.env` file or raw MySQL data directory.

## Backend stack

| Layer | Technology | Current purpose |
| --- | --- | --- |
| Runtime | Node.js 24 | Server runtime |
| HTTP API | Express 5 | REST endpoints and middleware |
| Database access | Sequelize 6 | Models, queries and transactions |
| Migrations | Umzug 3 | Versioned, repeatable schema changes |
| Database | MySQL | Persistent application data |
| Validation | Zod 4 | Request validation |
| Sessions | `express-session` with MySQL storage | Server-side HR sessions |
| Security | Helmet, CSRF token, origin checking and rate limiting | Request protection |
| Uploads | Multer and Sharp | Private profile-image processing |
| Mail | Nodemailer | Preview by default; SMTP requires explicit approval |
| API contract | OpenAPI 3.0 and Swagger UI | Team integration and manual testing |
| Tests | Vitest, Supertest and Jest | Unit, API and real-MySQL coverage |

## Server source map

| Location | Responsibility |
| --- | --- |
| `server/src/index.js` | Process startup and dependency wiring |
| `server/src/app.js` | Express routes, middleware, uploads and error handling |
| `server/src/services.js` | Business rules and database operations |
| `server/src/models.js` | Sequelize model definitions and associations |
| `server/src/migrate.js` | Safe migration runner |
| `server/src/migrations/` | Versioned schema and data migrations |
| `server/src/team-auth.js` | Trusted team identity adapter boundary |
| `server/src/session-store.js` | Persistent MySQL session storage |
| `server/src/mailer.js` | Preview and explicitly authorized SMTP delivery |
| `server/src/openapi.js` | Machine-readable API contract and Swagger definition |
| `server/src/validation.js` | Request and filter schemas |
| `server/src/database-safety.js` | Dedicated-database and migration safety checks |

## Existing HTTP API

### Public process and documentation endpoints

- `GET /api/health`
- `GET /api/openapi.json`
- `GET /api/docs/`
- `GET /api/auth/config`
- `GET /api/auth/csrf`

### Session endpoints

- `POST /api/auth/development-login` — local standalone development only
- `GET /api/auth/me`
- `POST /api/auth/logout`

### HR profile endpoints

- `GET /api/hr/profile`
- `PATCH /api/hr/profile`
- `GET /api/hr/profile/photo`
- `POST /api/hr/profile/photo`

### Notification endpoints

- `GET /api/hr/notifications`
- `PATCH /api/hr/notifications/:id/read`
- `PATCH /api/hr/notifications/read-all`
- `PATCH /api/hr/notifications/restore-unread`

### Email template endpoints

- `GET /api/hr/templates`
- `POST /api/hr/templates`
- `PUT /api/hr/templates/:id`
- `DELETE /api/hr/templates/:id`

### Notification history endpoints

- `GET /api/hr/logs`
- `GET /api/hr/logs/:id`
- `GET /api/hr/attachments/:id/download`

### Recruitment integration endpoint

- `GET /api/hr/applications/:id` — authorized, read-only application summary

There is intentionally no public browser endpoint for creating workflow notifications or sending workflow email. Those operations must be invoked by trusted server-side recruitment workflow code with an idempotent event key.

## Database tables

| Table | Owner | Purpose | Important relationships |
| --- | --- | --- | --- |
| `HR_USER` | Shared HR platform | HR identity and profile mapping | Referenced by applications, templates, notifications and logs |
| `CANDIDATE` | Recruitment module | Candidate identity and contact summary | Referenced by `APPLICATION` |
| `JOB_POSITION` | Recruitment module | Job position summary | Referenced by `APPLICATION` |
| `APPLICATION` | Recruitment module | Candidate-to-position workflow and assigned HR user | References candidate, position and HR user |
| `EMAIL_TEMPLATE` | Notification module | Shared, versionable email templates | References template creator/editor |
| `SYSTEM_NOTIFICATION` | Notification module | Per-HR internal notifications and read state | References HR user and optional application |
| `NOTIFICATION_LOG` | Notification module | Immutable successful-email snapshot | References application, template and sender |
| `NOTIFICATION_ATTACHMENT` | Notification module | Private attachment metadata | References notification log |
| `MODULE_SESSION` | Platform infrastructure | Persistent server-side sessions | Independent session key and expiry |
| `MODULE_ACCOUNT` | Standalone development only | Temporary local account mapping | Must not become the team production login source |
| `SequelizeMeta` | Migration infrastructure | Applied migration history | Managed by Umzug |

## Shared ownership contract

The team must agree on one canonical definition for `HR_USER`, `CANDIDATE`, `JOB_POSITION` and `APPLICATION`. The current notification migration supports team mode by requiring the following application fields:

- `application_id`
- `candidate_id`
- `position_id`
- `assigned_hr_user_id`
- `current_status`
- `applied_at`

The notification module should retain ownership of `EMAIL_TEMPLATE`, `SYSTEM_NOTIFICATION`, `NOTIFICATION_LOG` and `NOTIFICATION_ATTACHMENT`. Other modules must not update these tables directly. They should call a trusted server-side service or an agreed internal endpoint so validation, authorization, idempotency and transactions remain consistent.

Every workflow event must have a globally unique `eventKey`. This prevents duplicate notifications and duplicate email attempts when a request is retried.

## Current local database snapshot

The verified local development database is `jrs_hr_module_dev_20260908` on MySQL 26.7.0. At the time of this review it contained:

| Table | Rows |
| --- | ---: |
| `HR_USER` | 1 |
| `MODULE_ACCOUNT` | 1 |
| `MODULE_SESSION` | 3 |
| `EMAIL_TEMPLATE` | 5 |
| `CANDIDATE` | 0 |
| `JOB_POSITION` | 0 |
| `APPLICATION` | 0 |
| `SYSTEM_NOTIFICATION` | 0 |
| `NOTIFICATION_LOG` | 0 |
| `NOTIFICATION_ATTACHMENT` | 0 |
| `SequelizeMeta` | 2 |

This snapshot proves that the schema and persistence layer are operational. It is not production data and should not be copied as the team's source of truth.

## What this baseline can support now

- Persistent HR profiles and profile photos.
- Persistent email templates with create, update and archive behavior.
- Per-HR notifications, unread state and filtering.
- Successful email-history snapshots and authorized attachment downloads.
- MySQL-backed sessions, authorization boundaries and CSRF-protected writes.
- Swagger and Postman-based API review.
- Repeatable database setup through migrations.
- Automated unit, API and real-MySQL tests.

## What is still required for a complete team project

1. Implement and install the real team authentication adapter.
2. Agree on the canonical user, candidate, position and application schemas.
3. Implement candidates, job positions, applications, interviews and offers in their owning modules.
4. Connect application status changes to the notification service with unique event keys.
5. Decide whether workflow integration is in-process or uses a private authenticated internal API.
6. Add production hosting, HTTPS, secrets management, backups and migration execution roles.
7. Move private uploads to shared durable storage if more than one server instance will run.
8. Configure an approved email provider only after the team agrees on sender identity and test recipients.
9. Add role and permission rules beyond the current HR-only boundary if the final project includes other user types.
10. Run end-to-end integration tests with every teammate's module before declaring the project complete.

## Sharing procedure

1. Use this repository and its migration files as the canonical backend source.
2. Commit every schema change as a new migration; never edit an already-applied migration.
3. Do not use `sequelize.sync({ force: true })` or `sequelize.sync({ alter: true })`.
4. Give each developer a personal `.env` created from `server/.env.example`.
5. Never commit `.env`, database passwords, session secrets, SMTP credentials, uploads or database files.
6. Use separate local databases for development and tests.
7. Use one managed shared integration database for team integration, with backups and least-privilege accounts.
8. Review OpenAPI changes together before changing request or response fields.
9. Run `npm.cmd test`, `npm.cmd run test:mysql`, `npm.cmd run build` and `npm.cmd run docs:check` before merging.

Detailed managed-database setup, individual account rules, initial migration steps and the contributor workflow are documented in `docs/TEAM_DEVELOPMENT.md`.

## Recommended team decision

Adopt this repository as the HR backend baseline, not as a finished full-system backend. Freeze the table and API ownership described above, appoint one migration owner, and require all teammates to integrate through reviewed migrations and service/API contracts. This preserves the current working notification module while allowing the remaining recruitment modules to be added without later database reconstruction.
