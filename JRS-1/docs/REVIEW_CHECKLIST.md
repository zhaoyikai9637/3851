# Independent review checklist

Start with LOCAL_REVIEW.md. Record the source commit, Node/MySQL versions, browser, command and expected/actual result for each failure. Do not include passwords or reset codes in reports.

## Applicant

- Register and edit a profile without applying; confirm the account is absent from HR workspace/search. After applying, confirm the candidate appears once, with HR profile editing and resume upload unavailable. Confirm direct API attempts are rejected.


- Browse jobs as a guest; search/filter and open details. Confirm skills and description bullets.
- Open login and register. Submit empty/invalid fields, then create a fictional account. Confirm header name and profile access only from the header identity.
- Edit profile, summary, career history, education, certifications, skills and languages. Test current roles with an empty end date, month/year selection, 2000-character limits, edit/delete controls and refresh persistence.
- Upload, download and select a PDF resume. Confirm another account cannot read the private file.
- Apply for a published job. Check mandatory declaration and role questions; confirm submitted materials are retained after editing the current profile.
- Confirm HR interview/offer decisions appear in application status. Test withdrawal on a separate application.
- Reset the password using review:mailbox, then confirm the old session/password and reused reset token are rejected. Log out.

## HR staff and manager

- Receive a manual application; confirm that candidate retains editable contact details and supplemental PDF upload. Withdraw a self-submitted application and confirm its history remains visible.


- Log in with each generated role. Check dashboard, jobs, candidates, applications, interviews, offers and communication pages.
- Create/edit a job and check guest publication. Check draft/closed roles, dates and unchanged applicant submission snapshots.
- Review the applicant's submitted resume and details; schedule/reschedule/cancel an interview. Confirm required date/time/location and conflict validation.
- Record feedback after the appointment. Create an offer, verify staff cannot approve it, approve as manager, send it to the captured mailbox, and record acceptance/decline.
- Test rejection and notification history. Confirm sent bodies are immutable and duplicate sends are prevented.
- Check notification/template/profile controls and logout. Confirm an applicant cannot access HR APIs and HR cannot submit an applicant application.

## Scope of automated review:verify

The supplied smoke test covers registration/login, password code recovery and session revocation, role boundaries, real PDF upload, declaration validation, submission reaching HR, protected submitted resume, interview synchronization and applicant withdrawal. The detailed UI checklist and offer/feedback/email-template branches require manual review or their corresponding module suites; a passing smoke test is not a claim that every workflow branch has been exercised.

## Evidence

Keep local screenshots and .local/review/verification.json with your report. State which checks were actually run. Upload only a redacted report, never .env.review, accounts.json or mailbox.json.

## Code connection map

- scripts/review.mjs and scripts/review/*: isolated setup, fixture creation and lifecycle; these are tooling, not public API routes.
- server/runtime.mjs: assembles the shared login, applicant API, recruiting API and communication workspace into one HTTP server.
- JRS Login and profile/server/api.js and server/services/repository.js: shared registration/login/logout and canonical account/profile persistence.
- server/applicant-portal.mjs and server/applicant-data.mjs: authenticated applicant routes and transactional integration with canonical/recruiting records.
- server/recruitment-bridge.mjs, server/submitted-materials.mjs and server/job-publications.mjs: job/application mappings, immutable submitted documents and public vacancy visibility.
- JRS HR/server/app.cjs, service.cjs and repository.cjs: HR command validation, role restrictions, optimistic revisions, workflow transactions and storage.
- jrs-hr-module/server/src: notification center, email templates, logs and HR profile APIs.

For each write, trace the UI API call to the route, authentication/CSRF checks, validation, transaction and persistence; reload through the opposite role to confirm integration. Use the browser Network tab to record a failing route and HTTP status. Do not paste request cookies, passwords, reset tokens or private resume content into a shared report.

- After applying, edit every personal profile section. In HR Current personal profile, verify the latest values; in Submitted application & history and Resume Review, verify the original values and selected resume. Verify that older applications explicitly identify uncaptured fields.
