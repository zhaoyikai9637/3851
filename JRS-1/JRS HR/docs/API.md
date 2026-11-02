# HR API Contract

Standalone paths below begin with /api. Shared-login standalone mode adds /hr.
The integrated main application mounts recruitment APIs under /recruitment/api and
communication/profile APIs under /api/hr. Use the correct runtime prefix.

## Identity and requests

Authenticated HR access is required except for health and the configured sign-in entry.
Roles are HR_MANAGER and HR_STAFF. The server resolves the actor, never the request body.
Writes require X-CSRF-Token. Workspace mutations also require If-Match with the latest revision.
Commands use a unique Idempotency-Key (16-80 letters, digits or hyphens).
Keep the same key and payload when retrying one uncertain request; use a new key for a new operation.

GET /api/auth/me returns user and csrfToken.
POST /api/auth/logout ends the session.
POST /api/auth/password accepts currentPassword and newPassword.
The shared-login integration disables separate HR login and directs users to /api/login.

## Read endpoints

| Method | Path | Response |
| --- | --- | --- |
| GET | /api/health | Health and database status |
| GET | /api/hr/workspace | Full workspace with revision and currentUser |
| GET | /api/hr/{resource} | items, total, page, limit, revision |
| GET | /api/hr/templates/variables | Supported template variables |
| GET | /api/hr/candidates/{id}/resume | Authorized PDF stream; download=1 requests attachment |
| GET | /api/hr/mailLogs/{id}/attachments | Attachment metadata |
| GET | /api/hr/attachments/{id} | Authorized attachment download |

Resources include applications, candidates, jobs, interviews, tasks, notifications,
systemNotifications and mailLogs. Templates are returned through workspace.templates.
List filters include q, stage, status and jobId. page starts at 1; limit defaults to 20 and is capped at 100.

## Writes

POST /api/hr/commands/{command} returns result, revision and the updated db workspace.
POST /api/hr/templates/{id}/preview accepts applicationId and returns subject/body.
POST /api/hr/notifications/{id}/send accepts attachResume and the current revision.
PUT /api/hr/candidates/{id}/resume accepts raw application/pdf bytes, not multipart;
include If-Match and an encoded X-Filename. Maximum size is 5 MiB.

Commands cover profile-save, job-save, job-status, application-create, candidate-save,
move-interview, reject, schedule, cancel-interview, feedback, offer, approve-offer,
offer-message, accept-offer, confirm-rejection, message, read-notification, read-all,
task, complete-task, candidate-notes, template-save, template-delete, system-read and system-read-all.
See the adjacent login/profile API.md for the full shared-login command payload table.
The source of truth for branch-specific fields is server/service.cjs and dist/state.js.

Only managers may approve offers or manage templates. A notify flag prepares a draft; it never sends automatically.
Interview schedules use Asia/Singapore dates and must avoid candidate, interviewer and room conflicts.
Feedback requires a completed interview. Offers require valid dates and the appropriate approval state.

## Errors and consistency

Errors use {error:{code,message,requestId}}.
401 means authentication is missing; 403 means role, origin or CSRF rejection.
409 includes REVISION_CONFLICT and invalid business transitions; reload before a user-confirmed retry.
410 RETENTION_EXPIRED means an associated record was purged.
422 indicates invalid fields; 428 indicates a missing revision; 429 indicates rate limiting.
503 TEAM_READ_ONLY blocks writes when shared-database confirmation is absent, including session writes.
Do not interpret connectivity or a read-only diagnostic endpoint as permission to mutate data.


## Integrated 2.6.2 update

See [SIMPLE_WORKFLOW_v2.6.md](SIMPLE_WORKFLOW_v2.6.md). The combined
`move-interview` command now requires date, time, interviewer and location, with
duration and format supplied by the form. Stage, appointment and optional draft
are saved atomically. Closed jobs block progression. ISO date values and trusted
shared sessions remain mandatory. No schema or existing business row is reset.
