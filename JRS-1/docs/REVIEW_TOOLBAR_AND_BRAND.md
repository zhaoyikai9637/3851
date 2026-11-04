# Review toolbar and shared visual identity

## Review shortcuts
Resume Review and Interview Results now share one right-aligned toolbar: Back to list, Next application and Application details. Back uses the existing originating queue and saved filters/page. Next follows the existing filtered queue order and existing resume/results route helper; the last record has a disabled Next action. The detail action opens a read-only application summary without changing stage or records.

Existing stage-specific redirects, decision handlers, approvals, interview logic and shell route synchronization are retained. This implements the requested toolbar, not the separately deferred workflow/navigation redesign. Profile/Activity shortcuts remain absent from application review.

## Related applicant and HR design
JRS HR/dist/brand.css supplies one font stack, blue/hover colors, ink/muted text, borders, background, control corners and card corners to applicant React pages, the HR React shell and the native recruitment document. Existing button variables also reference these brand values. White content surfaces and the current responsive layouts remain. HR data tables keep their denser scale; applicant forms retain their larger fields. Status colors retain their meaning.

HR account badges format HR_MANAGER/HR_STAFF as HR Manager/HR Officer for display. Role values and authorization are unchanged. Existing login and personal-profile page layouts are retained.

## Teacher decisions
The selectable start-availability question is the teacher-approved solution and requires no new free-text notice-period field. HR account recovery remains administrator-assisted. Company provisioning does not require permanently fixed passwords; account recovery and an authenticated password-change feature are separate policy decisions. This change adds neither an administrator reset interface nor a new password flow.

## Validation and limitations
See HANDOFF.md and PLAN.md for final checks. The browser checks use Edge at 1440px and 390px, real isolated-review identities, originating queue filters, detail open/close and Next navigation. Computed font stack, brand blue and body background match between the two portals. Only fixture data and captured mail are used; no production business writes or real outbound emails are part of this change.

A combined HR frontend test worker exited with Windows status 3221226505 before its JSON report. That failed result is retained. Fresh-process per-file UI verification is a separate run, not a replacement of that failed combined result or proof that the native process instability is resolved.
Final checks: root 217/217, login/profile 69/69, applicant API 26/26, recruiting 126/126 and HR backend 183/183 passed in the combined run. HR React UI passed 138/138 only in the separate fresh-process per-file run; the combined worker failure remains recorded. Both final frontend builds and the isolated real-MySQL reviewer workflow passed. Edge checked both portal themes, actual primary-button colors/fonts, HR job forms, toolbar alignment, read-only details, Next and queue-filter restoration at 1440px/390px, with no page JavaScript errors or horizontal page overflow.
