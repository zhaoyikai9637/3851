# Engineering handoff

## Date presentation - 2026-10-28

Full visible/input dates now use DD MM YYYY at the owner's request. API, calendar
bounds and database dates remain ISO; no existing records or sent mail were
rewritten. Native/React filters, job editing, shared communication dates and
applicant labels are updated. See [DATE_PRESENTATION.md](../../docs/DATE_PRESENTATION.md)
for verification and browser coverage. This supersedes earlier ISO UI notes below.

## Shen Junye HR 2.6.2 sync - 2026-10-23

Integrated the teacher-review workflow from d575dee, including removed shortcuts,
combined interview booking, in-place saves, ISO dates and Closed-only lifecycle.
Retained shared authentication, actual submitted resumes, assessment persistence
and canonical mail integration. Earlier test-expectation failures below are now
resolved: React 129, clean-root 127 (local runtime 132), native HR 125, server 183,
MySQL 12, default workflow
2 and experimental workflow 2 passed; production builds passed. See
[SHEN_HR_262_SYNC.md](../../docs/SHEN_HR_262_SYNC.md) for scope and verification limits.
No live records/schema or production deployment were changed.

## Shared list presentation - 2026-10-22

The integrated workspace now loads one shared stylesheet in both the React shell
and the native recruitment document. Applications, Candidates, Job Postings,
Interviews and Notifications use consistent search controls, buttons, table
headers, row density and pagination. Notification time grouping remains intact.
See `../../docs/WORKSPACE_UI_CONSISTENCY.md` for exact checks and existing React
suite failures. No API or database changes were made.

## Railway deployment preparation - 2026-10-22

See [RAILWAY_DEPLOYMENT.md](../../docs/RAILWAY_DEPLOYMENT.md). Added Docker/Railway
configuration, private environment template, a production database mode restricted
to jrs_production/jrs_production_app with verified TLS, external HOST/PORT support,
durable upload paths, volume-mount checks, liveness/readiness and a sanitized
preflight CLI. Existing local/team modes remain supported; local setup/tests still
refuse cloud targets. Railway production cannot point at the integration database.

Schema-only export is limited to an isolated local schema-11 database and copies
no account or applicant records. A reviewed artifact was generated locally; it
does not initialize production or provision HR accounts. Root 125, frontend 129,
backend/API 183, native HR 112 and isolated MySQL 12 tests passed, both clients built,
and OpenAPI/English checks passed. Local runtime smoke checks returned 200 for
live/ready, login and HR assets, and 401 for anonymous identity access.

No paid resource, cloud migration or public deployment was performed. Docker is
not installed on the preparing host: Linux image construction, actual mounted
volume ownership, cloud TLS, production mail delivery, initial HR provisioning
and backup restoration remain rollout gates. Do not report the site as live.
Platform verification found that Railway Hobby blocks outbound SMTP. The owner
confirmed QQ SMTP was only a test, so Hobby preparation continues with mail off,
without an upgrade. Infrastructure preflight allows this with an explicit warning;
`--require-mail` rejects it. HTTPS production mail integration remains queued.
The default candidate job/resume/status presentation remains a public-launch
blocker: source inspection confirms the team seed/display scripts and disabled
editing controls. Complete actual candidate submission acceptance before launch.

## Supplemental review handoff - 2026-10-22

Teacher feedback and the older troubleshooting release-audit leads are tracked
in [REVIEW_FOLLOW_UP.md](../../docs/REVIEW_FOLLOW_UP.md). Source inspection confirms
that full-page job editing, account-menu Logout, configurable assessment rows,
job-date ordering and shared runtime identity/logout integration already exist.
Their presence is not a production-readiness claim. Remaining UI decisions and
P0/P1/P2 operational checks are queued with provenance and verification limits;
no older snapshot, private environment file or cloud database was used to replace
the current implementation.

## Job editing update - 2026-10-22

Job Postings now opens details and editing in the normal full-width workspace,
replacing the modal side drawer. Editing presents position information, long-form
description/requirements and compensation/publishing together in one continuous
form. Desktop uses two columns for short fields; phones use one. Textareas use
15px text and remain vertically resizable. Browser document scrolling replaces
the drawer scroll region, and a sticky footer keeps Save/Cancel reachable.

