-- MySQL 8.0.16+; InnoDB; utf8mb4. Applied to DB_NAME by npm run db:init.
-- No DROP, TRUNCATE, or destructive resets. All dates/times are documented in README.
CREATE TABLE IF NOT EXISTS hr_workspace (
 id TINYINT PRIMARY KEY, revision INT UNSIGNED NOT NULL DEFAULT 0,
 created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL, CHECK (id = 1)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_user (
 id VARCHAR(96) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(256) NOT NULL, name VARCHAR(100) NOT NULL,
 role ENUM('HR_MANAGER','HR_STAFF') NOT NULL, status ENUM('Active','Disabled') NOT NULL DEFAULT 'Active',
 employee_id VARCHAR(40) NOT NULL UNIQUE, department VARCHAR(100) NOT NULL DEFAULT 'Human Resources',
 phone VARCHAR(40) NOT NULL DEFAULT '', office_location VARCHAR(100) NOT NULL DEFAULT '',
 created_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_session (
 token_hash CHAR(64) PRIMARY KEY, user_id VARCHAR(96) NOT NULL, csrf_token VARCHAR(64) NOT NULL,
 expires_at BIGINT NOT NULL, FOREIGN KEY (user_id) REFERENCES hr_user(id), INDEX (expires_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_login_limit (
 bucket CHAR(64) PRIMARY KEY, attempts INT NOT NULL, reset_at BIGINT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_job_position (
 id VARCHAR(96) PRIMARY KEY, title VARCHAR(100) NOT NULL, department VARCHAR(100) NOT NULL,
 employment_type ENUM('Full-time','Part-time','Contract','Internship') NOT NULL,
 location VARCHAR(100) NOT NULL, work_mode ENUM('On-site','Hybrid','Remote') NOT NULL,
 experience VARCHAR(100) NOT NULL, education VARCHAR(150) NOT NULL,
 status ENUM('Active','Draft','Closed') NOT NULL, description TEXT NOT NULL,
 skills JSON NOT NULL, requirements JSON NOT NULL, created_at VARCHAR(30) NOT NULL, INDEX (status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_candidate (
 id VARCHAR(96) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 phone VARCHAR(40) NOT NULL, location VARCHAR(100) NOT NULL, experience DECIMAL(4,1) NOT NULL,
 education VARCHAR(150) NOT NULL, skills JSON NOT NULL, notes TEXT NOT NULL, created_at VARCHAR(30) NOT NULL,
 CHECK (experience >= 0 AND experience <= 70)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_application (
 id VARCHAR(96) PRIMARY KEY, candidate_id VARCHAR(96) NOT NULL, job_id VARCHAR(96) NOT NULL,
 stage ENUM('Pending Review','Interview','Interview Results','Offer','Rejected','Hired') NOT NULL,
 applied_date DATE NOT NULL, priority ENUM('High','Normal') NOT NULL,
 rejection_reason VARCHAR(500) NOT NULL DEFAULT '', rejection_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
 created_at VARCHAR(30) NOT NULL,
 FOREIGN KEY (candidate_id) REFERENCES hr_candidate(id), FOREIGN KEY (job_id) REFERENCES hr_job_position(id),
 UNIQUE KEY candidate_job (candidate_id,job_id), INDEX (stage,applied_date), INDEX (job_id,stage)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_application_note (
 id VARCHAR(150) PRIMARY KEY, application_id VARCHAR(96) NOT NULL, body TEXT NOT NULL,
 actor VARCHAR(100) NOT NULL, at_time VARCHAR(30) NOT NULL, sequence_no INT NOT NULL,
 FOREIGN KEY (application_id) REFERENCES hr_application(id), UNIQUE (application_id,sequence_no)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_interview (
 id VARCHAR(96) PRIMARY KEY, application_id VARCHAR(96) NOT NULL, interview_date DATE NOT NULL,
 interview_time TIME NOT NULL, duration SMALLINT NOT NULL, format ENUM('Video','On-site','Phone') NOT NULL,
 location VARCHAR(300) NOT NULL, interviewer VARCHAR(100) NOT NULL, notes TEXT NOT NULL,
 status ENUM('Scheduled','Completed','Cancelled') NOT NULL,
 active_application_id VARCHAR(96) GENERATED ALWAYS AS (CASE WHEN status='Scheduled' THEN application_id ELSE NULL END) STORED,
 FOREIGN KEY (application_id) REFERENCES hr_application(id), UNIQUE (active_application_id),
 INDEX (status,interview_date,interview_time), CHECK (duration IN (15,30,45,60,90,120))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_interview_feedback (
 id VARCHAR(96) PRIMARY KEY, rating TINYINT NOT NULL, recommendation ENUM('Proceed','Hold','Reject') NOT NULL,
 notes TEXT NOT NULL, recorded_at VARCHAR(30) NOT NULL,
 FOREIGN KEY (id) REFERENCES hr_interview(id), CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_offer (
 id VARCHAR(96) PRIMARY KEY, salary DECIMAL(12,2) NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'SGD',
 start_date DATE NOT NULL, expiry DATE NOT NULL, approval ENUM('Awaiting approval','Approved') NOT NULL,
 status ENUM('Draft','Accepted') NOT NULL, terms TEXT NOT NULL, created_at VARCHAR(30) NOT NULL,
 FOREIGN KEY (id) REFERENCES hr_application(id), CHECK (salary > 0 AND salary <= 1000000), CHECK (start_date > expiry)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_task (
 id VARCHAR(96) PRIMARY KEY, application_id VARCHAR(96) NOT NULL, title VARCHAR(150) NOT NULL,
 assignee VARCHAR(100) NOT NULL, due DATE NOT NULL, notes TEXT NOT NULL, status ENUM('Open','Completed') NOT NULL,
 created_at VARCHAR(30) NOT NULL, FOREIGN KEY (application_id) REFERENCES hr_application(id), INDEX (status,due)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_email_template (
 id VARCHAR(96) PRIMARY KEY, name VARCHAR(100) NOT NULL, kind VARCHAR(50) NOT NULL,
 subject VARCHAR(200) NOT NULL, body TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_email_draft (
 id VARCHAR(96) PRIMARY KEY, application_id VARCHAR(96) NOT NULL, recipient VARCHAR(254) NOT NULL,
 subject VARCHAR(200) NOT NULL, body TEXT NOT NULL, kind VARCHAR(50) NOT NULL DEFAULT 'Message',
 status ENUM('Draft','Sending','Sent','Uncertain','Superseded') NOT NULL, is_read BOOLEAN NOT NULL DEFAULT FALSE,
 template_id VARCHAR(96), template_name VARCHAR(100), created_at VARCHAR(30) NOT NULL,
 sending_at VARCHAR(30), last_error VARCHAR(500), FOREIGN KEY (application_id) REFERENCES hr_application(id),
 FOREIGN KEY (template_id) REFERENCES hr_email_template(id), INDEX (status,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_audit_log (
 id VARCHAR(96) PRIMARY KEY, application_id VARCHAR(96), summary VARCHAR(300) NOT NULL, notes TEXT NOT NULL,
 from_stage VARCHAR(30), to_stage VARCHAR(30), actor_id VARCHAR(96), actor VARCHAR(100) NOT NULL,
 at_time VARCHAR(30) NOT NULL, notification_id VARCHAR(96),
 FOREIGN KEY (application_id) REFERENCES hr_application(id), FOREIGN KEY (actor_id) REFERENCES hr_user(id),
 FOREIGN KEY (notification_id) REFERENCES hr_email_draft(id), INDEX (application_id,at_time)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_system_notification (
 id VARCHAR(96) PRIMARY KEY, application_id VARCHAR(96) NOT NULL, title VARCHAR(300) NOT NULL,
 event_type ENUM('New Application','Status Update') NOT NULL, source_module VARCHAR(50) NOT NULL,
 created_at VARCHAR(30) NOT NULL, FOREIGN KEY (application_id) REFERENCES hr_application(id), INDEX (created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_notification_read (
 notification_id VARCHAR(96) NOT NULL, user_id VARCHAR(96) NOT NULL, PRIMARY KEY (notification_id,user_id),
 FOREIGN KEY (notification_id) REFERENCES hr_system_notification(id), FOREIGN KEY (user_id) REFERENCES hr_user(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_notification_log (
 id VARCHAR(96) PRIMARY KEY, draft_id VARCHAR(96) NOT NULL UNIQUE, application_id VARCHAR(96) NOT NULL,
 candidate_name VARCHAR(100) NOT NULL, job_title VARCHAR(100) NOT NULL, recipient VARCHAR(254) NOT NULL,
 subject VARCHAR(200) NOT NULL, body TEXT NOT NULL, template_name VARCHAR(100),
 trigger_event VARCHAR(50) NOT NULL, source_module VARCHAR(50) NOT NULL,
 message_id VARCHAR(300) NOT NULL, sent_at VARCHAR(30) NOT NULL, actor VARCHAR(100) NOT NULL,
 FOREIGN KEY (draft_id) REFERENCES hr_email_draft(id), FOREIGN KEY (application_id) REFERENCES hr_application(id), INDEX (sent_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_resume (
 candidate_id VARCHAR(96) PRIMARY KEY, filename VARCHAR(150) NOT NULL, size_bytes INT NOT NULL,
 content LONGBLOB NOT NULL, uploaded_at VARCHAR(30) NOT NULL, FOREIGN KEY (candidate_id) REFERENCES hr_candidate(id),
 CHECK (size_bytes > 0 AND size_bytes <= 5242880)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_notification_attachment (
 id VARCHAR(96) PRIMARY KEY, log_id VARCHAR(96) NOT NULL, filename VARCHAR(150) NOT NULL,
 content LONGBLOB NOT NULL, size_bytes INT NOT NULL, mime_type VARCHAR(100) NOT NULL,
 FOREIGN KEY (log_id) REFERENCES hr_notification_log(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_request (
 id VARCHAR(150) PRIMARY KEY, user_id VARCHAR(96) NOT NULL, request_hash CHAR(64) NOT NULL,
 result_json JSON NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY (user_id) REFERENCES hr_user(id), INDEX (created_at)
) ENGINE=InnoDB;
