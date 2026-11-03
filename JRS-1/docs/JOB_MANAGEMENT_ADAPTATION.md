# Job management teacher-review adaptation

Date: 2026-11-03

The teammate folder was reviewed as a standalone reference. Its SQLite database,
unauthenticated endpoints, hard-coded identity and independent interview workflow
are not imported. The existing integrated MySQL services remain authoritative.

## Changes

- Keep the full-page job editor and route Dashboard create/edit shortcuts to it.
- Remove Work arrangement and Unpublish date controls and read-only labels in HR job details.
- Preserve each existing job's hidden work mode. Retain historical publication-window
  records and legacy API scheduling behavior; do not clear existing data or alter schemas.
- The current editor omits the retired date from writes. Its date validation checks only
  the visible publish date and application deadline. Legacy API clients retain their
  original date contract and explicit updates.
- Add Save draft, Publish job and Save & publish while retaining Save job, recruitment
  closure/reopening, revision checks, idempotency keys and shared CSRF protection.
- Render description paragraphs and requirements as semantic bullet lists in HR and
  applicant job details. Keep original stored text and escape it through React rendering.
- Keep the current sidebar, shared identity, candidate profile and My Resume designs.

## Validation

Integrated Node tests: 175 passed. HR React tests: 133 passed; final job-editor focused
suite: 19 passed. HR backend/API tests: 183 passed. Native HR tests: 125 passed.
Production frontend builds passed.

Isolated Aiven QA acceptance exercised draft creation, publication, duplicate suppression,
CSRF denial, stale-revision rejection, hidden metadata preservation, applicant visibility
and closure. The complete resume/application/interview/withdrawal assertions completed.
The idle admin connection expired during final cleanup; a fresh verified TLS connection
locked the test account. A separate read-only final audit verified persisted closure,
withdrawal, cancelled interview, removal of pending mail drafts and temporary HR accounts.
No production test data, schema migration or real email was part of this acceptance.

Browser acceptance records desktop/mobile layout and both role-detail bullet lists.
Browser save requests are intercepted; actual persistence is verified in isolated QA.
Original JRS and the teammate archive in the repository remain unchanged.
