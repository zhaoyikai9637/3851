# Structured Applicant Data

Date: 2026-10-26
Owner: Si Huanjia

## Implemented in the standalone applicant portal

- Phone entry separates a country calling code from the national number. The API validates it with `libphonenumber-js` and stores E.164 (for example, `+6581234567`), never a locally formatted variant.
- Location is selected from country, state/province and city catalogs in stages. The API checks that each selected part belongs to its parent. The standalone model stores a validated JSON tuple such as `["US","CA","Los Angeles"]`; no comma-splitting or free-text location search is needed.
- Applicants add skills one at a time, with a maximum of 50 per work experience. The API trims whitespace, validates length and safe characters, applies preferred casing to common technical terms, removes case-insensitive duplicates, and stores a sorted array such as `["React","SQL","Stakeholder engagement"]`.
- Employment dates use year/month selectors and `YYYY-MM` values. Current jobs have no end month. The server rejects invalid months, future dates, reversed ranges and inconsistent current-role flags. Work duration counts inclusive calendar months and merges overlapping jobs; it is not a full-time-equivalent measure.
- Education uses a controlled qualification level and numeric study years. Language uses controlled codes and separate reading/writing levels. Start availability and other role-specific select answers must match the vacancy's choices.
- Submission requires an applicant declaration. The application stores whether it was accepted and the acceptance time so the HR workflow has an audit record.
- Company names, job titles, school names, qualification titles, responsibilities and achievements remain bounded descriptive text. They are not silently mapped to a made-up catalog; the current schema does not promise exact analytical grouping for those fields.

## Proposed shared MySQL storage

`server/migrations/002-applicant-module.sql` is prepared but **not deployed**. It stores country, state and city in separate indexed columns on profiles and applications. Work skills use `APPLICANT_WORK_SKILL`, one cleaned name per row, with an index on `skill_name`. Work dates are `DATE` columns using the first day of each selected month; education years are integers. `003-flexible-skills-and-declaration.sql` upgrades an installation that already used the earlier fixed-skill schema.

The future shared-database adapter must split the validated location tuple into those columns, convert `YYYY-MM` to month-start `DATE`, and insert selected skills into the association table in the same application transaction. The standalone Sequelize/demo storage still uses validated JSON for experiences, education and languages; it is not yet the shared MySQL runtime adapter.

Read-only query examples are in `server/queries/applicant-filters.sql` (location and skill) and `server/queries/experience-months.sql` (minimum distinct calendar months). Neither query has run against the shared database because the applicant tables are not deployed. Old free-text skill data needs explicit trimming, validation and case-insensitive deduplication before migration.

## Verification and limits

- `npm test`: 26 passed, 0 failed, in isolated demo mode.
- `npm run build`: passed. Vite reports a non-fatal warning about a JavaScript chunk over 500 kB.
- Browser preview still requires a final manual pass for the new add-skill control, role-question validation, Review edit buttons, and declaration checkbox.
- No shared MySQL schema or records were changed. The individual developer account has no `CREATE`/`ALTER` privilege; deployment and the shared login identity mapping remain integration tasks.
