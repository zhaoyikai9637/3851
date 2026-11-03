# Local code and workflow review

Use this guide for independent code inspection and local functional testing. The integrated project is the repository's JRS-1 directory. Do not follow the older standalone module setup guides for this task.

## Requirements

- Node.js 24.x, with npm.
- MySQL Community Server 8 or newer installed on the machine. MariaDB is not supported by this setup.
- Available local ports 3200 (website) and 33307 (isolated MySQL).
- Internet access for the initial npm dependency installation only.

Windows setup searches PATH and the MySQL directories under Program Files. If it cannot find the server executable, set its actual path in PowerShell before setup:

    $env:MYSQLD_PATH = 'C:\your-installed-mysql\bin\mysqld.exe'

The script starts its own MySQL instance. An existing Windows MySQL service does not need to be stopped. Run all commands below in the JRS-1 root containing package.json. Extract the project into a normal directory, such as E:\JRS-review; avoid hidden dot-prefixed parent directories.

## First start

    npm ci
    npm run review:setup
    npm run review:start

Wait for the startup message, then open http://localhost:3200 in Edge. The first start builds the two React frontends if their build outputs are missing. Keep the terminal open while using the site. Do not open the HTML files with Live Server or file://.

Setup creates schema 12, three fictional published jobs, ten communication templates, two applicant accounts, an HR manager and an HR staff account. Passwords are generated separately for each checkout. To display your local accounts in another terminal:

    npm run review:accounts

You can also register an applicant through the website. Use fictional addresses ending in example.test.

## Email and file testing

All recovery codes and HR emails are captured locally. No mail is delivered to the address entered, including a real address. Read captured messages with:

    npm run review:mailbox

Use the four-digit code from the latest recovery message. This tests the reset workflow without QQ, Mailjet or another external provider. Email attachments are recorded as metadata in the mailbox; uploaded resumes remain in the private local upload directory. Actual provider delivery and cloud object storage require separate deployment acceptance.

## Automated verification

    npm run review:check
    npm run review:verify
    npm test
    npm run build

review:verify uses the real isolated MySQL database and the application APIs. It creates a new fictional applicant on each run, changes its password through a captured code, uploads a PDF, submits an application, confirms HR access, schedules an interview, verifies applicant status and withdraws the application. Results are written to .local/review/verification.json. These verification records are retained for inspection; the four initial accounts keep their original passwords. The command does not reset the database. See REVIEW_CHECKLIST.md for manual and remaining workflow checks.

## Stop and resume

Stop the web terminal with Ctrl+C, then run:

    npm run review:stop

This shuts down only the verified MySQL instance in this checkout. Existing system services and other project databases are not stopped. Run review:start to resume; repeat review:setup is also safe for a completed setup and retains records. Do not run multiple copies at once because the isolated ports are fixed.

## Private generated files

.env.review and .local/review are generated locally and ignored by Git. They contain local database credentials, account passwords, uploaded files and captured reset codes. Do not upload or redistribute them. Share source code and the lockfile; each reviewer runs setup to generate their own environment. No Aiven, Supabase, Render or Mailjet credentials are required.

## Troubleshooting

- Node version error: select Node.js 24, reopen the terminal, then check node --version.
- Missing MySQL executable: install MySQL Community Server and set MYSQLD_PATH to its executable. Installing only Workbench or a command-line client is insufficient.
- Port already in use: stop this review site and run review:stop from the checkout that owns the running reviewer database. The setup refuses a foreign instance rather than overwriting it.
- Incomplete setup: inspect .local/review/mysql.log and report the failing command. An unknown or partially initialized database is retained for inspection; it is never automatically erased.
- Missing assets after editing source: run npm run build and restart review:start.
- Connection refused: keep review:start running and use port 3200. The production onrender.com URL is a separate environment.

This local environment validates local integration. It does not reproduce Render cold starts, Aiven latency, cloud storage failures or real email delivery. Windows is the primary supported and verified setup platform.

## Verification record (3 November 2026)

Verified on Windows with Node.js 24.16.0 and MySQL Community Server 26.7.0: a clean source-only export installed 695 packages with npm ci, created a fresh isolated schema-12 database and passed review:check and review:verify. The four initial accounts remained separate from generated verification applicants. HTTP checks passed for readiness, public jobs, login and all three recovery pages, both frontend asset sets, applicant profile and the authenticated HR workspace.

Regression results: root Node tests 190, HR client Vitest tests 136, communication backend/API Vitest tests 183 and native recruiting Node tests 125 passed (634 tests). The HR frontend suite was rerun successfully from the clean export with --pool=threads after the original deep-path working copy encountered a worker startup timeout. Frontend builds and the English source check passed. Email delivery, cloud failure behavior, and the full manual checklist are outside this local verification record.

Candidate policy acceptance also checks that registrations stay absent from HR until application submission, applicant-owned profile/resume writes are rejected in HR, legacy registration-only records remain hidden without deletion, and manual intake editing/upload still works. See CANDIDATE_VISIBILITY.md.

The real workflow also saves all profile sections before applying and edits them afterward: current HR information changes, while the submitted profile stays fixed. Full detail reads occur only on the corresponding candidate/application pages.
