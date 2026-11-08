# HR reference style adaptation - 8 November 2026

## Scope

Adapt the maintained HR interface to the visual reference in the latest desktop JRS folder. Applicant and authentication source files, their shared brand stylesheet, server code, database schema and deployment settings are unchanged. New design tokens are private to the HR shell and embedded HR pages.

The sidebar, Dashboard, Applications, resume review/results, Candidates, Job Postings, Interviews, Reports, communications, HR profile and their editing/business forms use the reference typography, colours, spacing, controls and layout. Applications, candidate details, interviews and reports now render within the React shell; the Dashboard retains the authenticated embedded renderer. Existing job editor deep links remain supported.

## Retained integrated behavior

- Submitted applicants enter HR lists only after submission. Applicant-owned contacts and resumes remain read-only to HR; HR-entered candidates remain editable.
- Candidate details retain full current personal information and immutable submitted snapshots. Protected PDF downloads and sandboxed Word previews use the existing authorized routes.
- Review back/next controls retain queue context. Application identity mapping connects Notifications, eligible Templates, the retained Email Outbox and sent history.
- Rejection still requires one confirmation and prepares an unsent draft. Removed rejection reason screens and Work arrangement controls stay removed.
- Rescheduling starts with blank date/time/venue/interviewer fields. Additional meeting controls remain visible.
- Current-status template rules match the authoritative HR model. Preview requests cannot overwrite a newer selection. Draft sending remains explicit, coalesces concurrent clicks, and checks uncertain results without automatically resending.
- All server authorization, CSRF, revision checks, sessions, role restrictions, Mailjet and private storage behavior remain unchanged.

## Verification

- Six test groups passed: integrated boundaries 233, login/profile 69, applicant API/validation 26, recruitment/API 132, HR React 183, communication backend/API 183: 826 cases in total. HR React evidence comprises the full 181-case run plus two added focused delivery tests.
- The first aggregate run encountered a Windows Node process crash in startup-guard.test.mjs. Its three cases passed individually; the complete integrated group then passed 233/233 with test concurrency limited to 2. No startup guard was removed or weakened.
- Both production builds and English checks passed. The applicant build retains its original output hashes (index-DKTqqSpb.css and index-BEy6hfdL.js).
- Isolated real-MySQL reviewer verification passed registration/reset/session revocation, submission, private resume access, candidate ownership, immutable profile snapshots, scheduling, status synchronization and withdrawal. No production database or real mail was used.
- Edge browser journeys at 1440px and 390px passed rejection, notification creation, eligible template preview, captured sending, sent history and return to the same application. Both had zero page errors or document overflow.
- Reference-data screenshots cover 27 HR pages/forms. Ten main routes at each desktop/mobile width passed layout checks. Applicant/login source hashes and the applicant-used brand.css are unchanged.

Private evidence and pre-change HR source backup are under .local/hr-style-20261108 in the reviewer copy; they are not published. Render has not been redeployed by this change.
