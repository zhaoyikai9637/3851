# Five-Year Offer and Rejected Retention

This is a project-specific retention rule, not a statement of legal compliance.
It applies to applications currently in Offer or Rejected.

## Start and expiry

Entering Offer or Rejected sets hr_application.retention_started_at.
Editing salary, approving an offer or confirming a rejection reason does not extend the period.
Offer to Rejected restarts the period at the Rejected transition.
Hired clears this field and is not purged by this rule.
Expiry is five calendar years; a leap-day anniversary is clamped to February 28.
Standalone startup and hourly tasks perform checks while the service is running.
Applications with an active send are deferred until the send completes or recovers to Uncertain.

## Transactional deletion

Delete the expired application and its notes, interviews, feedback, offer, tasks, drafts,
sent snapshots, attachments, system events, read state and linked audit content together.
Clear personal data from affected deduplication caches while keeping non-personal retry markers.
Old retries return 410 RETENTION_EXPIRED.
Delete candidate details and resume only when no other applications reference the candidate.
Keep unrelated applications, jobs, HR accounts and general templates.
Advance the workspace revision; roll back on any failure.

## Migration and deployment

Do not use migration day as a fabricated retention start date.
Prefer the most recent audit transition into the current eligible stage.
For legacy rows without a transition, review the earliest valid application/creation/offer date.
An application date is interpreted at Singapore midnight. This fallback may precede the true transition;
a coordinator must review it before cleanup. Stop on records with no usable date.
The migration adds/backfills fields and does not itself purge applications.

Standalone local mode enables cleanup by default.
Team mode requires both DB_WRITE_CONFIRMED and DB_SHARED_INTEGRATION_CONFIRMED to match DB_NAME.
The integrated root runtime has its own startup boundary; do not assume standalone background tasks are mounted there.
Downloaded exports, old backups and other systems are not cleaned by this module.
Review cross-module keys and backup retention before enabling shared cleanup.
