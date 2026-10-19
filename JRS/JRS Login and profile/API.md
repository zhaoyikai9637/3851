# Shared Login and Profile API

Standalone base: http://localhost:3001. Accounts/profile routes use /api; the bundled HR copy uses /hr/api.
The integrated main project keeps /api for shared accounts, uses /recruitment/api for HR business
and /api/hr for communication/profile. Do not interchange the two HR CSRF tokens or identity formats.
Examples are fictional; use actual returned IDs during integration.

## Authentication and transport

Use same-origin JSON requests with Content-Type: application/json, except file uploads.
The HttpOnly jrs_candidate_session cookie is shared by candidate and HR accounts.
Use credentials: 'same-origin'; there is no Bearer token or localStorage identity.
Responses from login, /api/me and the relevant HR identity endpoint provide csrfToken.
Authenticated writes require X-CSRF-Token and a matching APP_ORIGIN.
Registration, login and public password-recovery endpoints do not require a preexisting session/token,
but origin and rate-limit protections still apply.

Account roles are candidate and hr. HR workspace roles are HR_MANAGER and HR_STAFF.
Public registration creates candidates only; the backend verifies the linked active HR_USER.
After login the browser directs HR to /hr/ and candidates to Personal Profile.
The login API returns JSON rather than an HTTP redirect.

## Account endpoints

| Method | Path | JSON body | Success |
| --- | --- | --- | --- |
| POST | /api/register | email, password, first_name, last_name | 201; valid |
| POST | /api/login | email, password | 200; valid, user, csrfToken and cookie |
| GET | /api/me | None | 200; valid, user, csrfToken |
| POST | /api/logout | Empty object; authenticated + CSRF | 200; valid; revoke session and clear cookie |
| POST | /api/forgot-password | email | 200; generic valid/message; candidate recovery only |
| POST | /api/check-email | email, code | 200; valid, resetToken |
| POST | /api/set-new-password | resetToken, newPassword | 200; valid; revoke existing sessions |

Email is required, validated, lowercased and limited to 150 characters.
Registration passwords need at least 8 characters and at most 72 UTF-8 bytes.
Login passwords are nonempty and at most 72 UTF-8 bytes; do not trim passwords.
first_name is required, at most 50 characters; last_name is optional, at most 49.

A successful user contains account_id, email and role, not a display name.
Read profile.full_name from /api/profile or the HR name from the HR identity endpoint.

Recovery code is a four-digit string, including leading zeros.
It expires after 10 minutes; five incorrect attempts require a new request.
The resetToken is a single-use 64-character hexadecimal token with a 10-minute expiry.
newPassword uses the registration password limits.
Forgot-password responds generically to avoid disclosing account existence;
success does not prove an account exists or an email was delivered.
Unavailable SMTP returns 503. Recovery is for candidates, not HR account recovery.
The sequence is forgot-password, receive code, check-email, set-new-password, sign in again.
Email recovery requests are limited to once per minute and five per hour per email,
with additional IP verification limits. Follow actual server responses rather than retrying automatically.

## Candidate profile

All profile routes require the candidate role. Writes also require CSRF.
The session identifies the owner; email/account_id/candidate_id cannot select another person's profile.
HR receives 403 for candidate-only routes.

| Method | Path | Body / result |
| --- | --- | --- |
| GET | /api/profile | valid, profile |
| PUT | /api/profile | Basic details; valid |
| PUT | /api/profile/summary | personal_summary; valid |
| PUT | /api/profile/skills | skills array; valid |
| PUT | /api/profile/languages | languages array; valid |
| POST | /api/profile/{section} | Full section payload; 201 valid/id |
| PUT | /api/profile/{section}/{id} | Full section payload; 200 valid/id |
| DELETE | /api/profile/{section}/{id} | 200 valid |
| POST | /api/profile/resume | Multipart file named resume; 201 valid/id |
| GET | /api/profile/resume/{id} | Authorized file stream, not JSON |

section is career, education or certifications. id is a positive integer owned by the current candidate.
There is no candidate resume DELETE route.

