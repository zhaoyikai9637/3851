# Team source synchronization - 2026-10-28

## Reviewed upstream

Fetched origin/main before editing. The latest teammate upload is commit
42ed1f134699e35bdeb8ec1ed683e1f659316d88 by sihuanjia-lgtm, containing
SiHuanjia_Applicant_Portal_2026-10-28.zip. Shen Junye's d575dee HR update is already
integrated through 749f239. The shared DD MM YYYY change at 1df197d is retained.
The source archive remains in the repository; macOS resource forks, local uploads,
environment files and generated assets were excluded from extraction/import.

## Current behavior

- Free-form skills replace the fixed checkbox catalogue. Up to 50 skills are
  trimmed, validated and deduplicated without case sensitivity.
- Start availability is a controlled select. Existing vacancy-specific questions
  are retained when HR mirrors job changes; integrated vacancies expose the
  shared availability question instead of silently losing the new intake control.
- Required role questions display inline errors. Review has three section-edit
  actions and a required applicant declaration. Section edits retain entered data.
- New submissions record the declaration and server acceptance time atomically
  with the applicant record, submitted snapshot and HR queue entry.
- The old visitor application sign-in modal and its helper are deleted. The
  updated visitor sign-in handoff uses the existing shared authentication service.
  Closed vacancies have a truly disabled application action.
- Teacher styling/branding is imported; the shared button stylesheet and full
  DD MM YYYY date presentation remain loaded. Historical coded skills remain
  readable, but the old fixed skill catalogue is not restored.
- Fixed applicant employment filters omit Contract and Internship. Existing HR job
  rows and past applications are retained; no recruitment history is removed.

The upstream package relocation adds no dependency not already pinned by the
integrated root lockfile. Existing integrated manifests/lockfiles remain in place;
no dependency installation, version downgrade or registry change was needed.
Standalone SQL/query files are retained as module evidence, not executed against
the integrated schema. Its uppercase APPLICANT tables are not this runtime's tables.

## Database and authentication integration

Schema 12 adds declaration_accepted (default false) and declaration_accepted_at
(nullable) to applications. It never fabricates acceptance for historical rows.
The migration is resumable and repeatable. Runtime/readiness, setup, controlled
import and schema-only export checks now require schema 12.

Ran scripts/migrate-applicant-update.mjs --test before --local. The script verifies
the actual approved local database, privately backs up existing application rows
and columns, and compares every pre-existing application value after migration.
All 44 existing test applications and the 1 existing local-development application
were unchanged at migration time. This is unrelated to a remote/cloud deployment.
Source backups and private database backups are under the runtime .local/backups/.

Browser verification exposed a pre-existing shared sign-in handoff bug: login
succeeded but the integration-config response omitted valid:true, which the actual
login API client requires. Fixed that response contract and added a regression
using the real browser API client against the integrated application.

## Verification

- Applicant module: 26 tests passed, including the teammate's new cases.
- Integrated root: 132 tests passed.
- React: 131 tests passed, including free skill entry, duplicates, missing answers,
  retained review edits, declaration validation and the updated visitor handoff.
- Native HR: 125 tests passed. Communication server/API: 183 tests passed.
- Dedicated communication MySQL: 12 tests passed.
- Default shared-login/HR boundary: 2 tests passed.
- Full applicant-to-HR integration: 2 tests passed, including rejection of absent
  declaration, persisted acceptance time, actual resume access and status sync.
- Declaration migration: 1 test passed. Existing canonical profile/snapshot sync:
  2 tests passed. Both use the dedicated isolated MySQL test schema.
- Production builds of both clients passed. The existing applicant chunk-size
  warning remains. English source/document checks passed.
- External Edge verified shared login and the four-step application flow using
  a fictitious applicant and vacancy on port 3101, backed only by the test schema.
  It verified free skills, controlled availability, inline missing-answer feedback,
  Review/edit actions and declaration visibility. No browser submission was made.
  At 390px viewport width the document width was 375px, without horizontal overflow.

The existing applicant feature switch is preserved. Local preview has it enabled;
the production/default-off boundary and separate public-launch acceptance remain.
No production resource, remote migration, actual applicant decision or real email
was triggered by this synchronization.
