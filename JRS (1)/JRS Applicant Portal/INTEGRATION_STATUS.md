# Applicant module integration status

The 2026-10-28 teacher-review update has been integrated into the shared project.
See ../docs/TEAM_UPDATE_20261028.md for source provenance, adopted removals,
schema 12, authentication compatibility and verification results.

The integrated server uses the existing explicit applicant feature switch. Local
preview enables it; production remains gated separately. Shared sign-in, personal
profile, resume ownership, CSRF and HR synchronization stay authoritative. Use the
parent build/start commands and root dependency lockfile for the total project.
Standalone module SQL must not be run on the integrated database.
