# Login UI synchronization - 21 October 2026

Source: `team-files`, commit `e585ca4d4173a3769b52eee210898d473f21a778` by Chenjun Zheng.

Synchronized the login HTML, script and new scoped login stylesheet into the integrated project and active local project. The original two-circle JRS wordmark is retained. The incoming interface includes password visibility, registration mode, inline validation, accessible feedback and responsive form styling.

Integration adaptation: retain the integrated project's feature-gated applicant return path and HR destination. Continue using the shared same-origin API and cookie/CSRF client. No authentication backend, role, database, profile page or recovery service was replaced by this UI update.

Regression coverage exercises the real HTML and script: invalid input blocks submission, the first invalid field receives focus, password visibility resets on registration, registration preserves password whitespace, and safe role-specific redirects remain intact.

Verification: 52 root tests and 69 login-module tests passed. English-only checks passed. The active local server on port 3100 returned the new login HTML and stylesheet successfully. Browser visual acceptance remains pending because browser control reported that local browser use was disabled in Work settings.

Other files in the same source upload include profile management and description validation. They were not silently included in this login-only synchronization and remain subject to the ongoing profile integration review.
