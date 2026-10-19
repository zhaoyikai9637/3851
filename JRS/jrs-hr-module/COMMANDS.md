# Development commands

Run these commands from the project root.

| Command | Purpose |
| --- | --- |
| `npm.cmd install` | Install workspace dependencies |
| `npm.cmd run db:migrate` | Apply reviewed migrations to the confirmed development database |
| `npm.cmd run db:seed` | Create the local HR profile and default templates without overwriting edits |
| `npm.cmd run dev` | Start the API and web application |
| `npm.cmd test` | Run server and client unit tests |
| `npm.cmd run test:jest` | Run Jest and refresh the unit-test report |
| `npm.cmd run test:mysql` | Run the opt-in MySQL integration suite |
| `npm.cmd run build` | Build the production client |
| `npm.cmd run lint` | Lint the notification refactor scope with Biome |
| `npm.cmd run format:check` | Verify formatting for the notification refactor scope |
| `npm.cmd run docs:export` | Refresh OpenAPI and Postman artifacts |
| `npm.cmd run docs:check` | Validate documentation artifacts |

Local URLs:

- Application: <http://localhost:5173/notifications>
- API health: <http://127.0.0.1:3001/api/health>
- API documentation: <http://127.0.0.1:3001/api/docs>

When `DEV_HR_USER_ID` is configured in a local standalone development environment, use `Continue locally` on the access page. This temporary entry is rejected in production and team mode.
