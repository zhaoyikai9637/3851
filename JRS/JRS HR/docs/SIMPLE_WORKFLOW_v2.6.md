# Simplified recruitment workflow

Version 2.6.2 - 2026-10-22

## Review and schedule together

1. Choose Pending Review in Applications and open a candidate's resume.
2. Compare the actual resume with Job Description and Job Requirements.
3. Select Move to Interview. Date, time, location/meeting link and interviewer
   start blank and are required. More options retains a 45-minute Video default
   and optional private notes. Dates use YYYY-MM-DD and an English calendar.
4. Confirm once to move the stage, create the appointment and optionally prepare
   one unsent schedule draft. Validation checks the full appointment first; any
   failure leaves the stage, history and drafts unchanged.
5. Stay on the current page and display a saved confirmation. The current meeting
   becomes visible. Existing Interview applications without an appointment can
   still use Schedule Interview; an existing meeting opens its actual details.
6. After a meeting ends, save feedback without leaving the current page. A resume
   already open shows the feedback and the next appropriate decisions.
7. Use the top location path to return to the originating list. Search, position,
   priority, dates and page are retained; invalid pages are clamped. The old
   applications-review path redirects to the canonical pending-review path.

## Removed interface elements

The review and result pages no longer show Back to list, Previous, Next, Applicant
details, Activity, View profile or View activity shortcuts. Applications has one
sidebar entry with status filtering in the content area. Reject Application no
longer shows Status Change, Current Status or New Status diagrams. Saving does
not navigate to a success page, results page, Interviews list or Email Outbox.
Receiving a new application intentionally opens its resume.

## Retained rules and integration

Only active jobs allow progression and scheduling. Closed jobs preserve existing
records but block new applications and progression. The old Stopped selector and
Stop actions are removed; historical stored values remain readable.

Bookings must be in the future and cannot overlap for a candidate, interviewer
or on-site room. Feedback is available only after the meeting ends. Stage order,
manager approval, offer dates/amounts, acceptance evidence, rejection reasons,
idempotent retry and five-year retention remain enforced.

Education and experience requirements remain written job criteria for human
review. Old academic fields do not block interviews or offers. No seed/reset or
destructive schema migration is part of this synchronization.

The integrated project retains shared login, real submitted documents, canonical
templates, application-scoped mail review, audit actor IDs, sandbox recipient
limits, persistent assessment criteria and responsive viewport pagination.
Draft preparation never sends mail. No real recruitment decision or email is
automatically performed by opening the updated interface.
