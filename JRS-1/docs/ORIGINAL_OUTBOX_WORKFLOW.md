# Original Applications and Notifications workflow

The SJY v2.6.2 handoff contains four communication tabs: Notification Center, Email Outbox, Email Templates and Notification Log. Business actions prepare unsent drafts; HR reviews and explicitly sends them. Saving a decision stays in its current workflow rather than forcing navigation to another module.

The integrated release had hidden Email Outbox and redirected its route to Applications. Restore the native outbox within the authenticated HR host, with application-scoped links, current-status template filtering and the existing Mailjet/captured-review transport. Reject prepares a draft after its existing confirmation; it does not send mail. Removed rejection-reason screens remain removed. Interview and offer guards remain unchanged.

The outbox supports reviewing drafts, previewing the registered applicant recipient, explicit send and links back to the application. Sending remains in the outbox and records the existing mail log. Unscoped pages no longer display a generic Applications text link.

The old database contains no email drafts or sent-mail logs to migrate. Its five orphaned integration-test notices remain excluded under the user's earlier decision. Existing production drafts become accessible through the restored outbox; no fabricated history, production data writes or schema changes are part of this change.

Validation: Edge at 1440px and 390px completed registration, resume upload, real local application submission, rejection, internal notice, draft template selection, captured send, log and application return. No real email was sent. All 785 unit/API tests, both builds, English checks and isolated real-MySQL verification passed. Deployment remains a separate manual step.