Profile contains candidate_id, account_id, full_name, first_name, last_name, email,
country_code, contact_number, home_location and personal_summary.
It includes career (role_id), education (education_id), certifications (cert_id), skills,
languages (language_id, language_name, can_read, can_write) and resumes.
Resume metadata contains file_id, file_name, file_type, file_size and uploaded_at, never a private storage path.
Database booleans may be returned as 0/1; send actual JSON booleans.

### Basic details

PUT /api/profile accepts first_name (required, max 50), last_name (optional, max 49),
country_code (required valid prefix such as +65), contact_number (optional, max 20, validated for the prefix)
and home_location (optional, max 200).
The server derives full_name. This route does not change email, role or summary.
Use /summary for personal_summary (max 2000); an empty string clears it.

### Career, education and certification fields

Submit the complete form for both creation and update.
Optional months use YYYY-MM and may be omitted, null or empty. End dates must not precede start dates.

| Section | Fields and limits |
| --- | --- |
| career | Required job_title/company_name, max 150 each; optional start_month_year/end_month_year; required is_current_role boolean; description max 5000 |
| education | Required institution/qualification, max 150 each; required is_current_study boolean; optional four-digit finished_year; expected end_month_year for current study; description max 5000 |
| certifications | Required cert_name max 150; optional issuing_org max 150; optional issue_month_year/expiry_month_year; required no_expiry boolean; description max 5000 |

Current roles ignore their end date. Current study ignores finished_year; completed study ignores expected end_month_year.
no_expiry ignores expiry_month_year. Otherwise expiry must not precede issue.

### Skills and languages

Both PUT routes replace the entire collection. An empty array clears it.
Maximum 50 entries per collection; names are case-insensitively unique.
skills contains nonempty strings, max 50 characters each.
languages contains language_name (max 80), can_read and can_write booleans;
at least one capability must be true.

### Resumes

Upload exactly one resume file in multipart/form-data, with no other text fields.
Maximum 5 MiB; supported extensions are pdf, doc, docx, txt and rtf.
The backend validates file content as well as extension; text must be UTF-8.
Let the browser generate the multipart boundary rather than manually setting Content-Type.
Download by returned ID or reload /api/profile to obtain metadata.

## Standalone shared HR identity

HR signs in through POST /api/login. An active linked HR_USER and matching workspace role are required.

| Method | Path | Result |
| --- | --- | --- |
| GET | /hr/api/health | Public database health; 503 on failure |
| GET | /hr/api/auth/me | user, csrfToken |
| POST | /hr/api/auth/logout | Revoke shared session |
| POST | /hr/api/auth/password | currentPassword/newPassword; change shared password and revoke sessions |
| POST | /hr/api/auth/login | 409; separate HR sign-in disabled |

HR identity includes id, email, name, role, status, employeeId, department, phone and officeLocation.
The string workspace id is not the numeric account_id.
Backend password minimum is 8 characters and maximum 72 UTF-8 bytes;
the current standalone HR form applies an additional 12-character minimum.

## HR workspace, reads and writes

GET /hr/api/hr/workspace returns the workspace directly, without a valid wrapper.
It includes schemaVersion, revision, createdAt, updatedAt, currentUser, mailEnabled, timezone,
jobs, candidates, applications, interviews, tasks, notifications, activity, templates, systemNotifications and mailLogs.

GET /hr/api/hr/{resource} returns items,total,page,limit,revision.
Resources: applications, candidates, jobs, interviews, tasks, notifications, systemNotifications, mailLogs.
Templates are in workspace.templates, not a separate GET templates list.
Filters are page (min/default 1), limit (default 20, max 100), q, stage, status and jobId.

GET /hr/api/hr/templates/variables returns supported variables.
GET /hr/api/hr/candidates/{id}/resume returns an authorized PDF; download=1 requests attachment.
GET /hr/api/hr/mailLogs/{id}/attachments lists metadata.
GET /hr/api/hr/attachments/{id} downloads the PDF snapshot.

