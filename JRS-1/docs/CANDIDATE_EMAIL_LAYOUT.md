# Candidate email and profile layout correction

Date: 2026-11-10

- Keep the existing email heading, group Email Outbox and New email at the right, and retain both original handlers.
- Put each email status/time below its subject with visible spacing. Long subjects can wrap; row actions wrap on narrow screens.
- Remove the duplicate candidate name above the profile card. Keep the original avatar, name, details and action buttons inside the existing layout.
- Preserve candidate ownership permissions: registered applicants remain read-only to HR; HR-created candidates retain their existing Edit Contact Details and Upload Resume actions. No backend, data, mail or permission change.

Verification: 1440px and 390px Edge checks confirmed metadata separation, grouped header actions, one visible candidate name, compose/Outbox navigation, legacy edit/upload dialogs, registered-applicant readonly buttons and no page errors or horizontal overflow. Both frontend builds, English, 132 recruiting unit/API cases, 183 communication backend/API cases and isolated real-MySQL integration verification passed. All 211 HR frontend cases passed (526 related unit/API cases in total). No real emails were sent.

Private evidence: .local/layout-fixes-20261110. Changes target JRS-1 only; original JRS is preserved. Deployment remains a separate manual action.
