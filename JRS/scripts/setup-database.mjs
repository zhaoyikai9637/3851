import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize';
import { root, loadSettings } from '../server/config.mjs';
import { recruitmentSql } from '../server/sql-namespace.mjs';
import { up as createCommunicationSchema } from '../jrs-hr-module/server/src/migrations/001-module.js';
import { defineModels as applicantModels } from '../JRS Applicant Portal/server/models/index.js';
import { defaultTemplates } from '../jrs-hr-module/server/src/seed.js';
import originalContent from '../jrs-hr-module/server/data/original-content.json' with { type: 'json' };

const settings = loadSettings();
let admin, pool, sequelize;
try {
  const adminOptions = { host: '127.0.0.1', port: 3307, user: 'root', multipleStatements: false };
  try {
    admin = await mysql.createConnection({ ...adminOptions, password: settings.MYSQL_ADMIN_PASSWORD });
  } catch (error) {
    if (error.code !== 'ER_ACCESS_DENIED_ERROR') throw error;
    admin = await mysql.createConnection({ ...adminOptions, password: '' });
    await admin.query("ALTER USER 'root'@'localhost' IDENTIFIED BY " + admin.escape(settings.MYSQL_ADMIN_PASSWORD));
  }
  await admin.query('CREATE DATABASE IF NOT EXISTS ' + admin.escapeId(settings.DB_NAME) + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await admin.query("CREATE USER IF NOT EXISTS 'jrs_integrated_app'@'localhost' IDENTIFIED BY " + admin.escape(settings.DB_PASSWORD));
  await admin.query('GRANT ALL PRIVILEGES ON ' + admin.escapeId(settings.DB_NAME) + ".* TO 'jrs_integrated_app'@'localhost'");
  pool = mysql.createPool(settings.db);
  const [tables] = await pool.query('SHOW TABLES');
  if (tables.length) {
    const [[version]] = await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
    if (![1, 2, 3, 4, 5, 6].includes(version?.version)) throw new Error('Existing schema is not a completed JRS integration database. No automatic overwrite.');
    if (version.version === 1) {
      await pool.query('CREATE TABLE JRS_CANDIDATE_LINK (recruiting_id VARCHAR(96) PRIMARY KEY, canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB');
      await pool.query('CREATE TABLE JRS_HR_APPLICATION_LINK (recruiting_id VARCHAR(96) PRIMARY KEY, canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB');
      await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=2 WHERE id=1');
    }
    if (version.version < 3) {
      sequelize = new Sequelize(settings.DB_NAME, settings.DB_USER, settings.DB_PASSWORD, { dialect: 'mysql', host: settings.DB_HOST, port: 3307, logging: false, define: { underscored: true } });
      const models = applicantModels(sequelize), q = sequelize.getQueryInterface();
      for (const model of Object.values(models)) {
        const tableNames = (await q.showAllTables()).map(name => String(name).toLowerCase());
        const previousName = model.options.name.plural.toLowerCase();
        if (!tableNames.includes(model.tableName.toLowerCase()) && tableNames.includes(previousName)) await q.renameTable(previousName, model.tableName);
        const columns = await q.describeTable(model.tableName);
        for (const [name, attribute] of Object.entries(model.rawAttributes)) if (attribute.field !== name && columns[name] && !columns[attribute.field]) await q.renameColumn(model.tableName, name, attribute.field);
      }
      await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=3 WHERE id=1');
    }
    if (version.version < 4) {
      await pool.query('ALTER TABLE jobs MODIFY closing_date DATE NULL');
      await pool.query('UPDATE jobs j JOIN JRS_JOB_LINK l ON l.portal_id=j.id SET j.closing_date=NULL');
      await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=4 WHERE id=1');
    }
    if (version.version < 5) {
      await pool.query("CREATE TABLE JRS_JOB_PUBLICATION (recruiting_id VARCHAR(96) PRIMARY KEY,salary_range VARCHAR(80) NOT NULL DEFAULT '',closing_date DATE NULL,publish_date DATE NULL,unpublish_date DATE NULL) ENGINE=InnoDB");
      await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=5 WHERE id=1');
    }
    if (version.version < 6) {
      await pool.query('ALTER TABLE JRS_JOB_LINK MODIFY portal_id INT UNSIGNED NULL');
      await pool.execute('UPDATE JRS_INTEGRATION_VERSION SET version=6 WHERE id=1');
    }
    console.log('Existing integrated database retained; no reseeding.');
  } else {
    sequelize = new Sequelize(settings.DB_NAME, settings.DB_USER, settings.DB_PASSWORD, { dialect: 'mysql', host: settings.DB_HOST, port: 3307, logging: false, define: { underscored: true } });
    await createCommunicationSchema({ context: sequelize.getQueryInterface() });
    const candidateSql = await fs.readFile(path.join(root, 'JRS Login and profile/migrations/001_candidate.sql'), 'utf8');
    for (const sql of candidateSql.replace(/^--.*$/gm, '').split(';').map(sql => sql.trim()).filter(Boolean)) await pool.query(sql);
    const hrSql = await fs.readFile(path.join(root, 'JRS HR/database/schema.sql'), 'utf8');
    for (const sql of hrSql.replace(/^--.*$/gm, '').split(';').map(sql => sql.trim()).filter(Boolean)) await pool.query(recruitmentSql(sql));
    const models = applicantModels(sequelize);
    for (const model of Object.values(models)) await model.sync();
    await pool.query('CREATE TABLE JRS_JOB_LINK (recruiting_id VARCHAR(96) PRIMARY KEY, portal_id INT UNSIGNED NULL UNIQUE, canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB');
    await pool.query('CREATE TABLE JRS_APPLICATION_LINK (portal_id INT UNSIGNED PRIMARY KEY, recruiting_id VARCHAR(96) NOT NULL UNIQUE, canonical_id INT NOT NULL UNIQUE, account_id INT NOT NULL, withdrawn BOOLEAN NOT NULL DEFAULT FALSE) ENGINE=InnoDB');
    await pool.query('CREATE TABLE JRS_RESUME_LINK (portal_id INT UNSIGNED PRIMARY KEY, canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB');
    await pool.query('CREATE TABLE JRS_CANDIDATE_LINK (recruiting_id VARCHAR(96) PRIMARY KEY, canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB');
    await pool.query('CREATE TABLE JRS_HR_APPLICATION_LINK (recruiting_id VARCHAR(96) PRIMARY KEY, canonical_id INT NOT NULL UNIQUE) ENGINE=InnoDB');
    await pool.query("CREATE TABLE JRS_JOB_PUBLICATION (recruiting_id VARCHAR(96) PRIMARY KEY,salary_range VARCHAR(80) NOT NULL DEFAULT '',closing_date DATE NULL,publish_date DATE NULL,unpublish_date DATE NULL) ENGINE=InnoDB");
    await pool.query('CREATE TABLE JRS_INTEGRATION_VERSION (id TINYINT PRIMARY KEY, version INT NOT NULL) ENGINE=InnoDB');
    const now = new Date().toISOString();
    await pool.execute('INSERT INTO recruiting_workspace(id,revision,created_at,updated_at) VALUES(1,0,?,?)', [now, now]);
    // Only profile data is read from the cloud. Login accounts get new, private local passwords.
    const handoffPath = process.env.JRS_CLOUD_HANDOFF;
    let profiles = [];
    if (handoffPath) {
      const raw = await fs.readFile(handoffPath, 'utf8');
      const field = key => raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();
      const person = raw.split(/\r?\n/).find(line => line.startsWith('- zhaoyikai |'));
      const cloud = await mysql.createConnection({ host: field('Host'), port: Number(field('Port')), database: field('Database'),
        user: person.match(/username:\s*([^|]+)/)[1].trim(), password: person.match(/password:\s*([^|]+)/i)[1].trim(),
        ssl: { ca: await fs.readFile(path.join(path.dirname(handoffPath), 'jrs-ca.pem'), 'utf8'), rejectUnauthorized: true, verifyIdentity: true }, connectTimeout: 15000 });
      try { await cloud.query('SET SESSION TRANSACTION READ ONLY'); await cloud.beginTransaction();
        [profiles] = await cloud.query("SELECT user_id,employee_id,full_name,email,phone,role,department,office_location,account_status FROM HR_USER WHERE account_status='ACTIVE' ORDER BY user_id LIMIT 100");
        await cloud.rollback();
      } finally { await cloud.end(); }
    }
    if (!profiles.length) throw new Error('Provide JRS_CLOUD_HANDOFF to read the current authoritative HR profiles. No fictional HR identity is silently substituted.');
    const accounts = [];
    for (const hr of profiles) {
      const password = `Local-${randomBytes(20).toString('base64url')}!`;
      await pool.execute('INSERT INTO HR_USER(user_id,employee_id,full_name,email,phone,role,department,office_location,account_status) VALUES(?,?,?,?,?,?,?,?,?)', [hr.user_id, hr.employee_id, hr.full_name, hr.email, hr.phone, hr.role, hr.department, hr.office_location, hr.account_status]);
      await pool.execute("INSERT INTO MODULE_ACCOUNT(email,password_hash,role,hr_user_id) VALUES(?,?,'hr',?)", [hr.email, await bcrypt.hash(password, 12), hr.user_id]);
      await pool.execute('INSERT INTO recruiting_user(id,email,password_hash,name,role,status,employee_id,department,phone,office_location,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [`team-hr-${hr.user_id}`, hr.email, 'shared-login-only', hr.full_name, hr.role, 'Active', hr.employee_id, hr.department, hr.phone || '', hr.office_location || '', now]);
      accounts.push({ name: hr.full_name, email: hr.email, role: hr.role, password });
    }
    for (const template of [...defaultTemplates, ...originalContent.templates]) {
      await pool.execute('INSERT IGNORE INTO EMAIL_TEMPLATE(template_name,subject,body,usage_type,is_active,created_by,updated_by) VALUES(?,?,?,?,1,?,?)', [template.templateName, template.subject, template.body, template.usageType, profiles[0].user_id, profiles[0].user_id]);
    }
    await fs.mkdir(path.join(root, '.local'), { recursive: true });
    const accountsFile = settings.DB_NAME.includes('_test_') ? 'accounts-test.json' : 'accounts.json';
    await fs.writeFile(path.join(root, '.local', accountsFile), JSON.stringify(accounts, null, 2), { flag: 'wx' });
    await pool.execute('INSERT INTO JRS_INTEGRATION_VERSION(id,version) VALUES(1,6)');
    console.log(`Integrated local schema ready; ${profiles.length} authoritative HR profiles, private local login accounts. No cloud writes.`);
    console.log(`Local login credentials: .local/${accountsFile} (never commit this file).`);
  }
} catch (error) {
  console.error('Setup stopped:', error.code || error.name, String(error.sqlMessage || error.message).replaceAll(settings.DB_PASSWORD, '[redacted]').replaceAll(settings.MYSQL_ADMIN_PASSWORD, '[redacted]')); process.exitCode = 1;
} finally { await admin?.end(); await pool?.end(); await sequelize?.close(); }
