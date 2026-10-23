# Shen Junye HR 2.6.2 integration - 2026-10-23

## Source and outcome

Integrated Shen Junye's commit d575deeabc88c8258ad7832750e501d782faa757
(2026-10-22, Add files via upload) into the shared JRS application. The upload
is retained in Git history. Its teacher-review workflow is the current baseline.

## Adopted behavior and removals

- Pending Review is the canonical status and applications/pending-review route.
  The old applications-review route redirects. One Applications navigation item
  and a status select replace stage navigation tabs.
- Move to Interview validates and saves the stage transition and appointment in
  one transaction. Date, time, venue/meeting link and interviewer start blank.
  Duration and format remain under More options; notification prepares a draft.
- Review/results no longer show Back to list, Previous/Next applicant, Applicant
  details, Activity, View profile or View activity shortcuts. The rejection
  dialog no longer shows the status-transition diagram.
- Saves remain on the current page with a toast. Removed success-page, results,
  interviews and outbox redirects are not reinstated. The removed outbox route
  resolves to Applications; application-scoped mail still uses shared templates.
- The old date-inputs.js wrapper is deleted. Native and React job editing use
  YYYY-MM-DD. The native calendar has English labels.
- New job commands offer Active, Draft and Closed only. Closed blocks intake and
  progression. Historical Stopped records remain readable and display as Closed;
  no records were rewritten. Job requirements remain human-written; no automated
  academic eligibility gate is introduced.

## Shared application compatibility

The standalone upload had replaced integration points. Restored shared identity,
CSRF/API routing, canonical templates, mail actor audit fields and sandbox recipient
checks, submitted-resume access, configurable interview assessments, responsive
host pagination and the existing shared UI stylesheet. These are total-project
integrations, not a restoration of the removed review shortcuts.

No private environment files, business records, uploads, production settings or
schema were replaced. Runtime originals are backed up under .local/backups before
selected source files are synchronized. Database tests use dedicated local test
schemas. No real email or public deployment was performed.

## Verification

- Integrated root: npm test - 132 passed.
- React client: npm test -- --reporter=json - 129 passed.
- Native HR: npm test - 125 passed.
- Communication server unit/API: npm test - 183 passed.
- Communication MySQL: npm run test:mysql - 12 passed.
- Default integration: npm run test:workflow - 2 passed.
- Experimental applicant integration: npm run test:experimental - 2 passed.
- Root production build passed for both clients. The existing applicant bundle
  size warning remains (657 kB); it does not prevent the build.
- English source/document checks and git diff --check passed.
- Local browser login, pending-review status select, blank combined booking form,
  English calendar and removed review shortcuts verified. Booking was cancelled
  in the browser; successful persistence was tested only in the isolated schema.
  Checked the default narrow viewport and a 1440 x 900 desktop viewport. External
  Edge was not connected to the browser automation tool during this check.

The legacy public applicant presentation and production rollout acceptance remain
outside this sync; this integration is not a claim of public-launch readiness.
