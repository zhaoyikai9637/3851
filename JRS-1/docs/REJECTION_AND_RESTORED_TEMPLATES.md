# Simplified rejection and restored mail templates

## Confirmed scope - 4 November 2026

The supplied Junye Shen HR v2.6.2 archive still includes both rejection-reason dialogs. The user subsequently requested their removal. Reject now asks for one explicit confirmation explaining closure, interview cancellation and the absence of automatic email. Cancel leaves all records unchanged; confirm executes the existing guarded reject command, records the neutral internal outcome "Application closed by HR.", and returns to the Rejected queue.

The reason-selection dialog and editable Review Rejection dialog are removed. Rejected applications retain ordinary read-only application details. The obsolete View Rejection label and reason-confirmation attention task are removed. Existing detailed reasons and history are preserved; no database columns are dropped or rewritten. Existing legacy command support remains for API compatibility.

Legacy rejected applications can now prepare an unsent message without the removed confirmation step. Template applicability still checks the application stage and, for stage-specific rejection templates, the recorded source stage. Existing backend roles, revision checks, idempotency, status transitions, interview cancellation, draft supersession and explicit email sending remain enforced. There are no CSS changes.

## Restored examples

The previous jrs_hr_module_dev_team database was inspected in a read-only transaction. It contains five original templates: Interview Invite, Offer Letter, Accepted, Rejected and In Progress. All five were copied to jrs_production after a private backup, using insert-only identity/content checks and a transaction. Both the canonical and native HR template stores now contain them. Native subjects and bodies are preserved; canonical placeholders use the existing equivalent variable mapping. Existing accounts, jobs, applications, drafts and notification records were untouched. A repeated preview requests zero additions.

The user explicitly chose not to import the five historical Portal Integration Check notifications, whose original applications are absent from production. No historical notification or fake delivery log was created. No real email was sent. Templates appear under Notifications > Templates after refresh; the source database was not modified.

Private source snapshots, pre-change template backups and receipts are stored under .local/rejection-notices-20261104 in the active and review checkouts. They are excluded from GitHub. The backup concerns the two template tables and workspace revision; no authentication secrets are included.

## Verification

- node scripts/test-project.mjs --all: 768 passing tests across all six suites, production builds and English scan passed. Counts: 223 integrated, 69 login/profile, 26 applicant, 129 recruiting, 138 HR client and 183 HR server.
- Real isolated MySQL flow: applicant upload/submission, HR interview scheduling, rejection, cancelled interviews, applicant Rejected status, and no draft created by rejection passed. A separate explicitly requested draft succeeded for a legacy unconfirmed rejection without modifying its stored reason/confirmation flag.
- Template SQL import verified against temporary tables inside the owned isolated MySQL session; the original local template tables were retained. Production import committed five templates, and repeat preview returned zero additions.
- Edge at 1440 px and 390 px: cancellation does not change application status; confirmed rejection returns to the list; rejected details are read-only; no automatic email, horizontal overflow or page errors.

The restored database templates are available immediately. Removal of the old rejection dialogs requires deployment of this source. Synchronizing GitHub does not deploy Render.
