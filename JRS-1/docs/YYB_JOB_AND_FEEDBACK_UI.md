# YYB job posting and interview UI restoration

Date: 2026-11-08

## Requested behavior

Restore the teammate job-management, job-editor, interview-list and competency-assessment presentation within the integrated HR shell. Preserve shared authentication, APIs, revisions, role checks, immutable application snapshots and the existing email workflow. The reference remains read-only; its standalone server, fake identities, deletion actions and native date controls are not imported.

- Use Job posting and Add posting; retain the single top breadcrumb without a duplicate content title or bottom back link.
- Restore separate job title, department, employment type, applicant count and status columns. Keep result counts at bottom left and existing pagination/application links.
- Replace salary typing with fixed SGD ranges. Preserve an existing stored range as an option when editing.
- Remove the editor Status row and multiple save/publish buttons. The single Save creates Draft for a new posting and preserves the current state for existing postings.
- Retain current English DD MM YYYY date entry and calendar, required experience/skills, requirement templates, validation and dirty-edit confirmation.
- Use Arrange interview, restore the teammate interview-list columns and keep scheduling/rescheduling/cancellation commands and timing rules.
- Restore a full Interview feedback page at /hr/interviews?feedback=<interviewId>, reachable from the existing interview details and application assessment actions. It uses the selected candidate and interview, not static reference data.
- Restore star ratings, named New assessment additions, comments and recommendation radio buttons. Adding an assessment has no success reminder. Preserve integrated integer 1–5 validation, required overall rating and existing Proceed/Hold/Reject command values.
- A feedback URL cannot expose an editable form for a missing, early, completed or cancelled interview, an application outside Interview, or an inactive job. Existing backend rules remain authoritative.

## Verification

- HR frontend: 191/191 Vitest cases passed, including single draft Save, existing status/range preservation, conflicts, English dates, dirty breadcrumbs, feedback routing, custom assessments and the early-feedback guard.
- Integrated server: 236/236 Node tests passed.
- Recruiting backend/API: 132/132 passed.
- HR communication backend/API: 183/183 passed.
- Both Vite production builds passed; the applicant build retains its existing chunk-size advisory.
- English check: 633 files, zero issues.
- review:verify passed registration, captured recovery codes, roles, protected resumes, immutable/current profile separation, applicant submission, HR synchronization and withdrawal against the isolated local MySQL instance.
- Headless Microsoft Edge at 1440 and 390 pixels verified table columns, breadcrumb, one Save, salary choices, English calendar, real SQL draft storage and feedback submission to Interview Results. Custom assessment stars and radios persisted through the production command. No page errors or horizontal page overflow were observed.

Evidence is private under .local/yyb-restore-20261108. Browser fixtures use only the owned jrs_review_local database. Past interview dates were set only for newly created isolated test fixtures, enabling an actual end-to-end feedback submission. No real email was sent, and no production schema/data or Render configuration was changed.
