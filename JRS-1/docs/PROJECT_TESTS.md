# Project test entry point

Run commands from the integrated JRS-1 root with Node.js 24. Install once with npm ci.

    npm test

This runs the unit and API test suites of all six active integrated areas, in sequence:

| Suite ID | Area | Runner |
| --- | --- | --- |
| integrated | Shared integration, adapters, security and UI contracts | Node Test |
| login-profile | Login, registration, recovery, profile and validation | Jest |
| applicant | Applicant API, fields, resumes and applications with demo data | Node Test / Supertest |
| recruiting | HR recruitment workflow, API, mail and browser view contracts | Node Test |
| hr-client | HR React pages and controls | Vitest / React Testing Library |
| hr-server | HR communication backend, permissions and APIs | Vitest / Supertest |

The HR suites use one thread worker and login/profile uses Jest in-band so one project command does not start several large test pools concurrently. Root and recruiting Node tests use at most two file workers. A failed suite does not stop the remaining suites; the final process exits with code 1 if any suite fails or its required report is missing.

## Commands

    npm run test:unit
    npm run test:all
    npm run test:root
    npm test -- --list
    npm test -- --suite login-profile

npm test and test:unit are equivalent. test:all additionally builds both React frontends and runs the English source check. test:root preserves the previous root-only test entry. --list shows the selected areas without running tests. --suite accepts any ID in the table and is useful when fixing a reported failure.

## Results

Each run creates .local/test-results/run-*/summary.md and summary.json, plus one log per suite and Jest/Vitest JSON reports. .local/test-results/latest.json points to the latest run. Reports contain pass/fail counts, duration, exit status and failure details. A progress message is printed every 30 seconds while a suite is running. Old reports are retained. Generated reports are ignored by Git and should be redacted before sharing.

## Database and browser boundaries

The default command does not run MySQL integration files, migrations, seeds, production health checks or real email delivery. It excludes inherited database/mail/storage credentials from child test environments. Applicant API tests use their existing in-memory demo data. Archived integration copies are not treated as additional active modules.

For the separate real-database applicant/HR smoke test, follow LOCAL_REVIEW.md, then run:

    npm run review:setup
    npm run review:verify
    npm run review:stop

That smoke test writes only to the independent local review database. A unit/API pass does not prove every source line is covered or replace the manual browser checklist in REVIEW_CHECKLIST.md. Real email delivery, deployed cloud latency and visual browser acceptance remain separate checks.

When reviewing a downloaded ZIP, the English checker scans source directly without requiring .git. It omits local environment files, uploads, reports and generated frontend output. Checking a specific Git ref still requires Git history; it never silently substitutes another version.

## Verified run (3 November 2026)

npm run test:all passed all eight groups from a downloaded-source-style directory without .git: integrated 203, login/profile 69, applicant API 26, recruiting 125, HR React client 136 and HR communication backend 183 (742 tests total), plus both frontend production builds and the English scan. The runner contract tests also verify that one failed suite does not prevent later suites from running and the combined result remains failed. review:verify separately passed against the isolated local MySQL review database. No production database or real mail service was used.

Login/profile uses testEnvironmentOptions.globalsCleanup=off for compatibility between Jest 30 and manually created JSDOM VM windows. Windows are still closed by their test cleanup hooks.

Candidate visibility/ownership tests cover registration-only hiding, read-only applicant data, manual-candidate capabilities and actual candidate-view controls. The local MySQL workflow additionally validates legacy mappings and direct API enforcement.
