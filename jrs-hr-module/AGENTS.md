# JRS — Codex project instructions

## Start here

This started as an INCOMPLETE migration handoff. Current local implementation and test
evidence are in docs/HANDOFF.md; team integration is still incomplete. Do not assume
that another chat, its uploaded files, its permissions, or its test results are
available. Read `docs/HANDOFF.md` and `docs/PLAN.md` before substantive work.
`START_HERE.md` is the user's Windows/VS Code guide. `docs/SOURCES.md` maps the
original requirements and design evidence. Inspect actual source before relying
on any status summary. Update the handoff and plan when progress changes.

## User and scope

- Communicate in Chinese, with concrete steps suitable for a student using Windows
  and VS Code. Keep the application UI in English to match the supplied design.
- Build only the HR-facing Notification Center, Email Templates, Notification Log,
  avatar menu, My Profile, Edit Profile and Logout. Read the 15 use cases.
- Applications, candidates, jobs, status changes, interviews and offers belong to
  teammates. Implement documented adapters, not those complete business modules.
- PC-first, responsive on phones. Use the supplied Figma and report screenshots.
- Use JavaScript, React, Vite, Bootstrap, Node.js, Express, REST/JSON, Sequelize,
  MySQL, OpenAPI/Swagger, Vitest, React Testing Library and Supertest. Do not
  substitute Java/Spring, ASP.NET, TypeScript, SQLite or a hosted-only backend.

## Repository and safety

- `client/`: implemented React HR pages; no module-owned login form.
- `server/src/`: implemented HR API with tests; team identity adapter still pending.
- Login belongs to the teammate and is not implemented yet. Do not restore password
  login, automatically sign in, or expose the test-only identity fixture.
- `reference/`: private source evidence.
- Preserve user edits. Never delete a database, overwrite team tables, or use
  `sync({ force: true })` / `sync({ alter: true })` to make setup succeed.
- Use a new, dedicated development MySQL database after checking the target.
  The legacy SQL in `reference/legacy-sql/` is comparison evidence, not setup SQL.
- Keep credentials in local environment files. Do not print secrets or include
  them in Git. Prefer a dedicated development DB user, not a root account.
- Do not send real mail by default. PREVIEW and SMTP submission are not evidence
  of delivery to the candidate. Use fictitious data; never contact real candidates.
- Authorization must be enforced by the backend. A client-side role switch must
  never grant HR rights. Do not expand the personal module into a candidate UI.
- Ask for required network/command permission through the actual host workflow.
  Do not bypass a denial, change registries to evade it, or disable safeguards.
- Do not publish to GitHub, deploy, or upload private reports without explicit
  instruction. `reference/` is intentionally Git-ignored in this handoff copy.

## Verification and commands

Node 24.x is selected. Node 24.16.0/npm 11.13.0 and the lockfile installation have
been verified locally; see docs/DEPENDENCIES.md for versions and retained advisories.
Review manifest/lock compatibility before installing; do not discard the lockfile.

After approval and dependency review: `npm install` from this project root.
Existing planned scripts: `npm run dev`, `npm run build`, `npm test`,
`npm run test:mysql`, `npm run db:migrate`, `npm run db:seed`, `npm run docs:export`.
These script targets now exist, including docs:check for OpenAPI/example validation.
Read the current plan and actual test results before making claims. db:migrate writes
to the database; the two approved dedicated local databases already exist.

Before claiming completion, run frontend unit tests, backend unit tests, Supertest
API tests, isolated real-MySQL integration tests and the production build. Report
exact commands, results and any untested portions. Unit mocks do not verify SQL.
Check desktop/mobile layouts and the full authorized user journey. Follow the
acceptance criteria and requirement/draft differences in `docs/HANDOFF.md`.
