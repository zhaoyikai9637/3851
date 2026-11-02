# Team Database Integration

Connection verified on 2026-10-06 using Si Huanjia's individual developer account and the supplied CA certificate. The verification queried schema metadata only; no shared records or tables were changed.

Local credentials are in `.env.team` and the certificate is `jrs-ca.pem`. Both are excluded from Git. Run `node server/config/check-team-database.js` from this project to repeat the read-only connection check.

The normal demo remains available. Do not activate the shared database for the application until the following schema and authentication contracts are agreed with the team.

| Applicant module | Shared database | Integration needed |
| --- | --- | --- |
| Jobs | JOB_POSITION: position_id, title, timestamps | Add or identify details, requirements, location, closing date, publication state and role questions. |
| Applicant identity | CANDIDATE: candidate_id, full_name, email | Login module must supply a verified candidate_id; do not assume account_id equals candidate_id. |
| Applications | APPLICATION: candidate_id, position_id, assigned_hr_user_id, current_status, dates | Agree HR assignment and status mapping; provide work experience, answers and resume associations. |
| Profile | No matching table | Add or identify education, language, contact and recruiter-availability storage. |
| Resumes | No matching table | Add or identify resume metadata and ownership storage. |

The current standalone Sequelize models use different table names and fields. Startup in team mode therefore stops before sync or seeding. The schema coordinator must review any migrations; do not use the migration account in the running backend.
