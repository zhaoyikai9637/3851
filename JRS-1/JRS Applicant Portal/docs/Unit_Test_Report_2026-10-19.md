# JRS Applicant Portal - Test Results

**Owner:** Si Huanjia (C3543525)
**Date:** 2026-10-19
**Environment:** Node.js test runner, Supertest, isolated in-memory demo data (`DB_MODE=demo`, `NODE_ENV=test`)

| Command | Result |
| --- | --- |
| `npm test` | 24 passed; 0 failed, skipped or cancelled |
| `npm run build` | Passed; non-fatal Vite chunk-size warning |

Automated coverage includes public job access and filtering, session protection, demo authentication handoff, resume upload, one active application, application status, profile updates, education and language validation, employment month parsing/duration, phone E.164 normalization, country/state/city validation, canonical skill codes and role-specific answers.

Browser preview additionally verified country -> state -> city selection and searching/selecting a skill on the application form. A temporary demo resume used to reach the work-experience step was deleted after the check.

These results do **not** prove operation against the shared MySQL database, the team-owned login system, or a production deployment. The proposed applicant migration has not been applied. See `Structured_Applicant_Data_Report.md` for the storage contract and query examples.
