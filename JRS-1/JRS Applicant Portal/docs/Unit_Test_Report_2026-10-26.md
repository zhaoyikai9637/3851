# JRS Applicant Portal Unit Test Report

Owner: Si Huanjia C3543525
Date: 26 October 2026
Environment: Node.js test runner, Supertest, isolated demo data using `DB_MODE=demo` and `NODE_ENV=test`

## Results

| Check | Result |
| --- | --- |
| `npm test` | Passed: 26 tests, 0 failed, 0 skipped, 0 cancelled |
| `npm run build` | Passed: production bundle created successfully |
| Local browser workflow | Passed: dynamic skill entry, fixed start-availability options, inline required-question messages, Review edit actions and declaration validation |

## Coverage added for the meeting changes

- Applicant-entered skills are trimmed, validated, case-insensitively deduplicated and limited to 50 entries.
- Unsafe skill text and a list over 50 skills are rejected.
- Start availability is returned as a controlled select question rather than free text.
- Application submission is rejected unless the applicant declaration is accepted.
- The existing application, resume, profile, job-search, location, phone, education, language and employment-date tests continue to pass.

## Notes and limits

The production build reports a non-fatal warning that one JavaScript chunk exceeds 500 kB. It does not prevent the build from completing. Tests run against isolated demo data and do not alter the shared MySQL database. The shared database migration must be applied by a team member with schema privileges before the new skill-name and declaration fields are available in the integrated environment.
