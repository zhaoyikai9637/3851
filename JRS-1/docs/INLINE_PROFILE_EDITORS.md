# Inline profile editors and information labels

Updated 8 November 2026.

## Changes

The applicant Personal Profile page now expands its seven existing editors inside the matching cards: personal details, summary, career history, education, licences/certifications, skills and languages. There is no overlay or modal positioning. Opening another editor closes the previous one; Cancel and Escape close without saving. Save, delete, validation, skill draft handling and existing authenticated API calls remain in place. A failed save retains the entered values and shows an error within the open editor.

The application step, heading and review edit link now use **Personal information**. HR application review and candidate history use **Candidate personal information** for the submitted snapshot. The distinction between current applicant-maintained information and immutable submitted data is unchanged.

A guarded optional DOM access in the legacy HR layout controller keeps its existing lightweight test harness compatible with the previous visual adaptation. It does not change browser business behavior.

## Verification

- Integrated tests: 236/236 with `node --test --test-concurrency=2 tests/*.test.mjs`.
- Login/profile: 69/69 across the isolated test files. A Windows child-process exit interrupted the aggregate rerun after 64 passing cases; the remaining five frontend cases passed separately with `node ../node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/frontend.test.js`.
- Applicant API/validation: 26/26; recruitment workflow/API: 132/132; HR communication backend/API: 183/183.
- HR React: 183/183 with `node ../../node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1`. This rerun resolved an aggregate Windows fork-worker exit; no test was removed or skipped.
- Combined passing test evidence covers 829 cases. The first aggregate run also exposed old drawer assertions and a cross-realm array assertion; these were updated to check actual inline behavior.
- Both production builds and English checks passed.
- `npm run review:verify` passed the isolated real-MySQL workflow. No production database or real email was used.
- Edge at 1440px and 390px verified all seven inline editors, add/edit, save/cancel, persistence after reload, both new labels and submitted information visible to HR. Both runs had zero page errors; the profile had no horizontal overflow.

No schema, authorization, mail configuration, cloud settings or My Resume behavior changed. Source backup and private browser evidence are under `.local/profile-inline-20261108`; they are not published. Render requires a separate manual deployment to show this update online.
