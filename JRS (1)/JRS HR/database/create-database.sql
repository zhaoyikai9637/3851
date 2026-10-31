-- Optional Workbench entry point. npm run db:init performs this automatically.
CREATE DATABASE IF NOT EXISTS jrs_hr_fullstack
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jrs_hr_fullstack;
-- After this, open schema.sql in Workbench and execute it in this schema.
-- Use npm run db:init to create the password-hashed HR login account.
