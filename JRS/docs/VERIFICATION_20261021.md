# Integration verification on 21 October 2026

These checks ran on the actual runtime checkout `E:/textProject/JRS` after source
synchronization and dependency installation. The release checkout was also built.
Every listed test command completed successfully in this continuation.

| Location | Command | Passed |
| --- | --- | ---: |
| Root | `npm test` | 103 |
| `jrs-hr-module/client` | `node ../../node_modules/vitest/vitest.mjs run` | 120 |
| `jrs-hr-module/server` | `node ../../node_modules/vitest/vitest.mjs run` | 183 |
| Root | `node --test --test-concurrency=1 tests/*.mysql.mjs` with SMTP disabled by default | 14 |
| `jrs-hr-module/server` | `node ../../node_modules/vitest/vitest.mjs run --config vitest.mysql.config.js` | 12 |
| `JRS Login and profile` | `node --experimental-vm-modules ../node_modules/jest/bin/jest.js --runInBand` | 69 |
| `jrs-hr-module/server` | `node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --config jest.config.cjs --runInBand` | 73 |
| `JRS HR` | `npm test` | 111 |
| `JRS Applicant Portal/server` | `node --test test/*.test.js` | 24 |
| Total | No failures or skipped tests in these full suites | 709 |

`npm run build` succeeded in runtime and release checkouts, building both HR and
applicant clients. The applicant bundle retains Vite's size warning at about
657 kB before gzip. Dependency installation used `npm ci --ignore-scripts`;
existing deprecation/advisory work was not expanded into forced upgrades.

`npm run check:english` inspected 464 files with zero issues at the verification
point. The final documentation additions were checked again before publication.
`git diff --check` found no whitespace errors. Compared changed release files
against runtime copies: zero missing or different files. A scan for actual
private configuration secrets found no matches in publishable project files.

HTTP checks against port 3100 confirmed the current built asset is served, the
old sign-in intermediate heading is absent, redirect code is present, invalid
registration returns `Add at least one uppercase letter.`, and the homepage
redirects to `/jobs`. DOM regressions exercise both button submission and form
submission, password visibility, authenticated/expired/logout routing, deep-link
allowlists, visitor application prompts and business template previews.

Local-only SQL checks cover default/experimental workflows, profile sync,
independent resume identifiers, repeatable additive migrations, mail history,
fake SMTP handoff, controlled imports and seed archival. No destructive tests
ran on the shared cloud. The shared runtime connected with verified TLS using
the restricted DML account; public jobs responded and protected HR access was
denied without authentication. Both dev and shared schema are version 10.

Template maintenance preserved historical log rows in transactions after
private backups. Each target now has ten active formal templates. Exact local
JRS seeds and exact old shared native seeds were archived, with no physical
template or log deletion. Temporary cloud admin material was removed.

The user confirmed the earlier SMTP verification email arrived. The approved
inbox is not registered as a candidate, so recovery inbox acceptance is pending;
real recruitment email receipt also remains pending. No real recruitment mail
was sent by the regression suites. Browser visual verification, cross-role
visual acceptance, hosting deployment and platform operator roles remain open.
See `TEAM_MAIL_OPERATIONS.md` for operational boundaries and import limitations.
