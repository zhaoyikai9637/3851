# Applicant workflow adaptation

Adapted on 2026-10-28 from the owner's Login and profile project.

The shared login UI, password policy, recovery behavior, HR workspace and existing job styling are retained. Profile cards, More/Less descriptions, card/drawer deletion, year selects, direct skill removal, grouped languages, hidden redundant Add language and avatar/name-only profile navigation now follow the owner's implementation. Existing integrated text limits are retained because changing them was outside this selection.

ENABLE_APPLICANT_PORTAL=true enables the stable shared-session applicant adapter. The legacy ENABLE_EXPERIMENTAL_APPLICANT_PORTAL flag remains available as a compatibility fallback; set it to false in production. Existing installations that explicitly disable both flags retain their earlier display boundary. Login's integration-config response retains its legacy property name for compatibility.

The stable adapter reuses schema 12 and existing candidate/job/application links. No JRS_APPLICANT_* tables from the older project are imported. Jobs remain in the existing React design, with database-backed publication and application access. My Resume supports validated PDF/DOC/DOCX upload up to 5 MB, private account-owned downloads and transactional deletion of unused resumes. Files are written under the configured persistent upload directory. Attached resumes are retained with their applications.

Application creation, submitted material snapshots, HR state changes and candidate withdrawal share the existing integration bridge. Withdrawal cancels scheduled interviews and supersedes unsent drafts, and refuses an in-flight send. HR email remains disabled by the existing deployment configuration.

Existing HR vacancies created while applicant mirroring was disabled may lack portal links. Such records need an explicitly reviewed link backfill before they can appear in the live applicant list; server startup does not silently migrate or seed records. The newly prepared production database is empty of business accounts/jobs. Website account provisioning and real job publication remain rollout steps.

## Validation boundary

Unit/UI/API checks and build results are recorded in .local. Real MySQL workflow acceptance must use an isolated test database with fictional accounts and disabled email, never the production database. This change does not deploy Railway or copy historical cloud data.

## Acceptance results (2026-10-28)

All 133 root regression tests pass, including shared-session access controls, profile interaction checks and a regression for null end dates on current employment. Both frontend production builds pass. Browser testing revealed that the existing month picker called split on the null end date of a current role; it now renders an empty disabled end-date selector instead.

Real MySQL acceptance passed in the separate jrs_hr_module_test_applicant_20261028 database using fictional identities and a database-scoped DML account. Verified operations include HR job publication, resume upload/download/deletion, ownership checks, duplicate active application rejection, submitted-resume retention, atomic HR application creation, HR Interview status synchronization, withdrawal with interview cancellation, and shared logout. The test account is locked after each verification session. Production schema and business records were not modified by these tests.

Local evidence remains in the ignored .local/applicant-adaptation directory. Do not commit the test account files or deployment variables. Railway deployment is still pending, and the empty production database still needs approved real identities and vacancies.

Edge browser acceptance also passed against the isolated MySQL database: shared login, summary save/reload, persisted skills/languages, year selectors, desktop/mobile layout, avatar-only profile entry, real job list, and four-step application submit/reload/withdraw/reload. No browser page exceptions remained. Withdrawal now returns the related resume and submitted job snapshot so the status screen updates immediately without losing its role details. The QA database account was locked after the final browser run. See .local/applicant-adaptation/browser-result.json for the recorded checks.

The reviewed release is based on team main 4a4d350 and retains its custom application skills, controlled availability, required declaration and schema 12. The earlier schema-11 acceptance described above belongs to the original local adaptation; the merged release needs its own acceptance. No production migration is run by startup.
