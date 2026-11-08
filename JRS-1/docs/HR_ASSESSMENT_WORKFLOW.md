# HR assessment wording, navigation and email actions

Updated 8 November 2026. Scope is limited to the requested HR workflow changes and their tests.

## Interface

- Move to Interview is now Arrange interview. Interview/rejection Save controls use Save. Reject actions use Reject application. Internal interview/rejection notes are labelled Comment.
- Meeting format is labelled Meeting venue and retains Video, On-site and Phone. The separate room/address/link input remains. The Duration input is removed; existing duration values/defaults continue to support scheduling overlap and calendar calculations.
- Applications and assessment use a breadcrumb, ending in Assess application. Intermediate status navigation and the assessment Back to list button are removed. Existing next/detail actions remain.
- Offer and Interview Results queues contain only candidate name and decision status. Results use existing Proceed/Hold/Reject recommendations as Passed/On hold/Not passed; offers show their existing approval status. Rendering does not change decisions.
- Hired is removed from active stages, reports, new demo stages and acceptance actions. The former acceptance command is rejected. Historical database records and audit history are not deleted, and remain readable so an existing database can start without a destructive migration. No new Hired transition is possible.

## Save and send

Selecting Send email notification and saving an interview or rejection first saves the decision, then sends its new message through the existing authorized mail endpoint. Offer email actions also send. The existing mail configuration, recipient identity, role/CSRF checks and provider integration are unchanged.

The email request uses the revision returned by the save. A delivery failure reports that the decision was saved and directs HR to Email Outbox; it never repeats the decision or automatically resends a message. Disabled delivery cannot silently masquerade as a successful send. Comments remain internal.

## Verification

- HR React: 189/189, including two-column summaries, selected/unselected delivery, disabled delivery, a failed send without repeated commits, and the correct revision for immediate sending.
- Recruitment workflow/API: 132/132, including retirement of acceptance and unchanged permission rules.
- HR communication backend/API: 183/183.
- Integrated boundaries/shared UI: 236/236, with updated breadcrumb and shortcut assertions.
- Both production builds and English checks passed.
- Isolated real-MySQL reviewer verification passed registration, recovery, resume/private data, submitted profile snapshots, scheduling and status synchronization.
- Edge at 1440px and 390px passed Arrange interview Save/send, Reject application Save/send, exact registered recipients, internal-comment exclusion, breadcrumb, removed Back/Duration controls, unchanged meeting options, two-column summaries and rejection of the retired Hired action. Test delivery was captured locally; no real email was sent and no production database changed.

Private pre-change source and browser evidence are under .local/hr-wording-20261108. Applicant pages, cloud settings, credentials and unrelated features were not changed. Render requires a separate manual deployment.
