# Candidate email-code recovery

The integrated candidate recovery flow now uses the owner's four-digit email-code journey: request an email, enter the code, choose a new password, then log in. The shared entry button says Send email rather than promising a reset link before the account flow is known.

HR recovery keeps the existing administrator/supervisor assistance email and email-mode screen. It does not issue a code or self-service reset credential. Historical HR reset credentials remain unable to change HR passwords.

Candidate codes expire after ten minutes, are stored as account-bound HMAC digests, allow at most five incorrect attempts and are subject to the existing IP/email/global limits and sixty-second resend cooldown. Successful code verification invalidates the code and issues a short-lived single-use reset token. Resending supersedes the previous reset credential. Password reset retains the current password policy and invalidates existing sessions. Existing recovery tables are reused; no schema migration is needed.

The frontend already supports code mode and stores the verified token in sessionStorage for the password form. Link/assistance display compatibility is retained for existing sessions. Sending failures discard the just-created credential and return an error rather than claiming success.

This code change does not enable SMTP or send real mail. Render Free blocks common SMTP ports, so switching from QQ to another SMTP mailbox alone does not solve deployment. A separate HTTPS email adapter and verified sender are needed before live acceptance. Brevo offers an HTTPS transactional API with a free daily allowance; account approval, sender verification, domain rewriting and inbox delivery still need verification. Public mailbox domains cannot be authenticated as domains owned by this project.

GitHub synchronization and Render deployment remain deferred at the owner's request. The local latest-main preparation includes the same candidate-only change while retaining schema 12 and the team's newer application rules. Private acceptance artifacts stay under .local/deployment; no passwords, codes, API keys or SQL backups belong in Git.

## Verification - 2026-10-29

Current local root regression: 145 passed. The original login/profile module's 69 tests passed in two runs: 64 non-DOM tests with the normal Node VM-module runner and 5 JSDOM tests with --jitless to avoid this host's CSSStyleDeclaration JIT issue. The separately prepared latest-team source passed 150 root tests; it remains local and uncommitted.

Isolated Aiven QA and Edge acceptance verified the actual four-box page, wrong-code rejection, successful verification, new-password submission, previous-session revocation, reset-token replay rejection and successful new-password login. HR assistance still hides verification controls, creates no reset credential and leaves the HR password unchanged. Fictional acceptance accounts were cleaned and the QA database account was locked. No real email was sent, no production rows/schema were changed, and neither GitHub nor Render was updated.
