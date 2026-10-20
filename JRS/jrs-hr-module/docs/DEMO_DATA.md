# Local demonstration data

Run from the integrated project root:

```sh
node --test tests/demo-data.mysql.mjs
node scripts/import-demo-data.mjs --apply
node --test tests/demo-enrichment.mysql.mjs
node scripts/enrich-demo-data.mjs --apply
```

The importer only accepts the named local development/test schemas on port 3307.
It imports 100 clearly labelled Demo roles, two fictional applicants, two
applications, one interview awaiting feedback and one completed assessment.
All imported IDs start with `demo-20261021-`; email addresses use `example.test`.
It does not create login accounts, resume files, email drafts or sent-mail events.

Roles retain the visual fixture's alternating Active/Draft status, Engineering
and Operations departments, optional salary and January 2031 publication dates.
They are visible internally now, but are not public vacancies before that future
publication date. Existing application/recruitment rules are unchanged.

The completed assessment has four criterion scores of 4/5, an independently
entered overall rating of 2/5 and a Hold recommendation. The other interview
remains editable through the normal Record Feedback workflow and permissions.

One transaction inserts the new records and canonical HR links. Existing records
and edited demo records are not overwritten. Repeating the import skips existing
IDs and publication settings. Missing demo publication rows may be filled in.
No cloud connection is used and no real email is sent.

Before a CLI import, the original recruitment snapshot is saved under the ignored
`.local/before-demo-import-*.json` path. This is a recruitment snapshot, not a full
database backup. Private runtime snapshots must never be committed to Git.

The real-MySQL regression uses the isolated test database and rolls back all its
demo inserts. It checks preservation, persistence, independent scores, repeat
execution and rejection of other database targets.

## Meaningful workflow scenarios

The enrichment command replaces only untouched original placeholder jobs. It
keeps the 100 job IDs but uses ten professional role templates across ten teams,
eight departments, different locations, working arrangements, salaries and
recruitment statuses. Role-specific skills and written requirements are retained.
Every job has at least one linked application. The batch contains 101 fictional
candidates/applications, 55 interviews and 13 open follow-up tasks after enrichment.

Applications cover Pending Review, Interview, Interview Results, Offer, Rejected
and Hired. Cases include upcoming interviews, recorded criteria and notes,
manual recommendations, offers awaiting approval or approved, rejection reasons
and accepted demonstration offers. These are labelled fictional scenarios, not
claims that a real recruitment process took place. The original two feedback
examples and recorded assessments are not overwritten.

Edited placeholders and previously enriched records are skipped. Existing real
records, HR identities, publication schedules and sending permissions remain
unchanged. Demo publication dates stay in January 2031. A private pre-enrichment
snapshot includes assessment criteria; it is not a full database backup.

The enrichment regression runs in a rolled-back real-MySQL transaction and checks
all job/application relationships, stage coverage, canonical job names, preservation
of real and edited records, retained feedback and repeat-run idempotence.
