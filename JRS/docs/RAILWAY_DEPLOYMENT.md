# Railway deployment preparation

## Status and boundaries

Prepared on 2026-10-22 for a single deployment owner and website users in Singapore
and Australia. No paid Railway resources, production database or public deployment
were created. This is a deployment runbook, not a production-readiness certificate.

The default candidate job/resume/status pages still use `team-portal-data.js` and
`portal-display.js` presentation code (including disabled editing controls).
Production infrastructure does not turn those into an accepted live application
flow. Finish and accept the real candidate submission journey before inviting
the public to apply. The experimental applicant module is also not final.

The application supports a separate `production` database mode, injected variables,
an external listen address, durable uploads and database/storage readiness checks.
Local seed/maintenance commands remain blocked from cloud databases. Never point
the production site at the teammates' shared `jrs_team` integration database.

## Proposed layout

- One Railway application service in Singapore, one replica, initially 1 vCPU and
  1 GB memory limit. These are starting limits, not a verified capacity promise.
- A separate MySQL service/database, initially around 1 GB RAM and 5 GB disk.
  Runtime database: `jrs_production`; DML account: `jrs_production_app`.
- One application volume mounted at `/data`, initially 5 GB. All current avatars,
  resumes and mail attachments use `/data/uploads`; it must not be publicly served.
- HTTPS at one Railway-provided domain initially, then an optional custom domain.
- Separate database and application-volume backups with an actual restore test.

Hobby supports the one-owner project arrangement, but it blocks outbound SMTP.
The existing QQ SMTP transport therefore requires Pro or a new HTTPS mail adapter.
The owner confirmed QQ SMTP was only a test and need not be retained. Continue
preparation for Hobby with real mail disabled; choose an HTTPS provider later.
An earlier USD 15-30 monthly estimate is a budget
estimate, not a fixed quote or authorization to buy resources. Team members use
JRS accounts; they do not need access to the deployment dashboard or secrets.

### Email plan correction

Railway's current [outbound networking documentation](https://docs.railway.com/networking/outbound-networking)
allows SMTP only on Pro and above. Hobby needs a transactional provider's HTTPS
API; the current application does not yet implement that alternative transport.
The included template defaults to `SMTP_ENABLED=false` for a test deployment;
reset/recruitment email delivery is unavailable in that state. Its dormant SMTP
fields do not make SMTP work on Hobby. Pro currently has a USD 20 monthly minimum,
including equal usage credit, with additional usage billed separately. Confirm
the owner's choice before changing mail providers or creating paid resources.
Retaining QQ SMTP is not a requirement and does not justify upgrading the plan.

## Database TLS decision before purchase

The runtime continues to require a trusted CA and hostname verification for cloud
MySQL. Supply the real CA as multiline `DB_SSL_CA_PEM` in private Railway Variables,
or as a private mounted file named by `DB_SSL_CA_PATH`. Do not set
`rejectUnauthorized=false` or substitute an unverified TCP proxy hostname.

Railway documents encrypted WireGuard private networking and a MySQL template;
that does not establish that the template already has a hostname-valid MySQL TLS
certificate. If using Railway MySQL, configure and verify that TLS endpoint first.
Alternatively choose a dedicated managed MySQL instance with verified TLS, such as
a separate production service from the existing database provider. This can change
the cost estimate. No transport protection was removed for deployment convenience.

