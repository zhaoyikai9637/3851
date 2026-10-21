# Login UI synchronization - 21 October 2026

Source: `team-files`, commit `e585ca4d4173a3769b52eee210898d473f21a778` by Chenjun Zheng.

Synchronized the login HTML, script and new scoped login stylesheet into the integrated project and active local project. The original two-circle JRS wordmark is retained. The incoming interface includes password visibility, registration mode, inline validation, accessible feedback and responsive form styling.

Integration adaptation: retain the integrated project's feature-gated applicant return path and HR destination. Continue using the shared same-origin API and cookie/CSRF client. No authentication backend, role, database, profile page or recovery service was replaced by this UI update.

Regression coverage exercises the real HTML and script: invalid input blocks submission, the first invalid field receives focus, password visibility resets on registration, registration preserves password whitespace, and safe role-specific redirects remain intact.

Verification: 52 root tests and 69 login-module tests passed. English-only checks passed. The active local server on port 3100 returned the new login HTML and stylesheet successfully. Browser visual acceptance remains pending because browser control reported that local browser use was disabled in Work settings.

Other files in the same source upload include profile management and description validation. They were not silently included in this login-only synchronization and remain subject to the ongoing profile integration review.

## Compact sign-in and password policy follow-up

The user's form reference replaces the large bordered card with a compact sign-in surface, email/lock field icons and a restrained blue primary action. The original JRS wordmark and existing routes are preserved. Registration uses the same form density and exposes its password requirements before submission.

Password entry always starts masked. The SVG crossed-eye attribute now changes with the input type, accessible name and pressed state. Switching in either direction between registration and login, successful registration and page restoration all return to masked entry. A scoped Edge native-reveal override avoids a duplicate browser eye without disabling autofill, paste or password managers.

The explicit project policy for newly registered or reset passwords is 8-72 printable ASCII characters, including lowercase and uppercase English letters, a digit and a punctuation symbol. Spaces may be retained but do not count as symbols; values are never trimmed. Browser and server use the same policy module. Existing accounts can still authenticate with their original valid credentials, including non-ASCII passwords. Invalid reset passwords do not consume the reset credential.

This composition restriction is a user-selected product rule, not a claim of compliance with current NIST password guidance. NIST SP 800-63B-4 advises against composition requirements and recommends broader character support: https://pages.nist.gov/800-63-4/sp800-63b.html . No claim is made that banning Unicode improves password security.

Automated acceptance includes password visibility/icon state, page restoration, all missing character classes, non-ASCII/control characters, invalid lengths, creation/reset endpoint enforcement, legacy login and unchanged password whitespace. The isolated staged publication snapshot passed 56 root tests, 69 login-module tests and English-only validation. The restarted active local service returned the new login page and policy script and refused an invalid registration before account creation. Actual Edge visual acceptance remains pending while local browser control is disabled.
