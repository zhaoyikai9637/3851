# SJY demo data and submitted Word preview

Reviewed on 4 November 2026 against Junye_Shen_HR_Module_v2.6.2_Code_Handoff.zip.

## Imported demonstration data

The archive contains source seed data, not a database dump or uploaded resume files. The integrated seed, screening and requirement functions match the reviewed archive. The importer uses these existing integrated functions and verifies their fingerprints before generating the cohort.

The production import added 10 jobs, 115 fictional candidates, 115 applications, 24 completed interviews, 18 offer records and 4 in-app notifications. Each candidate has a generated sample PDF using the existing HR sample-resume template. These PDFs are fictional documents, not original attachments from the handoff. No login accounts or outgoing emails were created. Candidate and application links are created in the shared schema; public jobs use the existing bridge. Existing business records are checked unchanged inside the transaction before commit.

Production totals immediately after import: 60 jobs, 119 candidates, 116 applications and 25 interviews. Schema version remains 12. Existing job records, including their requirement text, were not overwritten.

## Repeating or reviewing the import

Run scripts/import-sjy-demo.mjs with --database=<exact configured database name> to preview. Adding --apply performs the insert-only transaction after writing a private business-data backup. Only explicit review or production configurations are accepted. The SJY262- prefix isolates this cohort. A complete existing cohort is a no-op, including records that have since progressed through the HR workflow. Partial cohorts, missing sample resumes and conflicting sample identities stop the import for review.

Backups are under .local/sjy-import-backups in the checkout running the command. They contain business data and must remain private. Do not submit .local, environment files or uploaded documents to GitHub. The script does not run automatically during startup or deployment.

## Submitted resumes

PDFs retain the existing protected inline viewer. Submitted DOCX files now have an authenticated text preview at GET /recruitment/api/hr/applications/:id/submitted-resume/preview. The original protected download is unchanged and preserves the original file bytes. Legacy DOC files remain download-only with an explanatory message. Text preview does not preserve Word layout, images or tables; download the original to see its formatting.

DOCX extraction runs in a bounded worker with a 15-second deadline, two-worker concurrency cap, 5 MB input cap, ZIP entry and expansion limits, and heap limits. Text and filenames are escaped, and the HTML response is no-store, sandboxed and disallows scripts or external resources. Files are read from existing private storage; nothing is uploaded to a document-viewing service. Corrupt or unsupported documents show a download fallback.

The native review toolbar retains Back to list, Next application and Application details. Back to list preserves the existing list context. Manual candidate PDF preview/download/print URLs now use the mounted /recruitment/api/hr route.

## Validation

- Complete project run: 766 passing tests (223 integrated, 69 login/profile, 26 applicant, 127 recruiting, 138 HR client, 183 HR server); production build and English check passed.
- Isolated MySQL: registration, reset code, session revocation, profile snapshots, upload, application submission, HR visibility, interview synchronization, withdrawal, and manual HR resume management passed.
- Real DOCX upload/submission: HR text preview, escaped markup, forbidden applicant access and byte-identical original download passed. Imported sample PDF endpoint returned PDF bytes.
- Edge at 1440 px and 390 px: DOCX text visible, Back to list functional, no horizontal overflow or page errors.
- Isolated and production imports committed successfully; a second preview requested zero additions in both databases.

The database additions are already present after import. DOCX preview and corrected manual PDF URLs require deployment of this code; source synchronization alone does not deploy it.
