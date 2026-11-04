# Database configuration test initialization

## Cause and scope
The certificate-configuration unit test does not authenticate or query a database. Sequelize loads its real MySQL dialect lazily during the first constructor call. The retained failing run spent 11,310 ms in that first case and exceeded the unchanged 10,000 ms deadline; the following local-configuration case took 1 ms.

A separate phase probe measured factory-module loading at 5,338 ms and the first constructor at 3,053 ms, with close and a second constructor effectively immediate. These samples vary with local dependency loading and do not measure Aiven connection latency.

## Correction
The test file now imports the installed mysql2 driver during module collection, before either test case starts. Sequelize still uses that real driver. Both original configuration assertions and finally-based cleanup remain. No driver mock, skipped assertion, retry or extended timeout is used; an import failure still fails the suite.

Application configuration, TLS certificate/hostname verification, credentials, production startup, database schema and deployed behavior are unchanged. This is a test-only fix and does not require redeploying the website.

## Verification
Focused command from jrs-hr-module/server:

    node ../../node_modules/vitest/vitest.mjs run tests/db.test.js --pool=forks --maxWorkers=1

The two focused cases passed in 115 ms in the measured run. Complete HR backend verification is recorded in HANDOFF.md and PLAN.md. Previous failure logs are retained privately; this does not replace them or claim that a real TLS handshake was tested by the configuration unit cases.

The application code is unchanged from the preceding release, whose frontend builds, focused desktop/mobile UI checks and isolated real-MySQL workflow were verified separately. Do not treat this test-only follow-up as a new full-project or cloud acceptance run.