References: [Railway private networking](https://docs.railway.com/networking/private-networking),
[MySQL](https://docs.railway.com/databases/mysql),
[pricing](https://railway.com/pricing).

## Files included

| File | Purpose |
| --- | --- |
| `Dockerfile` | Node 24 build, lockfile install, both client builds and pruned runtime dependencies |
| `.dockerignore` | Excludes local credentials, uploads, private references and installed modules |
| `deploy/entrypoint.sh` | Initializes only the fixed upload directory ownership and drops to the Node user |
| `railway.json` | Docker build, one replica, `/health/ready` deployment check and bounded restart retries |
| `deploy/production.env.example` | Empty private-variable template; never commit a completed copy |
| `scripts/check-deployment.mjs` | Offline configuration/build checks, optional connected schema/storage check |
| `scripts/export-production-schema.mjs` | Read-only schema export from an approved isolated local database |

## Step 1: complete local verification

From the integrated `JRS` folder, run:

```text
npm ci
npm test
npm run build
npm run check:english
```

Also run the HR frontend/backend and isolated MySQL suites documented in HANDOFF.
On a machine with Docker, build the Linux image with `docker build -t jrs-release .`.
The preparing Windows machine has no Docker engine: Linux image construction and
the container's volume/privilege behavior have not yet been executed there.

Do not replace the lockfile or place secrets in build arguments. The build contains
no runtime environment file. Container runtime variables are supplied privately.

## Step 2: prepare the empty production schema separately

This is an explicit migration operation, not an application startup command.

1. Keep the export source on a named isolated local database at port 3307, schema
   version 11. Load only that local environment and run `npm run deploy:export-schema`.
   The command refuses cloud targets before opening a connection.
2. Review the generated ignored `.local/deployment/jrs-production-schema.sql`
   and its printed SHA256. It includes table definitions plus empty workspace and
   version metadata only. It does not copy account rows/passwords, candidate data,
   jobs, sessions, mail history, uploaded files or demonstration records.
3. An authorized database owner creates an EMPTY `jrs_production` database and a
   separate temporary migration account. Check the target host, database name,
   empty table list and a recorded backup/snapshot reference before any import.
4. In the owner's database client, import the reviewed SQL into that empty target.
   The script has no DROP or IF-NOT-EXISTS fallback and is not an upgrade script.
   MySQL DDL auto-commits: if import fails, stop and inspect; do not blindly rerun,
   drop tables or merge a partial schema into an existing database.
5. Verify table names and foreign keys on Linux, schema version 11 and the empty
   workspace row. Windows-folded table names are normalized by the exporter to
   the current canonical module names. Test the schema on a disposable database
   before importing a production instance.
6. Grant `jrs_production_app` only the runtime DML permissions it needs, with no
   CREATE, ALTER, DROP, GRANT or user administration. Keep migration credentials
   out of the application service and remove/restrict temporary migration access.
7. Provision the approved canonical HR profile, shared-login account and matching
   recruitment identity through a reviewed owner-only process. Do not copy local
   test passwords or manually invent plaintext password rows. This account
   provisioning and initial template setup remain a separate rollout gate.

For an existing production database, this bootstrap is inappropriate. Prepare a
version-specific reviewed migration and backup/restore plan instead. Never use
`db:setup`, seed scripts or local test runners on the production target.

## Step 3: configure Railway without public acceptance yet

1. Owner creates the project and application service, linking the authorized repo.
   Choose Singapore. Configure Root Directory `/JRS` and Config File
   `/JRS/railway.json`; the Dockerfile path is relative to that service root.
2. Keep one replica. Mount the application volume at `/data`. Do not mount it over
   `/app`, and do not store uploads in the container image or an ephemeral folder.
   Railway production startup rejects a missing or mismatched volume mount.
3. Copy variable names from `deploy/production.env.example` into Railway Variables
   and fill real values privately. Set `DB_EXPECTED_HOST` to exactly the approved
   database hostname. Use two different high-entropy session/reset secrets, at
   least 32 characters each. Never post these values in chat or screenshots.
4. Generate the Railway domain and set `APP_ORIGIN` to the exact HTTPS origin,
   without a path. Railway supplies `PORT`; `HOST=0.0.0.0` is required. Keep
   `ENABLE_EXPERIMENTAL_APPLICANT_PORTAL=false` for the reviewed default frontend.
5. For the current Hobby test deployment, leave `SMTP_ENABLED=false` and enter no
   QQ authorization code. Password recovery and actual email delivery remain
   unavailable. Before public invitation, implement and accept the selected HTTPS
   mail transport. Do not bypass the SMTP restriction with alternate ports.
   Only if Pro/SMTP is later explicitly chosen, configure production SMTP and a
   verified sender privately, retaining sandbox recipients during staging.
6. The entrypoint starts with the privileges needed for the root-owned Railway
   volume, creates/chowns `/data/uploads` only, then runs Node as `node`. Do not
   override the entrypoint/start command with a root Node process. Check file
   ownership, persistence and actual Node UID in the first container acceptance.
7. Do not add `db:setup` or automatic migrations to a start/pre-deploy command.
   Do not put production secrets in Git, the Docker image or CI build logs.

References: [config as code](https://docs.railway.com/config-as-code/reference),
[volumes and permissions](https://docs.railway.com/volumes),
[health checks](https://docs.railway.com/deployments/healthchecks).

## Step 4: preflight and acceptance

Run inside the configured application environment:

```text
npm run deploy:check
npm run deploy:check -- --connect
npm run deploy:check -- --connect --require-mail
```

The first checks production target, optional mail configuration and the HR build without
network access. The connected check reads the database schema version and writes
then removes a temporary probe in the configured upload directory. It does not
seed data, migrate tables, create accounts or deliver mail. Its logs deliberately
omit driver details, SQL, credentials and private endpoint settings.
Mail-disabled test deployments can pass infrastructure checks, with an explicit
warning that recovery/delivery is unavailable. `--require-mail` rejects disabled or
non-production mail configuration; it still does not prove delivery. Hobby's
future HTTPS transport will need its own adapter tests and acceptance.

- `/health/live`: process endpoint, 200 while the app responds.
- `/health/ready`: 200 only when schema version 11 and writable upload storage are
  available; otherwise 503 with a generic response. It exposes no database details.
- Railway uses readiness during deployment, not as ongoing uptime monitoring.
- The database itself must be initialized before app startup; startup also checks
  schema version and refuses a mismatched database.

Before inviting users, verify both Singapore and Australia access, candidate
registration/reset, HR/staff permissions, global logout/revocation, CSRF, uploads,
100+ fictional records, concurrent changes, mail delivery/failure, and redeployment
with retained files. Confirm secrets are absent from logs and API/docs exposure is
appropriate. Finish the remaining release-audit items in REVIEW_FOLLOW_UP.md;
this configuration change does not certify every production control as complete.

## Backups, rollbacks and operation

- Enable database and volume backup schedules before accepting real records. Keep
  an off-service recovery copy and test restoration into an isolated environment.
- Roll back an app to a known compatible commit/image. A code rollback does not
  reverse database migrations or restore deleted files.
- Volume-backed Railway services have deployment downtime and cannot use replicas;
  plan demo/release windows accordingly. Set budget notifications and monitor
  memory/disk use instead of assuming a fixed monthly resource bill.
- Keep automatic deployment disabled until the first reviewed rollout is accepted.
  Later CI should gate tests, builds, English checks and dependency/document review.

References: [volume limitations](https://docs.railway.com/volumes/reference),
[backups](https://docs.railway.com/volumes/backups).