The explicit Back/Cancel actions confirm discarding dirty edits; beforeunload
requests the browser's refresh/close warning while edits are dirty. This is not
autosave. List search, filters and pagination remain mounted while details are
open, and closing restores focus to the initiating list button. Existing API
payloads, revisions, validation and status command behavior are preserved.

Verified in Edge at desktop and 390px: full-width editor, normal document scroll,
continuous fields, sticky actions, retained edits after Keep editing, discard to
the retained list, and no phone document horizontal overflow. Root 118, frontend
129 (including 18 job tests), native HR 112, backend/API 183 and isolated MySQL
12 tests passed; both production clients built. Browser checks did not save
changes to existing job records. Remaining list/design refinements stay queued.

## Current continuation status - 2026-10-21

Page sections now live in the shared white header. Applications, Interviews,
Reports and communication pages omit visible title/breadcrumb rows; their page
heading remains available to assistive technology. Desktop sections share one
row with the account control; phones retain a separate horizontally scrollable
section row below the menu/account controls. Candidate detail sections also use
the shared header while retaining their breadcrumb. Embedded navigation uses
same-origin/source checks and a mounted acknowledgement before hiding its source.
The host recalculates pagination space after header size changes.

Verified in Edge: Applications All/Hired, Reports Job performance, Interviews
Upcoming and communication Templates switching; 390px navigation has no document
horizontal overflow. Root 118, frontend 128, native HR 112, backend/API 183 and
isolated MySQL 12 tests passed; both production clients built successfully.

Communication navigation (Notifications, Templates, Logs) now matches the Reports
selected-tab treatment: pale blue background, rounded corners and a blue bottom
border. Edge switching and 390px navigation fit were verified; runtime build passed.
Applications stage links use the same rounded, semibold selected-tab treatment.

Applications, Candidates, Interviews, Reports lists and Job Postings now calculate page sizes
from real row heights and an independent outer-browser space budget. This reduces
unnecessary scrolling without clipping content. Search focus, IME and expandable
details remain protected. Candidates retains its list/page when opening a profile.
Edge desktop, 390px and 320px checks passed after browser control was restored.
See ../../docs/VIEWPORT_PAGINATION.md for measured sizes and remaining necessary scroll.

Job intake and processing are now separate: Closed stops new applications while
existing applications can continue; Stopped stops both intake and progression.
Draft remains non-operational. Schema 11 was backed up and applied to local dev/test;
cloud migration is pending an authorized schema owner. See ../../docs/JOB_LIFECYCLE.md.

Embedded height-only resize events no longer rebuild recruitment content. This
keeps native Job Information details expanded and search focus/caret intact when
the outer page fits the iframe to changing content. Search also defers filtering
until IME composition completes. Three regression tests first failed, then passed;
root tests (109), frontend tests (122), backend/API tests (183), dedicated MySQL
tests (12) and production builds passed. Edge desktop and 390px interaction checks
verified continued search input and persistent Job Information expansion.

Dashboard, Applications, Interviews and Reports now use browser page scrolling,
matching Job Postings. Intrinsic content height replaces the fixed iframe viewport;
wheel chaining and width-only responsive rules prevent blocked scrolling and
Reports resize loops. Phone card overflow and the narrow header were corrected.
Desktop and 390px/320px Edge checks were performed. This supersedes historical
fixed-viewport guidance below. See `../../docs/HR_PAGE_SCROLLING.md` for evidence.

Public job pages now use the same overlapping 24px dark/blue circles, 16px JRS
wordmark and 9px subtitle as shared login/registration. Public navigation and
the brand's jobs destination are retained. Three visitor DOM/CSS tests and both
production builds passed. Browser visual acceptance was not performed.

Login and registration now expose an arrow-labelled Back to jobs link above the
form. It opens the public `/jobs` route without submitting credentials. This
follow-up passed 15 login DOM tests and 69 login Jest tests; the actual running
server serves the link/styles and its destination returns HTTP 200. Source and
tests were synchronized to the runtime checkout. No browser visual check was run.

This section supersedes historical pending statements below. See
`../../docs/TEAM_MAIL_OPERATIONS.md` for current operations and limitations.

- Schema 10 was applied after private backups to local dev and `jrs_team`;
  all 52 pre-existing table counts were retained. The old cloud source was not changed.
- Applicant/profile integration, submitted materials, shared mail configuration,
  recovery routing and mail-history bridging are implemented and synchronized to
  the actual runtime. Fresh regressions passed 709 tests; both clients built.
  See `../../docs/VERIFICATION_20261021.md` for commands and remaining acceptance.
