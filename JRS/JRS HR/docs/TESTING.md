# HR Testing

Run npm test for database-independent Node tests in this module.
Use package.json for the branch's available integration and smoke-test commands.
Integration tests require an explicitly isolated local MySQL target; never point them at the shared cloud service.

Verify authentication and role denial, CSRF, revisions, idempotency, transaction rollback,
interview conflicts, feedback timing, manager approval, mail snapshots and retention boundaries.
Use fictional data and keep real SMTP disabled. Mock provider success is not evidence of inbox delivery.

The integrated main project also tests the shared session and preserves the original HR UI.
Its default workflow must not expose the unfinished applicant module.
Record fresh command output before claiming a checkout passes.
Historical screenshots and counts are not acceptance evidence for a changed branch.


## Integrated 2.6.2 update

See [SIMPLE_WORKFLOW_v2.6.md](SIMPLE_WORKFLOW_v2.6.md). The combined
`move-interview` command now requires date, time, interviewer and location, with
duration and format supplied by the form. Stage, appointment and optional draft
are saved atomically. Closed jobs block progression. ISO date values and trusted
shared sessions remain mandatory. No schema or existing business row is reset.
