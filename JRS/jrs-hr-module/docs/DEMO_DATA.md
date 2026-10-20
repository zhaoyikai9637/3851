# Local demonstration data

Run from the integrated project root:

```sh
node --test tests/demo-data.mysql.mjs
node scripts/import-demo-data.mjs --apply
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