- Password symbols are optional. Missing uppercase/lowercase/digit/length conditions
  are reported individually; ASCII and safe bcrypt limits remain enforced.
- Removed the HR sign-in intermediate page. Unauthenticated and expired sessions
  enter shared sign-in directly. Safe deep links return to their business task;
  logout and ordinary HR login retain Dashboard as the default.
- Ten formal templates are active in dev and shared target. Nine exact local JRS
  seeds and five exact old shared native seeds were archived, preserving history.
  Native canonical-template edits are rejected. Business preview placeholders
  distinguish missing actual interview and offer values from sample identity values.
- The core canonical import tool supports private preview, explicit ID mapping,
  conflict rejection, digest approval, backup and transactional inserts. Other
  module tables/native recruitment links still need reviewed adapters.
- User confirmed the SMTP test arrived. Candidate registration and real recovery
  delivery, real recruitment email receipt, hosting selection and cross-role visual
  acceptance remain pending. No platform roles or hosting deployment are claimed.
- Teacher feedback was read from the original Word document. Pending placement
  and cross-role visual questions remain explicit; historical test results below
  are not fresh verification for this continuation.

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
# Workspace heading refinement (2026-10-20)

- Non-communication pages show their current location in a compact top bar instead of an empty account-only header. Communication tabs remain scoped to their own module.
- Recruitment pages omit redundant single-item breadcrumbs, preserve linked multi-level trails, and remove explanatory page-heading subtitles. Existing actions, report tabs, status values and business data remain unchanged.
- Regression tests exercised real page renderers and navigation routes: integrated frontend 82, backend/API 183, Jest 73, isolated MySQL 12 and root tests 21 passed. Standalone frontend 81 passed. Production builds and English-only validation passed. Reports was visually checked at desktop and 390px mobile widths.
## Application email simplification (2026-10-20)

- Removed the standalone Outbox page and sidebar entry; its legacy workspace URL redirects to Applications. Existing draft rows and sent-mail records are retained.
- Application rows and detail views expose candidate-scoped email drafts and history. Saving/editing drafts stays in the application; sending requires a separate preview and explicit confirmation. Disabled delivery remains disabled, including in the confirmation form.
- Embedded navigation uses explicit, origin/source-validated, allowlisted messages and React routing. Resize reports only update height; they cannot redirect to Notifications. Content-based sizing prevents iframe height feedback, and embedded dialogs remain near the visible top.
- Verification: root tests 24, HR frontend 86, backend/API 183, isolated MySQL 12, Jest 73, and recruitment module tests 107 passed. Production builds and English-only checks passed. Desktop and 390px mobile email dialogs, legacy Outbox redirect, and Templates/Logs navigation were checked in the browser. No real email was sent and browser checks did not save test drafts.
## Stable embedded viewport and clickable workspace paths (2026-10-20)

- Reports previously alternated around the iframe's 620px responsive breakpoint. The outer viewport now determines iframe height; content never resizes its own viewport, and long content remains scrollable inside it.
- Replaced static location text with accessible parent-path controls. HR Workspace returns to Dashboard; Edit Profile includes My Profile; application subpages publish their actual hierarchy and allow returning to parent queues. Embedded breadcrumbs are not duplicated inside the content.
- Path updates retain origin/source checks, bounded labels, route allowlists and location ownership. Returning from a candidate profile clears the embedded path. Communication tabs remain unchanged.
- Verification: root tests 24, frontend 91, backend/API 183, isolated MySQL 12, recruitment tests 107 and Jest 73 passed; production builds and English-only validation passed. Browser checks confirmed stable Reports height across section changes and working Applications / Offer parent navigation. A 390px viewport check confirmed the path remains accessible and horizontally scrollable. No business data or mail settings changed.

## Job Postings design pilot (2026-10-20)

