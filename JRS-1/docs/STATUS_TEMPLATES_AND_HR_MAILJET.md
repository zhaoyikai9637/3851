# Status-aware templates and optional HR Mailjet delivery

## Template selection

The native Candidate Message dialog now lists only active templates applicable to the current application. Custom message remains available. A shared policy is used by the UI, preview API and message command; changing the browser request cannot bypass it.

| Application state | Templates |
| --- | --- |
| Pending Review | In Progress |
| Interview, with a scheduled booking | Interview Invite and In Progress |
| Interview, without a scheduled booking | In Progress |
| Interview Results | In Progress |
| Offer, approved and not expired | Offer Letter |
| Hired | Accepted |
| Rejected | Rejected |

Unapproved or expired offers do not list Offer Letter. Stage-specific rejection templates additionally use the recorded rejection source stage. Offer Declined Acknowledgement requires an explicitly declined offer. Existing selected templates that are no longer offered are not reintroduced into the list. Shared template management remains separate from selecting a template for an application.

## Enable HR delivery on Render

HR can now use Mailjet Send API v3.1 over HTTPS through the existing explicit send workflow. The adapter uses the same private MAILJET_API_KEY, MAILJET_SECRET_KEY, MAILJET_FROM_EMAIL and optional MAILJET_FROM_NAME as candidate recovery, with independent HR enablement and recipient mode. No additional dependency is needed. Candidate recovery configuration is unchanged.

Deploy this source, then configure these Render service variables for an inbox test:

| Variable | Value |
| --- | --- |
| HR_MAIL_PROVIDER | mailjet |
| HR_MAIL_ENABLED | true |
| HR_MAIL_MODE | sandbox |
| HR_MAIL_RECIPIENT_ALLOWLIST | The exact email address of an inbox you control; comma-separated for multiple addresses |

Ensure MAILJET_API_KEY, MAILJET_SECRET_KEY and MAILJET_FROM_EMAIL are present in the server environment, and the From address has been verified in Mailjet. Do not put keys in client code, screenshots or GitHub. Existing SMTP_ENABLED=false may remain; the HR Mailjet path does not require an SMTP connection. HR_MAIL_PROVIDER defaults to the existing SMTP configuration for backward compatibility; Mailjet sending is disabled unless explicitly enabled.

The application's sandbox mode allows real sends only to the explicit allowlist. It is not Mailjet's no-delivery SandboxMode. Test using an application registered with the allowlisted email; imported example.com candidates remain blocked from real delivery. Open the application's Candidate emails section, choose New email and an eligible template, save its draft, then choose Preview & send and confirm Send Email. HR does not send automatically when an application changes status. Verify both the received email and Logs. Provider acceptance alone is not inbox delivery proof.

After a successful inbox test, set HR_MAIL_MODE=production to allow genuine candidate recipients. The explicit preview/send confirmation remains. Saving cloud variables or deploying the new code was not performed as part of this source change.

## Delivery behavior

The existing revision checks, persistent draft IDs, Sending lock, recipient checks, immutable log and no-automatic-resend behavior are retained. The Mailjet adapter accepts one resolved recipient and optional private in-memory PDF attachment, sends only to the fixed HTTPS API endpoint, rejects redirects, uses a 10-second timeout and accepts only a matching success response. It does not upload a public document URL. Unconfirmed sends become Uncertain for manual checking. Disabled mail leaves drafts available and disables sending in the UI.

Official request contract: https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email and https://dev.mailjet.com/docs/email-api/send-api-v31/send-attached-files .

## Verification - 4 November 2026

- node scripts/test-project.mjs --all: 777/777 tests passed (229 integrated, 69 login/profile, 26 applicant, 132 recruiting, 138 HR client, 183 HR server), both production builds and English checks passed.
- Real isolated MySQL: wrong-stage preview rejected, valid preview variables resolved, draft saved, captured send persisted to both native and canonical histories, duplicate send caused no second delivery.
- Mailjet HTTP transport tests use a fake fetch implementation: success, PDF attachment, configuration and recipient guards, response recipient mismatch, failure-to-Uncertain handling and duplicate prevention passed. No live Mailjet request or actual inbox delivery was tested.
- Edge at 1440 px and 390 px: all six application states showed the expected template choices, supported previews resolved recipient details, with no page errors or horizontal overflow.

Private verification artifacts remain under .local/template-policy-20261104 and are excluded from GitHub. No production database, Render variables or real candidate messages were changed.
