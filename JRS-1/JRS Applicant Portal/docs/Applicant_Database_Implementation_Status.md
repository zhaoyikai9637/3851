# Applicant Database Implementation Status

Date: 2026-10-19
Owner: Si Huanjia

## Scope

The SQL migration at `server/migrations/002-applicant-module.sql` defines ten applicant-owned tables linked to the existing shared entities. It remains a proposal until the schema coordinator reviews and applies it.

| Website function | Database storage |
| --- | --- |
| Search and view company roles | JOB_POSITION and APPLICANT_JOB_DETAILS |
| Role-specific requirements and questions | APPLICANT_ROLE_QUESTION |
| Contact details and future recruitment consent | APPLICANT_PROFILE |
| School, qualification and graduation years | APPLICANT_EDUCATION |
| Separate reading and writing proficiency | APPLICANT_LANGUAGE |
| Upload and manage multiple resumes | APPLICANT_RESUME |
| Submit and track an application | APPLICATION and APPLICANT_APPLICATION_DETAILS |
| Detailed employment history and achievements | APPLICANT_WORK_EXPERIENCE |
| Searchable work skills | APPLICANT_WORK_SKILL (one code per experience/skill) |
| Answers tailored to the selected position | APPLICANT_ROLE_ANSWER |

Applicant phone numbers are validated as E.164. Country, state/province and city have separate indexed columns in the proposed shared schema, while the standalone demo model stores a validated three-part JSON tuple. The future shared adapter must map between these representations in one transaction; it does not yet exist.

## Verification and Deployment

- Individual developer account: TLS connection and certificate verification succeeded.
- SHOW GRANTS confirms SELECT, INSERT, UPDATE and DELETE only; CREATE and ALTER are unavailable.
- Migration is prepared but has not been executed or validated by the MySQL DDL parser.
- No existing shared records or schema were changed.
- On 2026-10-19, 24 demo unit/API tests and the frontend build passed. These do not validate the migration or shared database workflow.
- Backend mapping to these new tables is pending migration deployment and login candidate identity integration.

## Apply Once

The schema coordinator should select `jrs_hr_module_dev_team` and execute the SQL migration with a schema-capable account after reviewing the additive table definitions. Do not put migration credentials in the application environment. MySQL CREATE TABLE statements auto-commit; if interrupted, inspect completed tables before resuming.

The normal backend continues using demo mode until table deployment and adapter verification are complete. No automatic sync or seeding is permitted against the shared database.
