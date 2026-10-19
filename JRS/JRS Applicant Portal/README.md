# JRS Applicant Portal

This project is the applicant-side module for one company's Job Recruitment System. Account registration and credential login belong to another team member and are connected through the contract in [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md).

## Two applicant experiences

### Public website

No account is required to:

1. Search and filter the company's open roles at `/jobs`.
2. Read responsibilities, requirements, benefits, and closing dates at `/jobs/:jobId`.
3. Select **Sign in to apply**, which hands control to the team's authentication module.

### Signed-in applicant workspace

An authenticated applicant can:

1. Manually check essential requirements for one suitable role.
2. Submit one focused application with detailed work experience and role-specific answers.
3. Upload and manage any number of resume files on the dedicated `/applicant/resume/upload` page.
4. Choose whether recruiters may retain and search the profile for future vacancies.
5. Follow the current application's progress or withdraw it.

The applicant dashboard and automatic fit percentage are intentionally excluded because they do not support this focused workflow.

## Technology

| Area | Technology | Use in this project |
| --- | --- | --- |
| Frontend | React, JavaScript, HTML through JSX | Public vacancy pages and applicant workspace |
| Styling | CSS and Bootstrap | Responsive layout, controls, spacing, and colour |
| Build tool | Vite | Frontend development and production build |
| API client | Axios | REST requests with session cookies |
| Backend | Node.js and Express | Business APIs and access-control boundary |
| API format | REST and JSON | Frontend/backend data exchange |
| Database | Sequelize and MySQL | Jobs, applicant profiles, resumes, and applications |
| Auth integration | Express Session and HttpOnly Cookie | Consume the session created by the team's login module |
| Validation | express-validator | Server-side formats and character limits |
| Security | Helmet and CORS | HTTP headers and approved frontend origins |

This module does not contain an email/password form, password hashing, account registration, or credential verification.

## Project structure

```text
jrs-applicant-portal/
|-- client/                         # React applicant interface
|   |-- assets/
|   |   |-- css/styles.css          # Shared responsive styles
|   |   `-- images/                 # Frontend image assets
|   |-- api/                        # Axios REST client
|   |-- components/                 # Shared layouts and route guards
|   |-- context/                    # Applicant session state
|   |-- pages/                      # Pages grouped by applicant task
|   |   |-- auth/                   # Authentication handoff and callback
|   |   |-- jobs/                   # Job search and role details
|   |   |-- application/            # Application form and status
|   |   |-- resume/                 # Profile and resume upload
|   |   `-- not-found/              # Unknown route page
|   |-- App.jsx                     # Frontend routes
|   |-- main.jsx                    # React entry point
|   |-- index.html
|   |-- package.json
|   `-- vite.config.js
|-- server/                         # Node.js and Express API
|   |-- config/                     # Database configuration
|   |-- data/                       # Demo/MySQL data access
|   |-- middleware/                 # Authentication, validation, errors
|   |-- models/                     # Sequelize models
|   |-- routes/                     # REST routes by resource
|   |-- test/                       # API unit tests
|   |-- app.js                      # Express application setup
|   |-- server.js                   # API entry point
|   `-- package.json
|-- uploads/                        # Runtime resume files; contents ignored by Git
|-- SiHuanjia/                      # Individual reports only
|-- .env.example                    # Shared environment template
|-- .gitignore
|-- package.json
`-- README.md
```

## Run the local demonstration

Node.js is required. From this folder:

    npm install
    npm run dev

Open the public website at http://127.0.0.1:5173/jobs.

To demonstrate the private interface before the team login module is connected, select **Sign in**, then **Preview signed-in pages**. This preview creates a session only in local demo mode and is unavailable in production.

The frontend runs on port `5173`, this module's API runs on port `3001`, and port `3002` is reserved for the team login interface.

## Use MySQL

1. Install and start MySQL Server.
2. Create the database:

    CREATE DATABASE jrs_applicant_portal
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci;

3. Copy `.env.example` to `.env` in the project root.
4. Set `DB_MODE=mysql` and enter the MySQL username and password.
5. Run `npm run dev` again.

Sequelize creates the applicant module tables and inserts demonstration vacancy data when the database is empty. The final group integration must use the same user identifiers as the authentication module.

## Useful commands

    npm run dev
    npm run build
    npm test

## Software checklist

| Software | Status | Purpose |
| --- | --- | --- |
| Visual Studio Code | Required | Edit client, server, and tests |
| Node.js LTS | Required | Run Express, Vite, and npm |
| Chrome or Edge | Required | Run and debug both interfaces |
| MySQL Server | Required for persistent mode | Store project data |
| MySQL Workbench | Recommended | Inspect tables and run SQL |
| Postman | Recommended | Test REST endpoints manually |
| Git | Required | Version control |
| GitHub | Recommended | Team sharing and code review |
| Figma | Already used | Review the original page designs |
