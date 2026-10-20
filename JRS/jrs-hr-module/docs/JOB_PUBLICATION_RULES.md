# Job publication and application deadlines

The integrated adapter separates candidate-facing publication from internal recruitment. All date-only boundaries use UTC+08:00 (Asia/Singapore). UI dates use DD/MM/YYYY; stored/API dates use YYYY-MM-DD.

| Field | Boundary | Effect |
| --- | --- | --- |
| Publish date | Start of the selected day | Makes an Active role discoverable |
| Application deadline | End of the selected day | Stops new applications without removing the listing |
| Unpublish date | Start of the selected day | Removes discovery and public detail access; rejects new submissions |

Blank dates impose no corresponding date restriction. When supplied, unpublish must be later than the deadline so the deadline day remains available. Neither deadline nor unpublish changes the internal Active/Draft/Closed status. Close recruitment is a separate explicit action and retains its existing progression restrictions. Unpublishing does not reject applicants or send mail.

An applicant can still read their own application after unpublishing. New applications retain a private job snapshot in the same submission transaction. Later job edits do not rewrite that snapshot. Existing applications without snapshots retain their linked job record; their unknown historical content is not reconstructed. The API identifies this using jobSnapshotAvailable. Current availability is derived separately from historical job content.

## Local schema update

Schema version 7 adds one nullable JSON column to JRS_APPLICATION_LINK. No existing record is deleted or reseeded. The repeatable migration is server/migrations/007-application-snapshot.mjs. Run node scripts/migrate-application-snapshot.mjs only against the configured dedicated local database, then restart the local server. The normal setup command supports both fresh and existing integrated schemas. Cloud databases were not changed.

## Verification and remaining rollout

Boundary tests cover the exact start/end instants in UTC+08. The isolated experimental MySQL workflow covers deadline visibility, unpublish discovery/direct-access/submission denial, owner access, immutable job snapshot, and HR progression after unpublishing. The experimental applicant portal remains disabled by default; its login and visual layout were not redesigned. Only the necessary availability label was added to the existing status page.

The 100-job UI fixture is isolated from databases. Automated tests exercise ten-row pages, status and search filtering, edit-return position and long titles. Desktop and 390px mobile checks cover wrapping, scrolling and access to offscreen columns. This is not a production-scale performance benchmark.

Next stages remain separate: unify other HR pages, then design and implement extensible interview assessment criteria. Do not infer new scoring weights or change authorization as part of visual cleanup.
