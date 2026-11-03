# Retired job work arrangement

The final simplified product removes the entire job Work arrangement / Work mode field from user-facing surfaces. This includes On-site, Remote and Hybrid job metadata, the native HR job table and review facts, native fallback job-edit controls, and the standalone applicant display fallback. Guest and authenticated applicant job details share the updated component.

Employment type remains: Full-time, Part-time, Contract and Internship. Location, experience, salary, dates, job descriptions and application actions remain. Interview meeting format (Video, On-site, Phone) is a different business field and remains available.

Historical database values and API compatibility are retained. The current HR editor already preserves a hidden saved mode; the native fallback now also retains that value through a hidden input so editing cannot overwrite historical data accidentally. There is no schema migration, database deletion, or change to job publication/eligibility/application workflow. No CSS changes are required.

Validation includes native job-list/review regression checks, full project tests and builds, guest/applicant and integrated HR browser inspections, and the isolated MySQL workflow.
