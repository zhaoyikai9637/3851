# JRS HR Recruitment Module

This module provides HR applications, candidate review, jobs, interviews, offers and recruitment email workflows.
In the integrated project, its business views are embedded inside the existing jrs-hr-module UI.
Use the integrated root startup rather than starting a second server.

## Standalone development

Use MySQL and the module's package.json commands. Install dependencies with npm ci.
Copy the appropriate environment example to a private local configuration.
For a previously configured local database, use npm run db:check before startup.
npm run start:local reads .env.local; npm start reads the standalone configuration.
Use the address printed by the server, normally http://localhost:3000.

db:init and db:seed are local-only operations, not routine startup commands.
Do not seed existing business data or reset an account to make setup succeed.
Shared database migrations require a reviewed schema, a backup and explicit coordinator approval.
See docs/TEAM_SETUP.md, docs/DATABASE.md, docs/API.md and docs/RETENTION.md.

## Review and data integrity

The current integrated HR version uses manual resume review.
Job Requirements hold the criteria; HR decides whether to advance an application.
Do not infer eligibility from education, field of study or graduation dates.
Job closure, stage order, interview conflicts, completed feedback, manager approval,
offer dates and explicit mail confirmation remain independent business constraints.
Branch-specific older implementations are preserved as source history, not silently upgraded by this documentation.

Mutations use authenticated HR identity, CSRF, workspace revision checks and idempotency keys.
Prepare email drafts separately from sending; provider acceptance is not evidence of inbox delivery.
Do not enable real SMTP for regression tests.

## Important files

dist/ contains the editable browser application, not a disposable generated bundle.
server/app.cjs defines APIs; server/service.cjs and dist/state.js implement business rules.
server/repository.cjs provides transactional persistence.
database/schema.sql defines the standalone hr_* schema.
The integrated runtime maps those tables to recruiting_* to avoid collisions with canonical HR tables.

## Verification

npm test runs database-independent Node tests.
Local integration and workflow scripts require an explicitly isolated local MySQL target.
Do not run integration tests or retention cleanup against the team cloud database.
Record actual test results; historical verification is not proof of the current checkout.
