# Render deployment from JRS (1)

The integrated Express application runs as one Docker Web Service. Aiven MySQL is the business database; private Supabase Storage holds resumes, HR avatars and archived attachments. The original JRS and teammate archive remain unchanged. This additive release is JRS (1).

## Existing service settings

- Repository: zhaoyikai9637/3851; branch: main.
- Root Directory: JRS (1), including its space and parentheses. Do not add quotation marks in the dashboard field.
- Language/runtime: Docker.
- Dockerfile Path: ./Dockerfile; Docker Context: . (relative to Root Directory).
- Health Check Path: /health/ready.
- Plan: retain the existing Free instance. This configuration needs no paid service or persistent disk.
- Docker Command: leave empty to use the Dockerfile CMD. Render supplies PORT.
- Auto-Deploy: disable while preparing variables and selecting the release commit. Manually deploy after configuration is complete.
- APP_ORIGIN: https://three851.onrender.com for the existing service; update it if the assigned service address changes.

Do not select JRS/README.md as a Blueprint. Use the existing Docker Web Service, without creating or purchasing another service.

## Private variables

Use deploy/render.env.example as the name/template reference. Completed values must never be committed. JRS_ENV_FILE is empty. JRS_DATA_DIR=/data is writable scratch space, not persistent storage. Use JRS_STORAGE_PROVIDER=supabase, SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_BUCKET=jrs-files. Keep the bucket private; database Data API and public bucket access are not required.

Aiven settings must target jrs_production and jrs_production_app with the actual hostname, port, expected hostname and trusted CA. Retain TLS and hostname verification. The application account has no schema-changing privileges. Schema 12 is already required; startup never runs migrations or seeds.

Candidate recovery uses CANDIDATE_MAIL_PROVIDER=mailjet with the API key, secret, verified sender email and sender name. Initial acceptance keeps CANDIDATE_MAIL_MODE=sandbox and an explicit CANDIDATE_MAIL_ALLOWLIST. This sends real mail only to approved recipients; it is not Mailjet SandboxMode. Recovery for other recipients stays unavailable until launch approval switches CANDIDATE_MAIL_MODE=production. Keep SMTP_ENABLED=false initially. Candidate recovery does not enable HR assistance or recruitment delivery.

Never expose credentials using VITE_, NEXT_PUBLIC_, browser scripts, GitHub, screenshots or logs. Use independent SESSION_SECRET and RESET_SECRET. The complete private variable file is prepared separately on the owner's machine. Variable counts in older handoffs are historical.

## Deployment and acceptance

1. Verify the new commit only adds JRS (1), retaining original JRS and archive hashes.
2. Configure the existing service's new root, Docker paths, health path and private variables. Save without deploying until ready.
3. Confirm Aiven Running, schema 12, private bucket access and Mailjet sender access.
4. Deploy the reviewed commit; check actual Render build/runtime logs and /health/ready.
5. Provision owner-approved HR identities and vacancies separately. Production contains no demonstration business data.
6. Verify registration/login, recovery, original profile, resume privacy, application/HR sync and persistence after a service restart on the HTTPS site.
7. Confirm backup restoration and runtime credentials before inviting real users. Local/QA acceptance does not prove public deployment.

There is no silent file fallback to temporary disk. Legacy uploads require reviewed copying. External cleanup after a database failure is best effort; investigate fixed error labels without logging credentials.

Render Free can sleep and loses local runtime files. Persistent state lives in Aiven and Supabase; their free-tier limits and inactivity pauses also apply. Preserve the original source for comparison, but review schema, credentials and file compatibility before rollback.

Official references:
- https://render.com/docs/monorepo-support
- https://render.com/docs/docker
- https://render.com/docs/free
