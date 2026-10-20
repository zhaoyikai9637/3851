# Compact HR workspace and interview assessment

## Workspace layout

Business pages use one compact title in the top location bar. Real parent paths remain clickable; the artificial HR Workspace parent is removed. Embedded modules suppress their duplicate heading while preserving actions and content. Report sections and export actions share a toolbar. The communication module retains its own scoped tabs and notification summary.

Job Postings places search, department, recruitment status and Create job in one toolbar. Department values come from actual jobs. Filters combine, reset pagination, and survive opening/saving a job. Clear filters resets all three controls. Redundant header totals and success banners are not restored. Small screens wrap controls and scroll only the table horizontally.

English date controls in embedded HR pages show DD/MM/YYYY and an English calendar. Original named form fields and filter events retain ISO values, required/min/max constraints and backend validation. Login and applicant layouts are unchanged.

## Assessment criteria

HR can add, rename and remove criteria for a single interview, with at most 20 distinct names of 80 characters. Four suggested names are initially offered without scores. Each retained criterion needs an explicit integer rating from 1 to 5. Overall rating and recommendation also start unselected.

The manual overall rating, recommendation, notes and existing eligibility/permission rules remain authoritative. Criterion scores do not calculate hiring outcomes, change an application's recommendation, assign weights or automatically average the overall rating. There is no global assessment-template editor in this update.

The existing feedback command accepts an optional assessment JSON string containing objects with label and rating. This preserves its primitive payload/idempotency contract and existing CSRF, revision, timing, status, audit and actor checks. Legacy requests without criteria still work. Saved names and scores are displayed in interview details and results; dynamic text is escaped.

## Storage and rollout

Integrated schema version 8 adds JRS_INTERVIEW_ASSESSMENT, keyed to the original interview, within the original feedback transaction. Its criteria snapshot is immutable. The adapter enriches loaded workspace snapshots without changing the teammate's original table schema. Historical feedback without criteria remains valid and receives no fabricated scores.

Run node scripts/migrate-application-snapshot.mjs against the configured dedicated local database before restarting. The command now applies versions 7 and 8, is repeatable and does not reseed or delete records. The usual setup command handles fresh and older integrated databases. Only approved local dev/test schemas were migrated; cloud data and credentials were not changed. The standalone personal HR module remains separate; criteria persistence is an integrated-runtime adapter.

## Verification

Tests cover combined filters, 100-job paging and edit return, real parent links, preserved embedded actions, invalid/duplicate criteria, manual scores independent of criteria, escaped names, actual form add/remove/submit flow, ISO date forms/filters, and contained mobile table labels. Isolated MySQL tests verify reload persistence and transaction rollback when rewriting a recorded assessment is attempted.

Desktop and 390px browser checks used a temporary loopback-only in-memory fixture for scoring. The example was fictional and no mail was sent. The ordinary local workspace was checked for compact job/report controls and mobile overflow. Global reusable scoring templates and weighted scoring are not part of this implementation.