POST /hr/api/hr/commands/{command} requires CSRF, If-Match and Idempotency-Key.
It returns result, incremented revision and the complete updated db.
Keys use 16-80 letters/digits/hyphens. Retry one request with the same key/payload.
Stale revisions require a fresh read and user-confirmed retry; missing If-Match returns 428.
notify prepares a draft, never an automatic email.

| Command | JSON fields |
| --- | --- |
| profile-save | phone, officeLocation |
| job-save | id?, title, department, type, mode, location, experience, education, description, requirements, skills, status |
| job-status | id, status |
| application-create | jobId, candidateId or candidate, priority? |
| candidate-save | id, name, email, phone, location, experience, education, skills |
| move-interview | applicationId, notes?, notify? |
| reject | applicationId, reason, notes?, notify? |
| schedule | applicationId, interviewId?, date, time, duration, format, interviewer, location, notes?, notify? |
| cancel-interview | applicationId, interviewId, reason |
| feedback | applicationId, interviewId, rating, recommendation, notes |
| offer | applicationId, salary, startDate, expiry, terms |
| approve-offer | applicationId; manager only |
| offer-message | applicationId |
| accept-offer | applicationId, notes |
| confirm-rejection | applicationId, reason |
| message | applicationId, notificationId?, templateId?, subject, body |
| read-notification | id |
| read-all | Empty object |
| task | applicationId, title, assignee, due, notes? |
| complete-task | id |
| candidate-notes | applicationId, notes |
| template-save | id?, name, kind, subject, body; manager only |
| template-delete | id; archive, manager only |
| system-read | id |
| system-read-all | Empty object |

Job types: Full-time/Part-time/Contract/Internship; modes: On-site/Hybrid/Remote; status: Active/Draft/Closed.
Requirements are newline-separated and skills comma-separated strings.
New candidate objects use name,email,phone,location,experience,education,skills;
experience is 0-70, priority High/Normal (default Normal), and the job must be Active.
Scheduling uses YYYY-MM-DD and HH:mm in Asia/Singapore; duration 15/30/45/60/90/120;
format Video/On-site/Phone; future times and conflict checks are mandatory.
Feedback uses rating 1-5 and recommendation Proceed/Hold/Reject after interview completion.
Offer salary is positive SGD with at most two decimals; expiry is today or later and startDate is after expiry.
Task due dates cannot be in the past.
Template kinds: Interview Invite/Offer Letter/Accepted/Rejected/In Progress.
Retrieve variables from templates/variables; they include candidateName,jobTitle,hrName,date,time,
interviewer,location,format,salary,currency,startDate,expiry.
With a templateId, message subject/body may be filled from the template.

POST /hr/api/hr/templates/{id}/preview accepts applicationId and returns subject/body.
POST /hr/api/hr/notifications/{id}/send accepts attachResume and requires If-Match.
Sending is disabled by the shared integration: 409, draft retained.
PUT /hr/api/hr/candidates/{id}/resume accepts raw application/pdf bytes, maximum 5 MiB;
use If-Match and an encodeURIComponent-encoded X-Filename, not multipart.

Stages: Pending Review, Interview, Interview Results, Offer, Rejected, Hired.
Interview statuses: Scheduled, Completed, Cancelled. Enumerated values are case-sensitive.

## Errors and boundaries

Account errors use {valid:false,error:"message"}.
HR errors use {error:{code,message,requestId}}.
400: malformed input; 401: missing/invalid identity; 403: role/origin/CSRF denial;
404: missing or unowned resource; 409: duplicate, revision conflict or invalid business state;
410: retention purge; 413: oversized HR upload; 422: HR validation; 428: missing revision;
429: rate limit; 500/503: unavailable service, database or required configuration.

Do not mix candidate numeric IDs and HR string IDs.
Standalone candidate demonstrations do not supply a complete jobs/application API.
Standalone HR tables do not automatically synchronize candidate recruitment state.
Shared-login tests and email drafts are not evidence of a complete final applicant flow or actual delivery.
