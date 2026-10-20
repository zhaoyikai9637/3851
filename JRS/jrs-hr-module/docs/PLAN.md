# Delivery plan

## Repository language policy - 2026-10-19

- Keep current branch filenames and project text English-only; run the root check:english command.
- Preserve unfinished applicant source and branch-specific business behavior during cleanup.
- Keep credentials and local data outside Git. Removed historical attachments remain in earlier commits.

## Independent integration copy — 2026-10-19

- Root login/profile integration uses `JRS Login and profile`; HR keeps this module's UI.
- Root runtime excludes the unfinished `JRS Applicant Portal` by default; preserve it for later final-source review.
- Final applicant-module acceptance, production SMTP and deployment remain pending.
- Original standalone files and original databases must remain unchanged.

## Completed

- 2026-10-14: Applied two active cloud HR test profiles as authoritative local data, overwriting the old local profile at the user's request and removing unreferenced import duplicates. Local/cloud HR profile fields and IDs match; no cloud writes or authentication-record copying. Local development entry uses the manager; verified both profiles through the real-database-backed API. Team login mapping remains pending.

- Added independent native vertical scrolling to the template list on desktop and mobile, preserving template selection and the editor layout.

- Added Application Rejection, Interview Rejection, Offer Withdrawal and Offer Declined Acknowledgement to the shared registry, original content and validation/UI regression coverage. Preserve legacy data; event wiring remains a team integration task.

- Removed two redundant UI explanations while preserving conditional unsaved-edit feedback and existing sent-email history.

- Templates shows its saved count with creation/deletion refresh and load-failure regression coverage. Removed the Logs heading total at the user's request; activity-panel totals, filtering, pagination and history remain available.

- Added 18 Jest regressions: 64 local tests and 65 in GitHub, with the existing extra runtime test preserved. Refreshed the generated report with the current five-file coverage scope.

- Aligned Templates and Logs headings with Notification Center, retaining per-page content and responsive actions.

- Unified template usage configuration across client, validation and OpenAPI; added unknown-type preservation and extension regression tests.

- Aligned page, asset, configuration, route and entry directories with the team's convention without merging member modules.
- Inspected the cloud database read-only; no useful business rows were present to import.
- Added five original templates and an idempotent local-only installer with regression tests.

- Standardized navigation labels as nouns.
- Removed the browser-only data adapter and its access path.
- Added a local-only development entry backed by the real MySQL HR profile.
- Added a reviewed data-baseline migration and removed retired seeded activity.
- Split navigation and workspace layout from route definitions.
- Split log filtering, grouping and presentation into focused feature modules.
- Rebuilt Logs as grouped email activity aligned with Notifications.
- Preserved loading, empty, error, pagination, date validation and attachment states.
- Added explicit notification regression coverage for counts, time groups, filters, keyboard actions and mark-all Undo.
- Reduced `Notifications.jsx` from 510 lines to a 119-line route composition boundary.
- Separated notification state/actions, pure utilities, UI sections and feature-local responsive styles.
- Added scoped Biome lint and formatting checks without reformatting unrelated project history.

## Required before production

- Install the team authentication adapter.
- Configure the agreed team sign-in URL.
- Run migrations with the deployment database role.
- Enable SMTP only after sender-domain and operational approval.
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
