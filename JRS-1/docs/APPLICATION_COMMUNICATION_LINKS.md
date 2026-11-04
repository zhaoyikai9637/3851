# Connected application and communication workflow

## Behavior - 4 November 2026

Applications, Notifications, Templates and Logs now share an explicit application context.

- The Candidate emails section of an application links to that application's Notifications, Templates and Logs, alongside New email.
- A notification summary links to the full application, a new email, eligible templates, related notifications and sent emails. The summary remains read-only; processing continues in Applications.
- A context strip shows candidate, position and current status, with links between all four modules. Notifications and Logs are filtered by the same canonical application ID.
- Templates opened from an application list only templates eligible for its current status. Use selected template returns to that same application, opens Candidate Message and fills the chosen template. It does not send anything automatically.
- Sent email details link back to the original application, its notifications and templates, or a new email. Existing immutable email snapshots remain unchanged.
- Notification mark-all-read within application context affects only that application's owned unread records. Clearing ordinary filters keeps the application context. Global sidebar/header links still open the complete owned lists.

## Mapping and authorization

Authenticated GET /api/hr/applications/:id/communication-context resolves a canonical application ID. Authenticated GET /recruitment/api/hr/applications/:id/communication-context resolves a native recruitment ID. Both read the explicit JRS_HR_APPLICATION_LINK and return the corresponding IDs, candidate/position labels, current stage and eligible shared template IDs. Missing or invalid mappings return a clear error; IDs are never guessed from names or list positions.

The existing shared HR session and native workspace access policy protect the context lookup. Notification listing and counts retain recipient ownership; Logs retain sender ownership and SENT-only history. applicationId is a validated optional positive integer filter in both APIs. Recipient assignment is unchanged: these links do not broadcast one HR account's notifications or logs to another account.

Only trusted same-origin messages from the current embedded frame can request a communication navigation. Only the explicit Notifications/Templates/Logs destinations and a numeric application query are accepted. Compose intent is sent once after the application frame reports readiness; the child verifies the sender, current application route and template eligibility, then calls the existing protected preview API. No new send shortcut bypasses preview, draft saving, CSRF, revision checks or the explicit Send Email confirmation.

No database schema migration or production data change is needed. No cloud settings or real emails were changed by this implementation.

## Repeated document previews

Rapid application rerenders now coalesce extraction of identical DOCX bytes. Successful text can be reused for 30 seconds in a content-hash cache capped at four entries and 2 MiB total. The existing two-worker, ZIP, size, timeout, memory and HTML sandbox limits remain. Every request still authenticates the HR user, verifies the application/file relationship and reads the private file before using extracted text. HTTP responses remain no-store and the original download is unchanged. A cold-document six-request regression and the complete desktop/mobile journey verified this behavior.

## Verification

- Complete project command node scripts/test-project.mjs --all passed 784/784 tests: 233 integrated, 69 login/profile, 26 applicant, 132 recruiting, 141 HR client and 183 HR server. Both production builds and English scan passed.
- Final summary/detail link additions passed four focused React cases after the complete run; the final source was rebuilt and checked for English content.
- Real isolated MySQL: native and canonical context mapping agreed; candidate and anonymous access were denied; notification and log lists contained only the target application; scoped read-all preserved other applications; captured send appeared in native and canonical histories without duplicate delivery.
- Edge at 1440 px and 390 px: Application > Notifications > Templates > prefilled Candidate Message > save draft > preview/send to local capture > Logs > original Application > notification summary > same Application all worked, with no page errors or horizontal overflow.
- An earlier run exposed native Windows test-process exits in two unrelated root files and two compatibility failures. The final complete run above passed after preserving the unscoped API call shape and removing unnecessary inactive-load state updates. No assertion, timeout or test was disabled.

Private verification artifacts remain under .local/communication-links-20261104. Source synchronization does not deploy Render. Deploy the latest JRS-1 revision to make these links available online.
