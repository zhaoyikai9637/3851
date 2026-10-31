# Candidate test data

`scripts/seed-candidates.js` adds three fictional candidates and their profile details to the database configured in the existing environment files. Names, companies and education records are fictional. Emails use the reserved `.test` domain. Passwords are random and bcrypt-hashed; the script sends no mail.

Run `node scripts/seed-candidates.js` to check schema without writing. To import into the team database, run:

```powershell
node scripts/seed-candidates.js --apply --database=jrs_hr_module_dev_team
```

Import creates 3 MODULE_ACCOUNT rows, 3 CANDIDATE rows, 3 CAREER_HISTORY rows, 3 EDUCATION rows, 3 CERTIFICATION rows, 12 SKILL rows and 6 LANGUAGE rows (33 rows in total). Existing emails are skipped without changing any records. All database inserts run in one transaction and section counts are verified before commit. The script does not create or migrate tables.

Test passwords and imported IDs are stored under the ignored `.local-backup/seed-candidates/` directory. On repeat imports, skipped accounts retain their original password; consult the earlier successful import's credentials file. Do not commit or share credential files.

Sessions and password-reset records are created by actual login and recovery flows. Resume metadata requires an actual uploaded file, so it is not fabricated by this importer. Existing presentation-only Jobs/My Resume/Status pages still use their own static team data; imported candidate details appear in the real Profile page after signing in with a test account.


Current status: candidate migration and three fictional candidate profiles were imported with authorization. Login and full Profile reads passed real cloud/API/browser verification. Passwords are provided privately by the maintainer.
