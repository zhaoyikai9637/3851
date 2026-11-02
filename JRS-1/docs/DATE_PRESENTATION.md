# Shared date presentation

Updated 2026-10-28 at the owner's request. Full dates displayed or entered by users
use DD MM YYYY, for example 28 10 2026. This supersedes the ISO presentation
introduced in the HR 2.6.2 integration. Calendar month/year navigation remains
English; relative Today/Yesterday labels and time displays remain appropriate.

Scope: native HR lists, dashboard, reviews, interviews, offers and activity dates;
React job lists/details/editing, notifications and mail history; applicant closing,
upload, submission and update dates; and new interview/offer mail draft values.
Existing documents, user-authored prose, sent mail and historical records are not
rewritten. Partial month/year experience and education values retain their actual
precision. ISO date/time strings remain the API, export and storage contract.

The React/applicant views share shared/date-format.mjs in jrs-hr-module. Date input
parsing rejects impossible days and incorrect separators; the native date control
mirrors validated display input into an ISO hidden field. Filters and FormData
therefore keep the original API contract, inclusive bounds and calendar limits.
Singapore time determines the visible day for timestamps, including UTC rollover.

Verification: root 130, React 129, native HR 125, server/API 183, dedicated MySQL 12,
default integration 2 and experimental integration 2 tests passed. Both client
production builds passed; the existing 657 kB applicant bundle warning remains.
English source/document checking passed. Local database connection failures were
resolved by restarting its existing process before rerunning the integration tests;
no database initialization, schema changes, business-data reset or real email.

External Edge verified native date filtering (19 10 2026 yields its matching record),
job deadline display (31 01 2031), job editing and calendar selection. Forms were
cancelled without saving. Existing public experimental vacancies have no closing
dates, so their date labels are covered by the shared formatter regression checks
and production build rather than a new live fixture. The legacy applicant entry
was observed to hand off to shared sign-in for the HR account.
