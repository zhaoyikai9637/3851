-- Apply this migration only if 002-applicant-module.sql was already deployed.
-- It preserves existing skill values while allowing applicants to add their own skills.

ALTER TABLE APPLICANT_WORK_SKILL
  DROP CHECK ck_ap_skill_code,
  DROP INDEX ix_ap_skill_code,
  DROP PRIMARY KEY,
  CHANGE COLUMN skill_code skill_name VARCHAR(60) NOT NULL,
  ADD PRIMARY KEY (experience_id, skill_name),
  ADD INDEX ix_ap_skill_name (skill_name, experience_id),
  ADD CONSTRAINT ck_ap_skill_name CHECK (CHAR_LENGTH(TRIM(skill_name)) BETWEEN 1 AND 60);

ALTER TABLE APPLICANT_APPLICATION_DETAILS
  ADD COLUMN declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE AFTER status_message,
  ADD COLUMN declaration_accepted_at DATETIME NULL AFTER declaration_accepted;
