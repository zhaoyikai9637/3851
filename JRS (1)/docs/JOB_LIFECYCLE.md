# Job intake and existing application processing

| Status | New applications | Existing application progression |
| --- | --- | --- |
| Active | Enabled within publication dates | Enabled |
| Closed | Disabled | Enabled |
| Stopped | Disabled | Disabled |
| Draft | Disabled | Disabled |

Closed means intake has ended, not that existing applicants must be abandoned.
Stopped blocks moving to interview, scheduling/rescheduling and offer progression.
Viewing, rejection, cancellation and recording interview evidence remain available.
Stopping does not silently cancel an existing appointment or retract an offer.
HR must record those actions explicitly. Existing status, identity, CSRF, concurrency,
approval and interview timing rules still apply.

Edit a job in Job Postings to choose Stopped. Change it to Closed to resume handling
existing applicants without opening intake, or Active to reopen intake as well.
The close confirmation explains that existing applicants can continue.

Schema 11 adds Stopped to the recruiting job status enum without changing rows.
The local migration command is `node scripts/migrate-job-lifecycle.mjs`; it backs up
the affected table and version metadata under ignored `.local/backups` first.
It is repeatable and restricted to approved local databases. The normal local
setup also applies this migration. Runtime requires schema 11.

The approved local development and test databases were migrated and verified.
Cloud schema changes were not performed for this change: before using this release
with a team database, an authorized schema owner must back up that database and run
`migrateJobLifecycle` from `server/migrations/011-job-lifecycle.mjs` against the
verified team target. Runtime DML credentials must not receive schema privileges.

Validation includes model/UI regression tests, frontend and backend/API suites,
dedicated MySQL tests, integrated job status persistence, and production builds.
The final checks passed: 113 integrated unit tests, 123 React tests, 112 native HR
tests, 183 communication backend/API tests, 12 dedicated MySQL tests and 2 integrated
MySQL workflow tests (545 total). Both production client builds passed. A runtime
workspace snapshot rendered Olivia's Closed job with Move to Interview enabled and
Hannah's Draft job with it disabled. Browser clicking and mobile visual acceptance
could not run because local browser control was disabled in Work settings.
