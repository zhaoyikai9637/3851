# HR interface rollout

## Approved scope

The user approved Q9-Q11 on 21 October 2026. Extend the Job Postings pilot across the HR workspace, preserving business capabilities, permissions, manual decisions and data rules. Applicant and login redesigns are not part of this release. No new UI framework or schema migration is introduced.

## Page patterns

| Surface | Pattern and purpose |
| --- | --- |
| Dashboard | Linked work queues for reviews, upcoming interviews, unapproved offers and overdue tasks; small actionable tables. |
| Applications | One workspace with All, Review, Interview, Results, Offer, Rejected and Hired stage tabs. One prominent row action and secondary menu. |
| Candidates | Searchable, paginated people table. Names and View open a full profile; returning preserves URL search/page state. People without an application remain readable. |
| Interviews | Table with Upcoming, Awaiting feedback, Completed and All shortcuts, search/status/date filters. No calendar scheduling view. |
| Job Postings | Existing table and guarded detail/edit drawer pilot retained. |
| Notifications | Message feed with the shared compact heading, controls and historical date filters. |
| Email Templates | Scrollable list and editor split, variable controls and existing unsaved-change guards. |
| Notification Log | Sent-email table with immutable detail drawer, filters, pagination and attachments. |
| Reports | Existing useful overview, performance/task sections and export, with shared compact styling. |
| HR profile | Existing profile/edit cards with shared compact title, control and action styling. |

Simple task forms use one drawer. Resume review and complete candidate details retain wide task views. Long feedback/Offer forms use one workspace-sized grouped task surface rather than stacked drawers. These native dialog surfaces are not a new URL-routing implementation. Necessary confirmations, busy states and validation remain.

## Navigation acceptance

Three clicks is a priority for typical viewing paths, not a limit on typing, validation, paging or required decision confirmations.

| Start | Typical destination | Navigation clicks |
| --- | --- | --- |
| Dashboard review queue | Application queue, then resume review | 2 |
| Dashboard upcoming interview | Interview details | 1 |
| Sidebar Candidates | Person profile from the visible table | 2 |
| Sidebar Applications | Desired stage, then primary review action | 3 |
| Sidebar Notifications | Templates or Log section | 2 |
| Log section | Sent-email detail | 1 additional |

Cross-module links use explicit intent, route allowlists and same-origin/source checks. Passive iframe load/hash messages cannot bounce the current route back to Dashboard. Candidate profiles use Candidates as their parent when opened from that list. Ordinary workflow transitions update or return to the relevant queue, not a new success page. The legacy success route remains readable for compatibility.

Candidates uses the existing server q/page/limit contract, so records after the first 100 are no longer hidden. The endpoint still filters/paginates its workspace collection in memory; this release does not claim database-level pagination optimization.

## English dates

React job fields, historical notification/log filters and embedded HR date controls support day, month and decade/year modes. Select a year to return to months, then a month to return to days. Only selecting a day commits the date. Inputs display DD/MM/YYYY, API/form values remain ISO, and existing required/disabled/min/max/no-future constraints are preserved. UTC+08 determines the initial business month. Existing human-readable table timestamps may still use an English month abbreviation.

## Verification

- Frontend: 113 passing Vitest tests, including calendar navigation/bounds, UTC+08 month boundary, candidates beyond 100, preserved search/page, candidate breadcrumb and iframe intent regressions.
- Backend/API: 183 passing tests; isolated HR MySQL: 12.
- Native recruitment: 111 passing tests; Jest validation/safety: 73.
- Integrated root tests: 34; local demo MySQL: 3; default workflow MySQL: 2; experimental workflow MySQL: 2. Total: 533.
- Production build and English-only repository validation passed (zero language issues).
- External Edge checks covered desktop and 390px layouts, dashboard/application navigation, candidate lookup/profile return, interview shortcuts, English month/year selection and communication pages. Real sent-email detail was tested with unit fixtures because local sent history is empty.
- Browser checks were read-only. No hiring decision, real email, cloud write, reseed or private data publication occurred.

Useful commands:

```powershell
npm run test -w client
npm run test -w server
npm run test:mysql
# Above commands run from jrs-hr-module.
# Below commands run from the integrated JRS root:
npm test
npm run build
npm run check:english
npm run test:workflow
npm run test:experimental
node --test --test-concurrency=1 tests/demo-data.mysql.mjs tests/demo-enrichment.mysql.mjs
# Native recruitment:
# Run npm test from JRS HR, followed by:
node --experimental-vm-modules ../node_modules/jest/bin/jest.js --config ../jrs-hr-module/server/jest.config.cjs --runInBand
```

## Waiting queue

1. Applicant information synchronization: inspect identity/profile/application ownership and authoritative fields before implementing changes; verify candidate-owned reads/writes and avoid duplicate identities. No cloud overwrite or bidirectional conflict policy is assumed.
2. Applicant visual consistency and shared English dates after synchronization scope is confirmed.
3. Login/profile entry visual consistency while retaining existing authentication, roles, sessions and password-reset rules.

These items are recorded only; no applicant/login redesign or synchronization implementation was performed in this phase.
