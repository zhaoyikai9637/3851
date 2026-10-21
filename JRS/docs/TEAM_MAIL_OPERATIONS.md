# Team integration and email operations

The approved shared target is `jrs_team`. The previous cloud database remains a
source: never run setup, seed, destructive tests or whole-database replacement
against it. Development and integration tests remain local on port 3307.

## Runtime secrets and deployment

Use `DB_MODE=team`, `DB_NAME=jrs_team`, the restricted `jrs_team_app` account,
`DB_EXPECTED_HOST` matching `DB_HOST`, and `DB_SSL_CA_PATH` for the trusted CA.
TLS verifies certificate and host identity. The runtime account has SELECT,
INSERT, UPDATE and DELETE; migrations require separate temporary credentials.
The private credentials text is delivered outside Git. Never copy its values
into source, logs, issues or chat.

Both mail paths share SMTP configuration. `JRS_MAIL_ENV_FILE` accepts only
`SMTP_*` keys. A cloud host can supply these keys directly as secrets;
`SMTP_PASSWORD_FILE` also supports a mounted secret. Incomplete enabled SMTP
configuration stops startup. Retain sandbox mode and an explicit recipient
allowlist until real delivery is accepted. The allowlist is checked on send.

Store `SESSION_SECRET` and `RESET_SECRET` independently. Production needs HTTPS
`APP_ORIGIN`, appropriate port binding, persistent private document storage,
database backups and outbound SMTP access. `npm run build` builds both clients.
The applicant portal is enabled unless explicitly set false with
`ENABLE_EXPERIMENTAL_APPLICANT_PORTAL`.

No hosting platform or platform operator roles have been created. After platform
selection, grant approved operators equal, named access to deployment and secret
rotation with individual authentication and an audit trail. Application database
credentials do not provide platform administration.

## Controlled member imports

`node scripts/import-team-data.mjs <private-batch.json>` creates a private preview
under `.local/controlled-imports/` without business writes. Review its target,
inserts, skips, conflicts and digest. Rerun with the approved SHA-256 digest as
the second argument to apply. The target is re-read in a serializable transaction;
a stale digest or any conflict prevents all inserts. Successful runs retain a
private pre-change snapshot and receipt. A failed insert rolls back the batch.

The current allowlist is CANDIDATE, JOB_POSITION, EMAIL_TEMPLATE and APPLICATION.
Use canonical SQL column names and explicit positive primary keys. An `idMap`
provides reviewed key mappings, including parent references. Exact existing rows
are skipped. Conflicting IDs, candidate emails, template names and job titles
need review; authoritative rows are never overwritten. JSON columns use JSON
strings; database constraints remain authoritative.

```json
{
  "rows": {"CANDIDATE": [
    {"candidate_id": 501, "full_name": "Example Person", "email": "person@example.test", "account_id": null}
  ]},
  "idMap": {"CANDIDATE": {"501": 1501}}
}
```

The tool imports core canonical business records. It does not create or attach
login accounts, transfer resume files, rewrite submissions or import mail history.
Other module tables and native recruitment links require separately reviewed
adapters. No member batch has been applied to the cloud; shared-target validation
used an empty read-only preview.

## Templates and history

Templates is the single shared editor. Native commands reject edits to canonical
mirrors. Drafts and accepted-mail snapshots retain their original content;
archiving keeps referenced template rows and never deletes logs.

The ten formal templates are Interview Invite, Interview Schedule, Offer Letter,
Accepted, Rejected, In Progress, Application Rejection, Interview Rejection,
Offer Withdrawal and Offer Declined Acknowledgement. Schedule uses actual meeting
details; Offer uses approved salary, currency, start date and response deadline.
Missing facts block rendering; preview uses labelled business placeholders.

Stage-specific rejections require the recorded source stage. Declined
acknowledgement requires an actual `Declined` offer. A complete candidate
offer-decline action has not been established in the integrated applicant UI;
the template remains unavailable without that record.

## Verified state on 21 October 2026

Dev and `jrs_team` were backed up before additive migrations 9 and 10. Both now
have schema 10; all 52 existing table row counts were retained. Shared runtime
DML privileges and verified TLS were checked. Each target has ten active formal
templates. Nine exact local JRS seeds and five exact old shared native seeds
were archived. Historical log rows were unchanged. Backups remain outside Git.

The user confirmed receipt of the earlier SMTP test. The approved QQ inbox is not
yet registered as a candidate, so full recovery delivery remains pending.
Recruitment-mail automation uses a fake transport and does not prove inbox
delivery. No real recruitment decision email was sent in this continuation.

The HR sign-in intermediate page has been removed. Unauthenticated/expired
sessions redirect to shared sign-in with an allowlisted HR return path. Logout
and ordinary HR login retain the Dashboard default. Creation/reset passwords
need at least eight ASCII characters with uppercase, lowercase and a digit;
symbols are optional. Safe bcrypt input limits remain enforced. Existing login
passwords do not inherit creation-strength rules.

The teacher's original Word feedback was read. Navigation naming, parent paths,
publication/deadline semantics, editable assessment criteria and local 100-job
examples have implementation coverage. Applicant department relevance,
interviewer placement and cross-role visual consistency still require review.
No browser visual acceptance was performed in this continuation; DOM/HTTP checks
are separate evidence.
