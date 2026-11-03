# Notification times, availability wording and reschedule inputs

## Notification UTC persistence
Recruitment state-change notifications now explicitly save the UTC instant from their authoritative recruitment event. They no longer rely on the MySQL session's CURRENT_TIMESTAMP default. The reader continues to format UTC timestamps in Singapore time. This fixes new mirrored events even if the MySQL session uses UTC+8. No schema change or automatic rewrite of historical notifications is performed.

## Applicant wording
My Resume describes availability as job-search status, using Open to new opportunities and Not currently seeking a role. It explicitly states that HR can still view submitted applications. These are wording and accessibility-label changes; storage, controls, layout and submitted-history visibility are unchanged.

## Reschedule inputs
Opening Reschedule Interview clears date, time, venue and interviewer. It retains the booking ID, duration, format and optional notes. Saving still updates the existing scheduled booking, and closing the form leaves it unchanged. CSS and form markup structure are unchanged.

## Deferred work
The existing review navigation and duplicate notification body remain unchanged. Work-arrangement values still appear on applicant job details and HR review facts. These values do not affect submission authorization or application progression, but can be misleading because the current editor no longer exposes a control for them. New jobs retain the hidden On-site default; old jobs retain their saved mode. Display removal needs a separate product decision.

## Validation
Run npm run test:all and the independent real-MySQL reviewer workflow. Verify mirrored state-change timestamps against their source event on a UTC+8 session. Check reschedule blank fields and successful save/cancel through the integrated HR iframe in Edge. Check job-search wording on desktop and narrow screens. No cloud deployment or historical production timestamp correction is included.

Verified 748 unit/API tests across all modules, both production builds and English checks. The isolated MySQL full workflow confirmed source/mirrored UTC equality on a UTC+8 server. Edge confirmed blank reschedule inputs, cancellation without changes, saving to the same booking and desktop/390px availability wording.
