# Verification

## 2026-10-07 template-list scrolling

- Browser red/green check: before the change, the 19-item list had overflow-y visible and equal client/content heights (1548px), so it could not scroll independently. After the CSS change, overflow-y auto and a bounded 432px client height allowed scrolling through 1623px of content.
- Scrolled to the final template and selected it: the editor updated correctly; list scrolling kept the document at scrollY 0 and the editor top unchanged. At 390px, the vertical list was 280px tall with no horizontal document overflow. Reset the viewport afterward; browser errors/warnings: none.
- Private screenshot: `work/template-scroll.png`. No template, database or API behavior changes.
- `npm.cmd test`: 183 backend and 68 frontend tests passed; `npm.cmd run test:mysql`: 12 passed; `npm.cmd run build`: passed.

## 2026-10-07 stage-specific outcome templates

- TDD: all four new types initially failed backend validation and were absent from the UI; after extending the shared registry, backend/API-contract checks and selection/save/reopen tests passed.
- Local installer added nine missing preset templates (four new stage templates and five existing originals) without overwriting the eleven pre-existing rows. Second run: created 0, retained 9. No cloud writes or email sends. One existing inactive template remains excluded from the API list.
- Restarted the owned local API to load the registry. Live development login and logout returned 204; templates returned 200 with all four new types. No browser visual recheck performed.
- GitHub checkout: `npm.cmd test` passed 183 backend and 68 frontend tests; `npm.cmd run test:jest` passed 73 tests (local source: 72), preserving the checkout's additional test. `npm.cmd run test:mysql` passed 12 tests; build, docs:check (24 operations/346 examples) and scoped lint passed. Jest retains its known Node experimental VM Modules warning.
- Automatic stage/decision-owner event routing remains a teammate integration task, not part of this template update.

## 2026-10-07 Jest regression refresh

- Added 18 tests in three new Jest files: type registry extension/API contracts, unknown inputs, read-only cloud export/rollback/size limit, original-template validation, repeatability and active HR requirement.
- Development source: `npm run test:jest` passed 5 suites/64 tests. Five-file statement/line coverage 95.03%, branch 87.5%, function 92.3%.
- GitHub checkout: Jest passed 5 suites/65 tests, preserving the pre-existing team-runtime safeguard test; statement/line 95.07%, branch 87.91%, function 92.3%.
- Generated report lists the actual timestamp, scope, individual cases and limitations. Raw results and coverage remain under ignored `work/`.
- Checkout regression: backend/Supertest 179, frontend 54, isolated real MySQL 12 passed; build and documentation consistency passed.
- No production behavior changed. New tests characterize existing implementations using isolated configuration and database doubles; they do not contact cloud services or send email. Node reports the expected experimental VM Modules warning required by the existing Jest ESM runner.

## 2026-10-07 communication heading alignment

- TDD: two route tests failed on the extra HR WORKSPACE eyebrow before implementation; both pass with page titles, descriptions and template creation action retained.
- Notifications, Templates and Logs reuse global compact heading rules; profile pages are unchanged. No business logic or data changes.
- Real local browser: all three desktop headings measured top 110px, font 28.16px, heading bottom margin 5px and section bottom margin 16px at the default viewport.
- Templates and Logs also inspected at 390px; title/description and action wrap without page-level horizontal overflow. Viewport reset afterward. Private screenshots: `work/title-alignment/`.
- GitHub checkout: backend/Supertest 179, frontend 54, isolated real MySQL 12 passed; build, scoped lint and formatting passed.

## 2026-10-07 template type extensibility

- TDD: extension tests first failed because frontend options, validation and request enums were hardcoded; the unknown-type test exposed the dropdown incorrectly showing the first known option.
- One shared JSON registry now drives all three consumers. Tests inject a future type only within test scope; production still has five types.
- Unknown stored codes are readable, visibly preserved and blocked from saving until explicitly changed to a supported code. Unknown writes remain rejected.
- Development source: server 178 tests, client 52 tests and isolated real MySQL 12 tests passed; production build, scoped lint and documentation contract check passed (24 operations, 346 examples).
- No schema migration, cloud write or mail send. Browser screenshots were not rechecked; RTL covers dropdown selection, warning and save/reopen interactions.
- GitHub checkout: server 179, client 52 and real MySQL 12 passed; build, documentation, scoped lint and formatting passed. Existing extra checkout test preserved. Vite serves the shared registry successfully (HTTP 200).

## 2026-10-07 cloud inspection and directory alignment

- Cloud inspection: verified TLS, read-only transaction, eight business tables empty; zero imports and zero cloud writes. Accounts/sessions excluded from export.
- Original installer: local development database only, first run created 5 templates, second run retained all 5. Existing 5 templates preserved; no mail sent.
- New cloud inspection tests: 3 passed, including rollback and account exclusion.
- New original content tests: 3 passed, including validation, repeatability and missing HR rejection. TDD failures recorded before implementation.
- `npm test`: server 175 passed; client 50 passed (includes Supertest API coverage).
- `npm run test:mysql`: 12 passed on the dedicated local test database.
- `npm run build`: passed, 62 modules transformed.
- `npm run lint` and `npm run format:check`: passed (scoped notification checks).
- `npm run docs:check`: passed, 24 operations and 346 examples.
- This change relocates page/CSS files without changing rendered UI; no new browser visual verification was performed. Team authentication and full team integration remain unverified.
- GitHub checkout verification: server 176, client 50 and real MySQL 12 passed; build, docs, lint and formatting passed. The checkout retains one additional pre-existing server test absent from the local development source.
- First checkout client run reported a timeout after an abnormally long elapsed run and a following input assertion failure; a fresh full run passed. Initial formatting failed on checkout CRLF line endings; scoped formatting normalized them without logic changes.

## 2026-09-17 real-data and structure update

- MySQL service detected and running.
- Development migration 002 applied to the confirmed database.
- Development baseline created without overwriting existing templates.
- Temporary local entry limited to standalone development.
- Browser-only data path removed.
- Logs redesigned as grouped activity rows with compact filters and responsive states.
- Workspace layout, navigation data and log feature components separated from route definitions.

Run results are recorded in `docs/UNIT_TEST_REPORT.md` and the repository commit message.

### Final checks

- Server Vitest suite: 165 passed.
- Client Vitest suite: 47 passed.
- MySQL integration suite: 12 passed.
- Jest unit suite: 46 passed.
- Production client build: passed with 55 modules transformed.
- OpenAPI/Postman consistency: passed with 24 operations and 346 examples.
- Browser persistence: a template edit remained after reload and was then restored to its original value.
- Local development entry: verified against the real server session and database-backed pages.

## 2026-09-17 notification maintainability refactor

- TDD red evidence: the new mark-all Undo test failed because the Undo action was absent; the minimal implementation then passed the focused suite.
- Server Vitest suite: 165 passed.
- Client Vitest suite: 50 passed.
- MySQL integration suite: 12 passed.
- Jest unit suite: 46 passed; 92.78% statement and line coverage for the reported unit scope.
- Production client build: passed with 62 modules transformed.
- Biome lint: passed for all notification refactor files and the updated application test.
- Biome formatting check: passed for all notification feature files, the route page and configuration files.
- Browser check: local MySQL-backed Notifications loaded successfully at the narrow responsive viewport; date controls, filtered-empty state, filter chips and Clear were verified; browser console errors and warnings: 0.
- Browser limitation: the real development database contained no notification records, so the mark-all and Undo path was not exercised by inserting artificial activity. It remains covered by frontend integration tests and the service/MySQL suites.
