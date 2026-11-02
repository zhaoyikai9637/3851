# Design review and release audit follow-up

## Provenance and scope

Received on 2026-10-22 from the troubleshooting conversation's handoff, which
reports a review of `Feedback of Yibo design.docx` and eight screenshots. This
document records that reported feedback; the original Word document was not
reopened during this integration. Earlier workspace audit findings are leads,
not verified defects in the current release checkout. No private credentials or
environment files were read for this review. No cloud service state was checked.

The release checkout is `E:/textProject/JRS-repository-cleanup/JRS`; local runtime
is `E:/textProject/JRS`. Do not overwrite these with older workspace snapshots.
Application changes through `76b07d0` are published to main. This audit does not
authorize deployment, shared database migration, account changes or real mail.

## Teacher feedback: current evidence and remaining decisions

| Topic | Current source evidence | Follow-up |
| --- | --- | --- |
| Long job editing | `JobDetails.jsx` replaces the drawer with a full-width continuous form; desktop/phone acceptance recorded in HANDOFF | Delivered in `76b07d0`; further list redesign needs its own brief |
| Navigation terminology | Shared workspace navigation and breadcrumb component exist; obsolete static job/interview URLs redirect in `server/runtime.mjs` | Audit visible names across all teammates; agree one vocabulary |
| Department | Present in job editing and list filtering | Decide whether candidates benefit from seeing it; document internal versus public meaning before changing fields |
| Breadcrumbs and team consistency | Shared `WorkspacePath` exists; selected top-level pages intentionally use sections without visible title rows | Check nested flows and cross-team consistency without undoing the user's approved compact header |
| Buttons and placement | Shared account/menu and job primary/secondary styles exist; full-page job actions use a sticky footer | Agree common sizes, order and placement for create/edit/save/cancel across modules |
| Sign out | `WorkspaceLayout.jsx` account menu contains My Profile and Logout with confirmation | Include discoverability and shared-session invalidation in acceptance |
| Closing versus unpublishing | `pages/jobs/model.js` rejects invalid dates and requires unpublish after deadline | Explain business meanings in the UI/docs and audit applicant visibility; do not merge fields without agreement |
| Assessment ratings | Native `dist/app.js` has add/remove assessment actions and a limit of 20 criteria | Verify the teacher's expected flexibility in the full feedback flow |
| Interviewer placement | No layout decision made by this handoff | Define consistent column priority and right-aligned actions across table pages |
| Realistic data volume | Viewport pagination acceptance and 100-job frontend regression coverage already exist | Extend cross-module acceptance with 100+ fictional records, long text, filters, paging and phones |

## Release audit queue

These items require focused verification before production readiness can be claimed.
An installed dependency or a matching source symbol is not end-to-end evidence.

### P0: identity, build and deployment boundaries

- Verify shared login, canonical HR mapping, role/disabled-account checks, global
  logout and revocation across every API surface. `server/runtime.mjs` already
  checks shared sessions and HR identity and delegates logout to shared identity;
  therefore the older claim that no integration exists is not current evidence.
  Standalone configuration rejects development identity in production; inspect
  the actual final startup path rather than requiring obsolete adapter settings.
- Verify the final served build has no recruitment-team placeholder pages.
- Choose the deployment platform and a reproducible configuration: host/port,
  reverse proxy, domain, HTTPS and secret injection. Separate a reviewed migration
  job from application startup; require a backup and recovery path. Never weaken
  database safety merely to make a production migration run.
- Separate production from shared integration. The existing local schema-11 and
  pending shared migration notes remain authoritative until independently checked;
  this handoff performs no cloud migration.

### P1: state, availability and mail

- Inspect persistent avatar/resume/attachment storage. Local file paths remain in
  runtime code; confirm the deployment volume or object-storage design, multi-
  instance behavior and file restoration together with database restoration.
- Audit actual rate-limit middleware coverage for login, session/CSRF creation,
  uploads, mail/template mutation and other APIs. Package presence alone is not
  evidence that a route is protected.
- Inspect health/readiness endpoints. Readiness should cover the database,
  required schema version and necessary storage; a process-only response cannot
  establish readiness.
- Review sender-domain verification, SPF/DKIM/DMARC, failure/retry/bounce handling
  and duplicate prevention. Prior receipt of one sandbox test message establishes
  that delivery only, not production mail readiness.

### P2: operations and acceptance

- Structured logs, request IDs, monitoring and alerts without passwords, cookies,
  CSRF tokens or sensitive mail contents.
- CI/CD gates for tests, builds, English checks, API/document validation and
  dependency review, with migration and application rollout separated.
- Restore rehearsal for database and uploads; shared-login/multi-role journeys;
  100+ fictional records; concurrent edits; database outage; mail failure;
  redeployment persistence; desktop and phone acceptance.
- Review production Swagger visibility, same-origin/CORS rules, proxy trust and
  request-body limits against the chosen deployment architecture.

## Safety constraints to retain

- Seed, destructive and cleanup tests stay on named isolated local databases;
  they must remain blocked from shared cloud targets.
- Use distinct least-privilege runtime and migration users in production and
  individual service credentials for teammates; never share an admin account.
  Aiven console identity, database credentials and session secrets are distinct.
- Site passwords must be one-way hashes; administrators must not recover or
  display plaintext passwords. Lost service credentials require rotation/reset.
- Do not commit credentials or expose them in chat, logs or screenshots. Share
  connection metadata separately from private per-user credentials.
- Preserve existing CSRF, secure/HttpOnly cookies, TLS CA verification, input and
  upload validation, session enforcement, explicit migrations and shutdown safety.
