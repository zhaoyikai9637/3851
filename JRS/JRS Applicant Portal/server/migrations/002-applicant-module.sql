-- Applicant module extension for jrs_hr_module_dev_team, MySQL 8.4.
-- Apply once using the team's schema coordinator account.
-- Existing CANDIDATE, JOB_POSITION, APPLICATION and HR_USER tables are preserved.
-- MySQL DDL auto-commits: record each completed statement if execution stops.

CREATE TABLE APPLICANT_PROFILE (
  candidate_id INT NOT NULL PRIMARY KEY,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NULL,
  state_code VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  city_name VARCHAR(120) NOT NULL DEFAULT '',
  availability_status ENUM('AVAILABLE','CLOSED') NOT NULL DEFAULT 'CLOSED',
  retain_for_future BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_ap_profile_location CHECK (
    (country_code IS NOT NULL OR (state_code = '' AND city_name = ''))
    AND (city_name = '' OR state_code <> '')
  ),
  CONSTRAINT fk_ap_profile_candidate FOREIGN KEY (candidate_id) REFERENCES CANDIDATE(candidate_id),
  INDEX ix_ap_availability (retain_for_future, availability_status),
  INDEX ix_ap_profile_location (country_code, state_code, city_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_EDUCATION (
  education_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  institution VARCHAR(180) NOT NULL,
  qualification VARCHAR(180) NOT NULL,
  qualification_level ENUM('SECONDARY','CERTIFICATE','DIPLOMA','ASSOCIATE','BACHELOR','MASTER','DOCTORATE','OTHER') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  start_year SMALLINT UNSIGNED NOT NULL,
  graduation_year SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT ck_ap_education_years CHECK (start_year BETWEEN 1900 AND 2200 AND graduation_year BETWEEN start_year AND 2200),
  CONSTRAINT fk_ap_education_candidate FOREIGN KEY (candidate_id) REFERENCES CANDIDATE(candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_LANGUAGE (
  language_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  language ENUM('en','zh','ms','ta','hi','id','vi','th','ja','ko','fr','de','es','ar','pt','ru','bn','ur','fil','other') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  other_language VARCHAR(60) NOT NULL DEFAULT '',
  reading_level ENUM('Basic','Intermediate','Advanced','Native') NOT NULL,
  writing_level ENUM('Basic','Intermediate','Advanced','Native') NOT NULL,
  UNIQUE KEY uq_ap_language (candidate_id, language, other_language),
  CONSTRAINT ck_ap_other_language CHECK ((language = 'other' AND CHAR_LENGTH(TRIM(other_language)) > 0) OR (language <> 'other' AND other_language = '')),
  CONSTRAINT fk_ap_language_candidate FOREIGN KEY (candidate_id) REFERENCES CANDIDATE(candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_JOB_DETAILS (
  position_id INT NOT NULL PRIMARY KEY,
  assigned_hr_user_id INT NOT NULL,
  department VARCHAR(80) NOT NULL,
  location VARCHAR(100) NOT NULL,
  work_mode ENUM('HYBRID','REMOTE','ON_SITE') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  employment_type ENUM('FULL_TIME','PART_TIME') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  experience_level ENUM('YEARS_1_3','YEARS_3_5','YEARS_5_7') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  salary_range VARCHAR(80) NOT NULL DEFAULT '',
  summary VARCHAR(500) NOT NULL,
  responsibilities JSON NOT NULL,
  requirements JSON NOT NULL,
  preferred_qualifications JSON NOT NULL,
  benefits JSON NOT NULL,
  closing_date DATE NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ap_job_position FOREIGN KEY (position_id) REFERENCES JOB_POSITION(position_id),
  CONSTRAINT fk_ap_job_hr FOREIGN KEY (assigned_hr_user_id) REFERENCES HR_USER(user_id),
  INDEX ix_ap_job_open (is_open, closing_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_ROLE_QUESTION (
  position_id INT NOT NULL,
  question_key VARCHAR(80) NOT NULL,
  label VARCHAR(500) NOT NULL,
  input_type ENUM('short','long','select') NOT NULL,
  options JSON NULL,
  max_length SMALLINT UNSIGNED NOT NULL DEFAULT 600,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  placeholder VARCHAR(300) NOT NULL DEFAULT '',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (position_id, question_key),
  CONSTRAINT ck_ap_question_length CHECK (max_length BETWEEN 1 AND 600),
  CONSTRAINT fk_ap_question_position FOREIGN KEY (position_id) REFERENCES JOB_POSITION(position_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_RESUME (
  resume_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  stored_name VARCHAR(220) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ap_resume_storage (stored_name),
  UNIQUE KEY uq_ap_resume_owner (resume_id, candidate_id),
  CONSTRAINT fk_ap_resume_candidate FOREIGN KEY (candidate_id) REFERENCES CANDIDATE(candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_APPLICATION_DETAILS (
  application_id INT NOT NULL PRIMARY KEY,
  candidate_id INT NOT NULL,
  position_id INT NOT NULL,
  resume_id INT NOT NULL,
  phone VARCHAR(30) NOT NULL,
  country_code CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state_code VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  city_name VARCHAR(120) NOT NULL DEFAULT '',
  cover_letter VARCHAR(1500) NOT NULL DEFAULT '',
  status_message VARCHAR(500) NOT NULL DEFAULT '',
  declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  declaration_accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ap_candidate_position (candidate_id, position_id),
  INDEX ix_ap_application_location (country_code, state_code, city_name),
  CONSTRAINT ck_ap_application_location CHECK (city_name = '' OR state_code <> ''),
  CONSTRAINT fk_ap_details_application FOREIGN KEY (application_id) REFERENCES APPLICATION(application_id),
  CONSTRAINT fk_ap_details_candidate FOREIGN KEY (candidate_id) REFERENCES CANDIDATE(candidate_id),
  CONSTRAINT fk_ap_details_position FOREIGN KEY (position_id) REFERENCES JOB_POSITION(position_id),
  CONSTRAINT fk_ap_details_resume FOREIGN KEY (resume_id, candidate_id) REFERENCES APPLICANT_RESUME(resume_id, candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_WORK_EXPERIENCE (
  experience_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  company_name VARCHAR(120) NOT NULL,
  job_title VARCHAR(120) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  current_role BOOLEAN NOT NULL DEFAULT FALSE,
  responsibilities VARCHAR(1200) NOT NULL,
  achievements VARCHAR(1000) NOT NULL DEFAULT '',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT ck_ap_experience_dates CHECK ((current_role = TRUE AND end_date IS NULL) OR (current_role = FALSE AND end_date IS NOT NULL AND end_date >= start_date)),
  CONSTRAINT ck_ap_month_precision CHECK (DAYOFMONTH(start_date) = 1 AND (end_date IS NULL OR DAYOFMONTH(end_date) = 1)),
  CONSTRAINT fk_ap_experience_application FOREIGN KEY (application_id) REFERENCES APPLICANT_APPLICATION_DETAILS(application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_WORK_SKILL (
  experience_id INT NOT NULL,
  skill_name VARCHAR(60) NOT NULL,
  PRIMARY KEY (experience_id, skill_name),
  INDEX ix_ap_skill_name (skill_name, experience_id),
  CONSTRAINT ck_ap_skill_name CHECK (CHAR_LENGTH(TRIM(skill_name)) BETWEEN 1 AND 60),
  CONSTRAINT fk_ap_work_skill_experience FOREIGN KEY (experience_id)
    REFERENCES APPLICANT_WORK_EXPERIENCE(experience_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE APPLICANT_ROLE_ANSWER (
  application_id INT NOT NULL,
  question_key VARCHAR(80) NOT NULL,
  question_label VARCHAR(500) NOT NULL,
  answer VARCHAR(600) NOT NULL,
  PRIMARY KEY (application_id, question_key),
  CONSTRAINT fk_ap_answer_application FOREIGN KEY (application_id) REFERENCES APPLICANT_APPLICATION_DETAILS(application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Runtime contract:
-- Insert APPLICATION and APPLICANT_APPLICATION_DETAILS in the same transaction.
-- candidate_id and position_id must equal the corresponding APPLICATION values.
-- Lock the CANDIDATE row before checking active applications to serialize submissions.
-- Application status remains in APPLICATION.current_status for shared HR visibility.
-- Save question labels as submission snapshots so later HR edits do not change answers.
-- Convert UI employment YYYY-MM values to the first day of that month.
-- Split the validated location tuple into country_code, state_code and city_name.
-- Insert one cleaned, case-insensitively deduplicated APPLICANT_WORK_SKILL row per added skill, with a maximum of 50 per experience.
-- Store declaration_accepted and declaration_accepted_at with each submitted application.
-- Validate country/state/city and E.164 phone with the application catalog before insertion.
-- Do not insert demonstration jobs or candidates into the shared database.
