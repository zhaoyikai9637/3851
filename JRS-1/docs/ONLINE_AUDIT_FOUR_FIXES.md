# Four online audit fixes

Date: 2026-11-09

Scope: preserve the current layout, CSS, profile, application stages, permissions and sending behavior. No database schema or production data changes.

- Same-job history: the existing authenticated application lookup optionally checks a job ID. Role details disable an already-applied role, and a direct application URL shows the existing notice structure before any form is filled. Older history is checked even if another application is more recent. Server submission checks the same rule under the existing workspace lock. A withdrawn/closed application still allows applying for a different role. No application is deleted or silently reopened.
- Performance: canonical synchronization reads five fixed datasets with one UNION under the original transaction/lock. The HR snapshot reads workspace metadata, mapped records, per-user read marks and resume metadata in one statement. User-specific read marks, canonical refresh, revision checks and live authentication remain in place; no personal data or permission cache is added.
- Duration is hidden from React and embedded interview summaries/details/lists; the stored duration remains for end time, collision checks, feedback availability and calendar events.
- Logout copy now says: This will end your session. You can log in again when you are ready.

Verification: isolated local MySQL passed registration/recovery, roles, protected resumes, immutable/current profile separation, application/scheduling/withdrawal synchronization, same-job history including older records, and successful submission to a different role. Edge at 1440 and 390 pixels confirmed early duplicate blocking, other-role entry, duration removal and logout text with no page errors or horizontal overflow. Both frontend builds pass. Final suite results: 236 integrated, 69 login/profile, 26 applicant API, 132 recruiting, 211 HR frontend and 183 HR communication backend cases passed (857 total); both builds and the English check passed. The final HR frontend run used one worker after an unrelated dashboard-message test was intermittent in the parallel run.

Performance comparison on the isolated reviewer database with 100 ms simulated latency per database operation: canonical refresh plus base snapshot decreased from 15 to 8 round trips, 1701 ms to 902 ms; both returned identical workspace data. This is a controlled local measurement, not a claim about Render response times. Deployment and an online retest are still required.

Private test evidence and backups: .local/four-fixes-20261109. No real emails were sent.
