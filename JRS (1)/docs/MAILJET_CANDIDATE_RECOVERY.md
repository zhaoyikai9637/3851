# Candidate recovery through Mailjet

Candidate recovery can use the HTTPS Send API v3.1 while HR mail retains its existing SMTP configuration and assistance policy. No database changes are required.

Set CANDIDATE_MAIL_PROVIDER=mailjet, MAILJET_API_KEY, MAILJET_SECRET_KEY, MAILJET_FROM_EMAIL and optionally MAILJET_FROM_NAME. The sender must be active in Mailjet. The default CANDIDATE_MAIL_MODE=sandbox requires CANDIDATE_MAIL_ALLOWLIST with comma-separated test recipients. This is a real-delivery recipient restriction, not Mailjet SandboxMode. Only set production mode after inbox acceptance. Keep secrets in the ignored .local directory or hosting environment variables.

For local testing, JRS_MAIL_ENV_FILE may point to .local/deployment/mailjet.private.env. This does not activate deployment or change the existing environment file automatically. For hosting, configure the same variables privately. SMTP_ENABLED can remain false; only candidate codes use Mailjet. HR assistance and recruitment email retain existing behavior.

The adapter uses a fixed HTTPS endpoint, Basic API authentication, a ten-second timeout, no redirects, generic delivery errors, and checks both message status and recipient acceptance. Provider acceptance is not proof of inbox delivery. Password reset tokens, expiry and rate limits remain enforced by the existing API.

Reference: https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email
