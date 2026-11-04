# Historical notification repair and execution/performance corrections

## Historical timestamps
Use scripts/repair-notification-times.mjs with an explicit configured database name. The default mode is a read-only preview:

    node scripts/repair-notification-times.mjs --database=jrs_review_local

Set JRS_ENV_FILE to the intended private environment file first. Verify the target and proposed count. To apply the reviewed correction:

    node scripts/repair-notification-times.mjs --database=jrs_review_local --apply

The command compares only imported SYSTEM_NOTIFICATION records with their matching recruiting_system_notification source events. Each expected timestamp is derived from its own timezone-qualified source; impossible or ambiguous source dates are skipped. It does not subtract eight hours from arbitrary records. Application dates, sent email history, read flags and event contents are not modified.

Apply runs in a transaction, locks selected rows, writes an exclusive private JSON backup under .local/notification-time-backups before any update and checks each original timestamp when writing. Failure rolls the transaction back. A second preview should propose zero corrections. Backups contain old/new timestamps and record keys; do not commit them.

The retained reviewer history had 31 exact-source differences and was corrected with a backup. The existing production configuration was inspected read-only: it held 50 jobs and no corresponding notification/source-event records, so no production history was altered.

## Test process stability
The observed Windows failures were native process errors, not failed business assertions. HR Vitest runs in one forked worker process. On Windows only, the HR UI test launcher and worker use --regexp-interpret-all to avoid the observed V8 native RegExp compilation crash while retaining JavaScript and WebAssembly support. Native Node test files run serially and also use RegExp interpretation on Windows, avoiding parallel loading of the large geography dependency. These settings are limited to test commands; server/start/build execution is unchanged.

Login API tests now explicitly start one loopback HTTP listener per test and close it after that test. This avoids repeatedly opening and implicitly closing a temporary Supertest listener per request. Frontend JSDOM is loaded through the native Node loader so its CSS parser does not retain globals from a disposed Jest VM. All 18 API tests and all other module tests remain. There is no automatic retry or ignored native error. Previous failed reports are retained.

## Public access performance
Public job catalogue reads share one pending load and reuse a five-second process-local snapshot. Returned values are cloned so callers cannot mutate shared data. Publication/deadline state is evaluated for every response, including Singapore calendar boundaries. Committed HR writes and publication changes invalidate the catalogue; invalidation prevents an old pending read from repopulating the cache. Failed reads are not cached.

Application submission still reads the authoritative job/publication state inside its write transaction. Authenticated sessions, personal profiles and applications are not cached. External database edits or another server process can take up to five seconds to appear in the public catalogue; this deployment currently has one service instance.

Both Vite frontends serve content-hashed assets with a one-year immutable browser cache. HTML and authenticated/API responses do not receive that immutable policy. Native assets without content hashes retain their existing policy.

Local measured sample: first public job read 345 ms, subsequent reads 2-3 ms. This is a local measurement, not a promise about Aiven/Render network latency. The live service requires a new deployment to use these code changes.

## Render Free limitation
No plan change or background keep-alive traffic is introduced. Render Free can spin down after inactivity; process-local caches start empty after a restart, so the first platform wake-up delay cannot be eliminated by this application cache. See https://render.com/docs/free#spinning-down-on-idle.

## Scope retained
Follow-up: Application Status now uses job-search status wording and explicitly states that HR can still view submitted applications. The underlying availability update and submitted-application policy are unchanged.

Follow-up: notification cards omit the body only if it is empty or repeats the title after trimming outer whitespace. Distinct details remain visible. Stored title/message, source/time, application navigation and read actions remain unchanged. Examples of repeated content include Offer prepared and Interview feedback recorded. The previously deferred review navigation remains unchanged.

Validation on 2026-11-04: node scripts/test-project.mjs --all completed in one run on Node 24.16.0 with all eight groups passing: 756/756 tests, both production frontend builds and the English source scan. Isolated real-MySQL applicant/HR workflow, timestamp equality, immediate publish/close invalidation and hashed-asset cache headers were verified separately. Native-crash and interrupted cross-runtime reports remain private evidence; no failed result was overwritten or retried automatically.

## Copy follow-up validation

The status/repeated-body follow-up passed five focused UI tests, both frontend production builds, Edge desktop/mobile fixture-API checks (1440px/390px) and the isolated real-MySQL applicant/HR workflow. The HR backend completed 182/183 tests with a 10-second timeout in tests/db.test.js certificate-configuration creation/cleanup, including on a separate serial run. No backend configuration, timeout limit or assertion was changed to obtain a pass. This is an unresolved test-execution limitation; the earlier 756-test clean run belongs to the preceding release. No new clean full-project total is claimed. Private interrupted full-root/full-UI logs are retained.

## Database test timeout resolved

The retained certificate-configuration timeout was resolved in a test-only follow-up by preloading the real mysql2 dialect during collection. Focused tests passed 2/2 (115 ms) and the complete HR backend passed 183/183 in one run. The 10-second deadline, assertions, cleanup and all production/TLS configuration remain unchanged. See DATABASE_CONFIG_TEST_TIMING.md. The earlier failures remain historical evidence.
