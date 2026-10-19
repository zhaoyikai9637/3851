# HR Database and Transaction Model

Use MySQL with InnoDB and utf8mb4. database/schema.sql defines the standalone hr_* schema.
The integrated application uses a recruiting_* namespace for these tables and separate canonical tables.
Do not import the standalone schema into an existing shared database without a reviewed mapping.

## Responsibilities

hr_workspace stores the workspace revision and is locked during writes.
hr_user, hr_session and hr_login_limit hold standalone HR identity, hashed sessions and rate limits.
hr_job_position, hr_candidate and hr_application hold jobs, candidates and their applications.
hr_application_note, hr_interview, hr_interview_feedback, hr_offer and hr_task hold workflow records.
hr_email_template, hr_email_draft, hr_notification_log and hr_notification_attachment preserve communications.
hr_system_notification and hr_notification_read keep system events and per-user read state.
hr_resume holds private PDFs; hr_audit_log and hr_request hold audit and deduplication records.

Business rows use relational keys, not a single JSON workspace document.
Skills and requirements are JSON string arrays; salaries use DECIMAL.
Candidate/job pairs are unique. Scheduling checks conflicts across related records.
Legacy education fields may remain for compatibility; their existence does not imply an automatic eligibility decision.

## Transaction boundary

Lock the workspace row with SELECT FOR UPDATE, check the request key and revision,
load the snapshot, apply business rules and persist changed rows.
Commit revision, audit and notification changes in the same transaction.
Any failure rolls back the entire operation. This serial workspace model is intended for the current project scale,
not large multi-tenant workloads; larger deployments need resource queries and narrower locking.

## Time, history and email

Business dates use Asia/Singapore. Event timestamps are stored in UTC.
Draft, Sending, Sent, Superseded and Uncertain are distinct states.
Sent means provider acceptance, not inbox delivery or a read receipt.
Interrupted sends may become Uncertain; do not automatically send them again.
Historical messages and attachments retain their submitted snapshot after profile or template edits.

## Setup and retention

Local initialization creates missing tables; it must not reset passwords or remove records.
Seed scripts are for empty, explicitly isolated local databases and fictional data only.
Runtime startup checks the schema rather than silently altering shared tables.
Review RETENTION.md before enabling five-year cleanup. Backup copies have their own retention obligations.