- User-approved pilot only: table-first jobs, status/search filters, pagination, and a wide right-side drawer with Overview, Requirements and Publishing tabs. Other HR pages, applicant pages and login are not redesigned.
- Removed the meaningless HR Workspace parent from this pilot's location bar. Real application parent paths remain navigable. Viewing applications from a job opens the existing queue with its job filter selected; clearing filters still works.
- Merged the standalone publishing form into job create/edit. English text inputs and an English calendar use DD/MM/YYYY; API dates remain ISO. Drawer actions stay visible, and closing dirty edits requires confirmation.
- Added a shared-session adapter over the original recruitment command service. Job and publication values commit in the same transaction; native validation, permissions, sending locks, audit, revision checks and idempotency remain authoritative. No schema migration or new login mechanism.
- Verification: frontend 100, HR backend/API 183, isolated HR MySQL 12, root 24, default workflow MySQL 2, experimental workflow MySQL 2, native recruitment 108 and Jest 73 tests passed. Production build and English-only check passed (384 files, zero issues). Desktop and 390px mobile table/drawer/calendar and dirty-close behavior were checked in the browser. Browser-entered trial dates were discarded; no real email was sent.
- Await user review of this pilot before extending the visual pattern to other HR pages. Keep the standalone personal module unchanged.
## Job action feedback cleanup (2026-10-20)

- Removed Job Postings success banners and their unused state/styles. Save, create, close and reopen still update the table immediately; error feedback and explicit confirmations remain intact.
- Updated regression tests to verify visible job results without a success banner, including reopening a closed job. Frontend 100, backend/API 183, isolated MySQL 12 and Jest 73 tests passed; production build and English-only checks passed. No backend or database rules changed. Browser layout testing was not repeated for this banner-only removal.
## Publication rules and 100-job acceptance (2026-10-21)

- Implemented user-confirmed UTC+08 publication/deadline/unpublish rules. Candidate discovery and accepting applications are independent; unpublishing preserves internal recruitment and existing applications. Close recruitment is explicitly labelled separately.
- Added an additive schema version 7 migration for new application job snapshots. Applied and repeated only on the approved local dev/test schemas. Existing unknown historical snapshots remain absent; no cloud changes or reseeding.
- Verified applicant list/detail/submission boundaries, owner-only application access, immutable submission-time content and HR progression after unpublishing. Necessary availability text was added without redesigning applicant/login pages.
- Verification: root 26, default workflow MySQL 2, experimental workflow MySQL 2, HR frontend 102, backend/API 183, isolated HR MySQL 12, native recruitment 108 and Jest 73 passed. Both frontend production builds and English-only checks passed. 100-job table behavior and desktop/390px scrolling were checked with isolated fixtures; no fixture data entered cloud or development recruitment tables.
- See JOB_PUBLICATION_RULES.md. HR-wide visual rollout and extensible assessment criteria are still pending and must follow this milestone.
## Compact HR layout and extensible assessment (2026-10-21)

- Adopted the user's compact toolbar reference without restoring inconsistent page names. Job Postings removes the large duplicate heading/totals and adds dynamic department plus status/search filters. Other HR business pages use compact shared titles, real parent paths and preserved actions; communication tabs stay scoped.
- Embedded HR date controls now use English calendars and DD/MM/YYYY while retaining original ISO form fields, filter events and date constraints. Fixed an absolute hidden table label that caused outer mobile horizontal overflow.
- Added editable per-interview assessment criteria with unselected scores, manual overall rating/recommendation and escaped historical summaries. No automatic hiring decision, weighted score, new role permission or global template editor.
- Applied additive schema version 8 only to dedicated local dev/test databases. Assessment snapshots share the feedback transaction, survive reload and reject later rewrites. Old feedback and login/applicant layouts are preserved; cloud data and real candidates were not changed.
- Verification: HR frontend 103, backend/API 183, isolated HR MySQL 12, native recruitment 111, Jest 73, root 30, default workflow MySQL 2 and experimental MySQL 2 passed. Production build and English-only checks passed. Desktop/390px job controls, reports, English calendar, add/remove/submit assessment and independent score results were checked. Browser scoring used only fictional in-memory fixtures; no real mail.
- See HR_WORKSPACE_AND_ASSESSMENT.md for the integration-only storage adapter and migration command. Broader global scoring-template or weight design remains separate.

## Persistent local demonstration records (2026-10-21)

- At the user's request, imported the visual examples into the active local development database: 100 Demo jobs, two fictional candidates, two applications and two interviews. One interview awaits feedback; the completed example preserves criterion scores separately from the manual overall score.
- Existing recruitment records and HR identities are retained. No cloud writes, new login accounts, resume files, real email or fabricated sent-mail events. Future publication settings keep these demonstration jobs out of current public discovery.
- The explicit local-only CLI is transactional, repeatable and writes a private pre-import recruitment snapshot. Two real-MySQL regressions verify preservation, assessment persistence, repeat imports and database-target guards. The browser confirmed the normal Job Postings and Interviews pages read the persisted examples.
- See DEMO_DATA.md. Database rows and private snapshots are not published to Git; only the importer, tests and documentation are shared.

