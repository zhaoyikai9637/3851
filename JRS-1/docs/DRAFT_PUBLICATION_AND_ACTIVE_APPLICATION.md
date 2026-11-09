# Draft publication and active-application notice follow-up

Date: 2026-11-09

## Scope

Apply only the approved workflow follow-ups. Keep visitor authentication routing, Interview Results/Offer summary queues, the current profile, Review & Submit step label, and the removed Hired workflow unchanged.

## Behavior

- New job Save still creates a Draft; editing preserves the existing state. Saved draft details now show Publish posting and a clear draft notice. The existing status endpoint activates the posting only after confirmation. Publication dates continue to control public visibility. Existing Close/Reopen actions and revision/CSRF rules are retained.
- Restore the desktop JRS active-application notice on the signed-in job list and open role details. Disable application entry while an application is active, and show the same notice instead of the form when a direct application URL is opened. View status opens the existing status page. Browsing remains available.
- The application check mirrors backend closed statuses: Withdrawn, Rejected and Accepted allow another submission. Lookup failure follows the reference behavior (browsing is not blocked); the existing server remains authoritative at submission. No backend eligibility rules were changed.
- Remove obsolete offer-acceptance instructions and the leftover retired acceptance button/action in the native fallback. Approval, offer editing, email sending and existing history remain available. Hired is not restored.

## Verification

- HR/applicant frontend controls: 207/207 Vitest cases passed.
- Integrated Node checks: 236/236 passed.
- Recruiting backend/API and native UI: 132/132 passed. The old acceptance-button assertion was updated to verify its absence and retain the expired-offer email guard.
- HR communication backend/API: 183/183 passed.
- Applicant validation/API: 26/26 passed.
- Total: 784 unit/API cases passed. Both Vite production builds passed; the applicant build retains the pre-existing chunk-size advisory.
- English check passed with zero issues.
- Isolated local MySQL review: registration/recovery, roles, protected resumes, immutable/current profile separation, application submission, scheduling and withdrawal passed.
- Headless Microsoft Edge at 1440 and 390 pixels confirmed real SQL Draft storage, explicit publishing, public job visibility, applicant registration/submission, the early active notice, disabled role action, direct form blocking, backend duplicate rejection, and restored form entry after withdrawal. No page errors or horizontal document overflow were observed.

Private evidence and backups: .local/flow-followups-20261109. Test records were written only to the owned jrs_review_local database, no real messages were sent. No production records, schema, cloud variables or Render deployment were changed.
