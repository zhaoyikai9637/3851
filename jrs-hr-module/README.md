# HR Communication and Profile Module

React/Vite/Bootstrap frontend and Express/Sequelize/MySQL backend for Notification Center,
Email Templates, email history, account menu and HR profile.
Recruitment operations belong to the team modules rather than a second implementation here.

In the integrated JRS project, use the parent startup and shared login.
Standalone configuration and historical integration notes are separate; see docs/HANDOFF.md and docs/PLAN.md.

## Standalone setup

Use Node.js 24 and the committed lockfile. Run npm.cmd ci from this module.
Create private environment files from server/.env.example or server/.env.team.example.
Check the database target before running migrations or seeds.
Do not overwrite an existing schema or use sync force/alter.
npm.cmd run dev starts the frontend and backend; opening Vite alone does not provide authentication APIs.
start-api.cmd starts only the API when an existing frontend is already running.

Production/team mode requires a trusted identity adapter.
Standalone development may explicitly enable an existing active HR through DEV_HR_USER_ID.
That entry is unavailable in production/team mode and is not a replacement login system.
See docs/TEAM_AUTH.md.

## Checks and data

Use the scripts in package.json for frontend/backend tests, isolated MySQL tests, Jest,
OpenAPI export/checks and production builds. Record actual output and untested boundaries.
Jest reports cover their declared files, not the whole project.

Templates, notification read state, profile changes, photos and sent-message snapshots persist in MySQL.
Keep uploads private and authorize downloads on the server.
SMTP remains disabled unless explicitly configured and authorized.
A Sent status records provider acceptance, not inbox delivery.

See docs/TEMPLATE_TYPES.md, docs/INTEGRATION.md, docs/API_TESTING.md,
docs/TEAM_DEVELOPMENT.md and docs/DEPENDENCIES.md for relevant contracts.
Never commit reference material, credentials, environment files, uploads, work artifacts or dependencies.
