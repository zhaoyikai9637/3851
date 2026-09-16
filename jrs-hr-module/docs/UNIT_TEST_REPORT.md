# Jest Unit Test Report

- Executed: Wednesday, 16 September 2026 at 19:19:50 (Asia/Hong_Kong)
- Environment: Node v24.16.0; Jest 30.5.1
- Command: `npm.cmd run test:jest` (from the project root)
- Result: PASS; suites: 2; tests: 46; passed: 46; failed: 0.

## Scope

- `server/src/validation.js`: email-template variables, profile fields, IDs, historical dates, and query filters.
- `server/src/database-safety.js`: dedicated-database write restrictions and migration-target inspection, using an in-memory database double.
- `server/src/mailer.js`: offline-preview default and explicit SMTP authorization; no SMTP connection is made.

## Coverage (the three source files above only)

| Metric | Coverage |
|---|---:|
| Statements | 92.78% |
| Branches | 86.15% |
| Functions | 90.9% |
| Lines | 92.78% |

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

## Limitations

- These Jest unit tests do not measure whole-project coverage or verify real MySQL queries, team sign-in, browser interactions, or email delivery.
- The existing Vitest frontend/backend suites and dedicated MySQL integration suite remain separate. Run `npm.cmd test` and `npm.cmd run test:mysql` for those checks.
- Tests use fictional inputs only; they do not write to a database or send email to candidates.
