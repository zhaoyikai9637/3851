# Candidate visibility and ownership

## Active rule

HR Candidates contains people with an application record. Registering, filling a profile or uploading a personal resume alone does not publish a person to HR. Manual candidates enter through HR's Receive Application workflow. Withdrawn, rejected and completed applications retain their candidate history.

Self-registered applicants maintain their own profile and resumes. HR can read their application and submitted resume, add recruitment notes, and process interviews/offers/statuses. HR cannot edit their profile, overwrite their resume, or submit an application on their behalf through Receive Application. HR-entered candidate records retain contact editing and PDF supplementation.

## Server enforcement

Ownership comes from MODULE_ACCOUNT, CANDIDATE and JRS_CANDIDATE_LINK, not an email match or a client-supplied permission flag. Integrated transaction loads attach trusted ownership capabilities before candidate writes. candidate-save and resume upload reject applicant-owned records with 403. Direct candidate resume reads require an application record. The applicant submission service uses an internal trusted context and reuses an existing canonical candidate mapping.

The HR workspace and candidate-list API filter out people without an application. Internal transaction state keeps old rows so saves and historical mappings are preserved. No account, profile, resume or application is deleted by this change; no schema migration is required.

## Verification

review:verify tests registration without HR exposure; absence of an automatic recruiting record; a simulated legacy registration-only record remaining stored but hidden; direct-resume rejection before applying; first submission reusing the legacy ID; server rejection of HR profile/resume writes after submission; readable submitted documents; interview/withdrawal synchronization; and successful editing/upload for an HR-entered candidate. Only the isolated local review database is used.

Unit tests cover visibility, historical applications, ownership flags, unsubmitted profile synchronization, direct read restrictions, forged write/receive flags, and actual native candidate-view controls. Product behavior does not rely only on hidden buttons.

A new manual intake entry using an existing applicant account/contact email is rejected rather than creating an unlinked duplicate. Verified final acceptance: 742 unit/API tests, both frontend builds and English source checks passed; the separate real local MySQL policy workflow passed.
