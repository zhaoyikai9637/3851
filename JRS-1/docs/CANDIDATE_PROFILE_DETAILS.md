# Candidate current profile and submitted information

## Presentation

The existing candidate card uses two sections: Current personal profile and Submitted application & history. Current information includes name, contact details, personal summary, career history, education, licences/certifications, skills and reading/writing languages. HR views it read-only. Private recruitment notes, tasks and application history remain separate from applicant-maintained facts.

The application section and resume-review page display the selected application's captured personal information and selected resume. Their identity header uses the submitted name. The current profile can change after applying; the saved submission does not change with it. Existing applicant-owned profile/resume write restrictions remain enforced.

## Loading and access

GET /recruitment/api/hr/candidates/:id/profile returns currentProfile and an applications array containing each application ID, profileDetails and submittedAt. It requires an active shared HR session and an application record for that candidate. Applicant sessions cannot read this endpoint. Only allowlisted personal fields are returned; account credentials, account IDs and file storage keys are not included.

The full details are read only when a candidate/review/results page opens. Dashboard and candidate list snapshots are not expanded into every person's full history. Page changes reload current details; failed reads show a retry action instead of inventing empty records. Responses use Cache-Control: no-store and the browser keeps them only in the active workspace memory.

## Capture and older records

New applications add profileDetails to the existing applicant_snapshot JSON in the same transaction as submission, after submitted contact/career values are saved. Existing schema 12 is sufficient; no table migration or production data rewrite is required.

Older snapshots did not contain personal summary, certifications or global skills. Their UI explicitly labels those fields as not captured. Available historical education, career, language and contact values remain readable. Current information is never copied into an older application to fill missing history. Manual HR-intake records without an applicant snapshot show that no submitted personal profile was recorded.

## Verification

The isolated real-MySQL workflow saves all profile sections, submits an application, then changes name, summary, career, education, certifications, skills and languages through the applicant APIs. HR currentProfile reflects the edits; the complete submitted profile remains byte-equivalent as JSON. It also checks applicant access denial and rejection before any application exists.

Full project verification passed 747 unit/API tests, both frontend production builds and the English source check. Edge desktop (1280x900) and narrow (390x844) checks exercised both card sections, all fields, readonly actions, long-text/skill wrapping and absence of horizontal overflow. Login/profile Jest tests now run one file per process to avoid the host Node/Jest VM cross-file crash; assertions and full counts are retained, with no automatic failure retries.
