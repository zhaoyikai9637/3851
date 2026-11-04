# JRS Recruitment Workspace - Render release copy

This is the reviewed release published as **JRS-1** beside the preserved **JRS** directory. Original repository files are retained unchanged. Open this directory when building or running the new version.

## Independent local review

To inspect the code and test applicant/HR integration without cloud credentials, use [Local review setup](docs/LOCAL_REVIEW.md) and the [Review checklist](docs/REVIEW_CHECKLIST.md). Requires Node.js 24 and an installed MySQL server. From this directory run:

    npm ci
    npm run review:setup
    npm run review:start

Open http://localhost:3200. Use npm run review:accounts for the generated local accounts and npm run review:mailbox for captured verification codes. These commands use an independent local database and never send real mail.

## Hosting

Follow [Render deployment](docs/RENDER_DEPLOYMENT.md). Use branch main, Root Directory JRS-1, Docker runtime, Dockerfile Path ./Dockerfile, Docker Context . and health path /health/ready. Keep automatic deployment disabled until configuration is complete. Render supplies PORT; retain the Dockerfile startup command.

Aiven MySQL stores accounts and business data; schema 12 is required. Private Supabase Storage holds resumes, HR avatars and archived attachments. Candidate recovery uses Mailjet HTTPS. HR assistance policy and recruitment mail configuration are unchanged. No demo login or role switch is enabled by this release.

## Build and start

Use Node.js 24. From this directory:

    npm ci
    npm run build
    npm start

Keep credentials in ignored local files or Render Variables. Copy .env.example only for an explicitly configured local database. Do not run setup, migrations or seeds at deployment/startup.

## HR candidate visibility

Candidates enter HR after an application is submitted or received. Applicant-owned profiles and resumes are read-only in HR; manual intake records retain supplementation. Existing accounts and records are preserved. See [Candidate visibility and ownership](docs/CANDIDATE_VISIBILITY.md).

## HR personal information

The existing candidate card separates the current personal profile from submitted application information. New submissions capture all profile sections; older uncaptured fields remain explicitly unrecorded. See [Candidate profile details](docs/CANDIDATE_PROFILE_DETAILS.md) for access, loading and snapshot behavior.

## Modules

- JRS Login and profile: shared login/registration, candidate code recovery and the original personal profile.
- JRS Applicant Portal: jobs, resumes, applications and status through the shared backend.
- JRS HR and jrs-hr-module: integrated HR workflow and communication workspace.

Profile is accessed from the header identity. Legacy display addresses forward to live applicant routes when enabled. My Resume retains its existing form and layout.

## Test the entire integrated project

Run npm test (or npm run test:unit) to execute all six active module unit/API suites and save a combined report. Run npm run test:all to include both frontend builds and the English check. Use npm run test:root for the previous root-only tests. See [Project tests](docs/PROJECT_TESTS.md) for coverage boundaries, individual suite selection and report locations. Real local database workflows use npm run review:verify separately.

## Verification and limits

On 31 October 2026 the isolated schema-12 QA workflow passed real Aiven/Supabase checks for private resumes, declarations, shared HR access, interview status synchronization, withdrawal and immutable submitted materials. Production was backed up, upgraded to schema 12 and accepted by a local readiness smoke check. Render build, public acceptance and post-restart checks remain separate.

    npm test
    npm run check:english
    npm run build

The standalone applicant test command is cross-platform and uses demo data. Root MySQL tests require their dedicated local test schemas; never point them at production. See docs/TEAM_UPDATE_20261028.md, docs/APPLICANT_ADAPTATION.md and docs/CANDIDATE_CODE_RECOVERY.md.

The old JRS directory is a source recovery reference. Reverting source also requires reviewing database, environment and file-storage compatibility. This release does not create HR identities, publish vacancies, copy old uploads or deploy automatically.

## Timestamp maintenance and public access performance

See [history and performance corrections](docs/HISTORY_AND_PERFORMANCE_REPAIRS.md) for explicit-target notification timestamp preview/repair, private backups, Windows test process settings and bounded public job/hashed-asset caching. Render Free wake-up latency remains a platform constraint.
