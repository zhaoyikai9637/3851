# Jest Unit Test Report

- Executed: Wednesday, 7 October 2026 at 10:07:17 (Asia/Hong_Kong)
- Environment: Node v24.16.0; Jest 30.5.1
- Command: `npm.cmd run test:jest` (from the project root)
- Result: PASS; suites: 5; tests: 65; passed: 65; failed: 0.

## Scope

- `server/src/validation.js`: email-template variables, profile fields, IDs, historical dates, and query filters.
- `server/src/database-safety.js`: dedicated-database write restrictions and migration-target inspection, using an in-memory database double.
- `server/src/mailer.js`: offline-preview default and explicit SMTP authorization; no SMTP connection is made.
- `server/src/cloud-sync.js`: read-only transaction, authentication-record exclusion, rollback and export size limit, with a strict driver double.
- `server/src/original-content.js`: valid original templates, repeatable installation and active HR requirement, with in-memory model doubles.
- Shared type extension and unknown-type API contracts are checked separately; they are not frontend/browser tests.

## Coverage (the five source files above only)

| Metric | Coverage |
|---|---:|
| Statements | 95.07% |
| Branches | 87.91% |
| Functions | 92.3% |
| Lines | 95.07% |

## Test Cases

| Test file | Test case | Result |
|---|---|---|
| server/jest-tests/validation.test.js | email template validation renders the four approved placeholders as plain text without recursive substitution | Pass |
| server/jest-tests/validation.test.js | email template validation rejects unsupported or missing placeholder [Unknown] | Pass |
| server/jest-tests/validation.test.js | email template validation rejects unsupported or missing placeholder [CandidateName] | Pass |
| server/jest-tests/validation.test.js | email template validation trims allowed template fields | Pass |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 0 | Pass |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 1 | Pass |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 2 | Pass |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 3 | Pass |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 4 | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation normalizes only editable profile fields | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field email | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field employeeId | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field role | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field accountStatus | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field profilePhotoUrl | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field userId | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID 0 | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID -1 | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID 1.5 | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID 2147483648 | Pass |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID not-a-number | Pass |
| server/jest-tests/validation.test.js | historical date filters uses the UTC+08 calendar-day boundary | Pass |
| server/jest-tests/validation.test.js | historical date filters supplies bounded notification pagination defaults | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 0 | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 1 | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 2 | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 3 | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 4 | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 5 | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 6 | Pass |
| server/jest-tests/validation.test.js | historical date filters accepts only SENT as a log status filter | Pass |
| server/jest-tests/validation.test.js | historical date filters rejects future dates on the log path too | Pass |
| server/jest-tests/safety.test.js | database write safeguards accepts an explicitly confirmed dedicated test database | Pass |
| server/jest-tests/safety.test.js | database write safeguards accepts team runtime access without migration confirmation flags | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 0 | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 1 | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 2 | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 3 | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 4 | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 5 | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 6 | Pass |
| server/jest-tests/safety.test.js | database write safeguards normalizes table names from driver-returned shapes | Pass |
| server/jest-tests/safety.test.js | database write safeguards rejects unrelated tables before any migration query | Pass |
| server/jest-tests/safety.test.js | database write safeguards refuses existing module tables without migration history | Pass |
| server/jest-tests/safety.test.js | database write safeguards accepts a complete recognized migration state | Pass |
| server/jest-tests/safety.test.js | mailer safety defaults uses offline preview with no mail credentials | Pass |
| server/jest-tests/safety.test.js | mailer safety defaults requires an explicit SMTP allow flag | Pass |
| server/jest-tests/cloud-sync.test.js | read-only cloud inspection excludes account records from an empty business snapshot | Pass |
| server/jest-tests/cloud-sync.test.js | read-only cloud inspection captures allowed business content without modifying rows | Pass |
| server/jest-tests/cloud-sync.test.js | read-only cloud inspection rolls back when the driver fails | Pass |
| server/jest-tests/cloud-sync.test.js | read-only cloud inspection refuses oversized snapshots before exporting records | Pass |
| server/jest-tests/original-content.test.js | original content installation validates and renders JRS — Interview invitation using the supported variables | Pass |
| server/jest-tests/original-content.test.js | original content installation validates and renders JRS — Offer review using the supported variables | Pass |
| server/jest-tests/original-content.test.js | original content installation validates and renders JRS — Acceptance recorded using the supported variables | Pass |
| server/jest-tests/original-content.test.js | original content installation validates and renders JRS — Application outcome using the supported variables | Pass |
| server/jest-tests/original-content.test.js | original content installation validates and renders JRS — Review in progress using the supported variables | Pass |
| server/jest-tests/original-content.test.js | original content installation retains owner edits and avoids duplicate rows on repeated installation | Pass |
| server/jest-tests/original-content.test.js | original content installation rejects a missing or inactive HR profile: null | Pass |
| server/jest-tests/original-content.test.js | original content installation rejects a missing or inactive HR profile: {"accountStatus":"DISABLED"} | Pass |
| server/jest-tests/template-types.test.js | shared template types accepts a type added only to the shared registry | Pass |
| server/jest-tests/template-types.test.js | shared template types accepts the added type in the API request schema | Pass |
| server/jest-tests/template-types.test.js | shared template types rejects unsupported type FUTURE_WORKFLOW | Pass |
| server/jest-tests/template-types.test.js | shared template types rejects unsupported type toString | Pass |
| server/jest-tests/template-types.test.js | shared template types rejects unsupported type  | Pass |
| server/jest-tests/template-types.test.js | shared template types allows reading an unknown stored code without allowing it on writes | Pass |

## Limitations

- These Jest unit tests do not measure whole-project coverage or verify real MySQL queries, team sign-in, browser interactions, or email delivery.
- The existing Vitest frontend/backend suites and dedicated MySQL integration suite remain separate. Run `npm.cmd test` and `npm.cmd run test:mysql` for those checks.
- Unit tests use isolated inputs; they do not write to a database or send email to candidates.
