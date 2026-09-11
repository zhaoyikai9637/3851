# JRS HR Module — Commands and Local URLs

Run commands from PowerShell in the project root unless stated otherwise.

## 1. Open the project

```powershell
Set-Location 'E:\textProject\jrs-hr-module'
```

Open this folder in VS Code. Do not open only `client` or `server`.

## 2. Check required software

```powershell
node --version
npm.cmd --version
git --version
Get-Service MySQL267
```

Expected local environment previously verified: Node.js 24.x, npm 11.x and a running MySQL service named `MySQL267`.

## 3. Install dependencies

Use this only on a new machine or when `node_modules` is missing:

```powershell
npm.cmd ci
```

Never commit `node_modules`, `.env`, uploaded files or local caches.

## 4. Start frontend and backend together

```powershell
npm.cmd run dev
```

Keep the terminal open. Stop both development services with `Ctrl+C`.

Local URLs:

- Frontend: <http://localhost:5173>
- Fictional UI demo: <http://localhost:5173/notifications?demo=1>
- API health: <http://localhost:5173/api/health>
- Swagger UI: <http://localhost:5173/api/docs/>
- OpenAPI JSON: <http://localhost:5173/api/openapi.json>
- Express API directly: <http://127.0.0.1:3001>
- MySQL: `127.0.0.1:3306`

The fictional UI demo is browser-only and does not read or write MySQL. Protected real API routes return `401` until the teammate-owned sign-in is integrated.

## 5. Start one service only

Frontend only:

```powershell
npm.cmd run dev -w client
```

Backend only:

```powershell
npm.cmd run dev -w server
```

Production-style backend after building the frontend:

```powershell
npm.cmd run build
npm.cmd start
```

## 6. Database commands

The dedicated databases are already created and initialized. Do not run setup again for ordinary development.

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run test:mysql
```

- Development database: `jrs_hr_module_dev_20260908`
- Test database: `jrs_hr_module_test_20260908`
- Local credentials belong only in `server/.env` and `server/.env.test`.
- Never run the legacy SQL, `sync({ force: true })`, `sync({ alter: true })`, `DROP DATABASE` or `TRUNCATE`.

Safe read-only MySQL Workbench examples:

```sql
USE `jrs_hr_module_dev_20260908`;
SHOW TABLES;
SELECT * FROM `HR_USER` LIMIT 20;
SELECT * FROM `SYSTEM_NOTIFICATION` LIMIT 20;
SELECT * FROM `EMAIL_TEMPLATE` LIMIT 20;
SELECT * FROM `NOTIFICATION_LOG` LIMIT 20;
SELECT * FROM `NOTIFICATION_ATTACHMENT` LIMIT 20;
```

## 7. Tests and verification

```powershell
npm.cmd test
npm.cmd run test:mysql
npm.cmd run build
npm.cmd run docs:check
npm.cmd run docs:export
```

Targeted frontend test:

```powershell
npm.cmd run test -w client
```

Targeted backend test:

```powershell
npm.cmd run test -w server
```

See `docs/VERIFICATION.md` for dated results and testing boundaries. Do not present historical results as a new run.

## 8. Swagger and Postman

Import into Postman:

```text
docs/JRS-HR.postman_collection.json
docs/JRS-HR.postman_environment.example.json
```

The Postman environment intentionally contains no real credentials. Swagger examples are fictional. Read `docs/API_TESTING.md` before running protected or write operations.

## 9. Configuration safety

Copy examples only when creating a new local environment:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item server/.env.test.example server/.env.test
```

Then set local values without committing or sharing them. Email remains disabled by default with `MAIL_MODE=preview` and `MAIL_ALLOW_SMTP=false`.

## 10. Main npm scripts

| Command | Purpose |
|---|---|
| `npm.cmd run dev` | Start API and Vite frontend |
| `npm.cmd run build` | Build the React frontend |
| `npm.cmd start` | Start the Express server |
| `npm.cmd test` | Run backend and frontend tests |
| `npm.cmd run test:mysql` | Run isolated real-MySQL tests |
| `npm.cmd run db:migrate` | Apply pending versioned migrations |
| `npm.cmd run db:seed` | Seed approved fictional development data |
| `npm.cmd run docs:check` | Validate OpenAPI structure and examples |
| `npm.cmd run docs:export` | Export OpenAPI and Postman files |