## Drawer dismissal and useful demo workflows (2026-10-21)

- Job drawer backdrop clicks now use the existing guarded close flow. Internal blank-space clicks and drags starting inside do not dismiss it; dirty edits still require explicit discard and busy saves remain protected.
- Replaced untouched generic Demo job placeholders with role-specific skills, requirements, teams, salary ranges and recruitment statuses. Every Demo job now links to at least one application. The enriched local batch has 101 fictional candidates/applications, 55 interviews and 13 follow-up tasks covering all six recruitment stages.
- Existing real records, user-edited demos and the two original feedback examples remain intact. The local-only enrichment transaction is repeatable, backs up the recruitment snapshot including assessments and updates only demo canonical links. No cloud writes, real mail, login accounts or resume files.
- Added three frontend backdrop regressions and a rolled-back real-MySQL enrichment regression. Browser verification confirmed direct backdrop dismissal, dirty confirmation/discard, persisted role data and a job-filtered application case. See DEMO_DATA.md for repeatable commands.
- Verification: HR frontend 106, backend/API 183, isolated HR MySQL 12, native recruitment 111, Jest 73, root 30, demo MySQL 3 and default/experimental workflow MySQL 2 each passed (522 total). Production build and English-only validation passed.

## HR-wide consistency rollout (2026-10-21, confirmed and implemented)

- Q9-Q11 approved: use mixed task surfaces, prioritize common viewing paths within three navigation clicks, and return completed actions to their work queue. Preserve required confirmations and long-form validation.
- Unified compact titles, toolbars, controls, tables and feedback surfaces across HR. Dashboard is queue-first; Applications has stage tabs and row menus; Candidates has server-backed search and pagination; Interviews has time-based shortcuts. Notifications remains a feed, Templates remains split-view, and sent email history uses a table/detail drawer.
- English calendars support days, months and decade/year selection. Inputs display DD/MM/YYYY and transport ISO dates; historical and min/max constraints remain enforced.
- Fixed explicit cross-module navigation without allowing late iframe load messages to redirect the active page. Candidate profile return retains query/page and uses its real Candidates parent path.
- No new framework, database migration, cloud writes, real email, permission expansion or automatic hiring decision. Applicant and login implementation remains queued in PLAN.md.
- Verification: frontend 113, backend/API 183, isolated HR MySQL 12, native recruitment 111, Jest 73, root 34, demo MySQL 3, default workflow MySQL 2 and experimental workflow MySQL 2 passed (533 total). Production build passed. See HR_INTERFACE_ROLLOUT.md for scope and acceptance details.


## Approved team integration execution (2026-10-21)

1. Prepare a separate cloud database jrs_team without modifying the previous shared database. Retain local-only setup, seed and destructive test guards. Runtime uses verified TLS and a dedicated DML-only account; credentials are delivered separately in a private local text file.
2. Inventory and back up existing cloud records, then migrate reviewed business data with explicit ID mappings. Exclude local demo/test batches. Member imports require preview, validation, deduplication and backup rather than whole-database overwrite.
3. Reorganize shared login and recovery UI, restore the original two-circle JRS identity in both login and HR, and wire expiring single-use recovery links for HR and candidates. SMTP inbox acceptance depends on the login owner's configuration; automated transport tests do not prove delivery.
4. Selectively integrate SiHuanjia's applicant standardization source, retaining the current publication guards, transactions and application snapshots. Current profile fields share one authoritative source; submitted materials remain immutable. Other members' changes are reported, not blindly merged.
5. Final phase task added by the user: complete Notification email templates, then remove verified test templates whose names begin with JRS. Inventory content and references first; a prefix alone does not prove a template is disposable. Back up before cleanup, preserve sent-email snapshots, and archive referenced test templates rather than break references.

Current status: shared target and local dev have schema 10 and ten active formal templates. Core reviewed integration is synchronized and verified; see the current continuation section above. The user confirmed receipt of the earlier SMTP test. Candidate recovery and real recruitment inbox acceptance, deployment selection and visual acceptance remain pending.
