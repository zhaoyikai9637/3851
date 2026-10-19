# Local Setup

Open the directory containing this module's package.json in VS Code.
Use Node.js 24, MySQL Server and the committed dependency lockfile.
Workbench alone is not the database service.

For the integrated JRS application, follow the parent README and use its shared sign-in entry.
For a standalone checkout, follow this module's README and configure a dedicated local database.
Do not import old reference SQL, reset an existing schema or copy credentials into source files.
Run npm.cmd run dev for both services; Vite alone cannot serve authentication APIs.
If only the API is missing, start-api.cmd launches it without starting another frontend.

Read docs/HANDOFF.md for actual implementation state and docs/PLAN.md for outstanding work.
Use fresh tests/build output rather than previous chat history or old screenshots as verification.
Private configuration and local database contents do not travel with a Git clone.
