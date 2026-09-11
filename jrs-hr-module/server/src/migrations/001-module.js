import { DataTypes as D, literal } from 'sequelize';
import { moduleTables, tableNames } from '../database-safety.js';
// Initial migration: index SQL corrected after the first partial attempt on the dedicated dev DB. Use NEW migrations after successful application.
export async function up({ context: q, mode = 'standalone' }) {
  const id = { type: D.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false };
  const s = (n, nullable = false) => ({ type: D.STRING(n), allowNull: nullable });
  const time = () => ({ type: D.DATE, allowNull: false, defaultValue: literal('CURRENT_TIMESTAMP') });
  const stamps = () => ({ created_at: time(), updated_at: time() });
  const ref = (model, key, nullable = false, onDelete = 'RESTRICT') => ({ type: D.INTEGER, allowNull: nullable, references: { model, key }, onDelete, onUpdate: 'CASCADE' });
  const create = (name, attrs) => q.createTable(name, attrs, { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
  // Sequelize addIndex emits ALTER TABLE; CREATE INDEX needs only the scoped INDEX grant.
  const addIndex = (table, columns) => {
    const quote = value => q.queryGenerator.quoteIdentifier(value);
    const name = [table.toLowerCase(), ...columns].join('_');
    return q.sequelize.query('CREATE INDEX ' + quote(name) + ' ON ' + quote(table) + ' (' + columns.map(quote).join(', ') + ')');
  };
  // Refuse to silently claim an older/manual schema. MySQL DDL is not transactional.
  const tables = await q.showAllTables();
  if (tableNames(tables).some(t => moduleTables.filter(name => !['APPLICATION','CANDIDATE','JOB_POSITION'].includes(name)).includes(t))) {
    throw new Error('Module tables already exist. Use a NEW empty database; do not mix with the earlier SQL script.');
  }
  if (mode === 'team') {
    for (const name of ['CANDIDATE', 'JOB_POSITION', 'APPLICATION']) {
      if (!tables.some(t => String(t).toUpperCase() === name)) throw new Error(`Team dependency ${name} is missing; see docs/INTEGRATION.md.`);
    }
    const cols = await q.describeTable('APPLICATION');
    for (const key of ['application_id','candidate_id','position_id','assigned_hr_user_id','current_status','applied_at']) {
      if (!cols[key]) throw new Error(`APPLICATION.${key} is required by the integration contract.`);
    }
  } else if (tables.some(t => ['APPLICATION','CANDIDATE','JOB_POSITION'].includes(String(t).toUpperCase()))) {
    throw new Error('Standalone setup requires an empty database; found team-owned tables.');
  }
  await create('HR_USER', {
    user_id: id, employee_id: { ...s(30), unique: true }, full_name: s(100), email: { ...s(150), unique: true },
    phone: s(20,true), role: s(50), department: s(100), office_location: s(100,true), profile_photo_url: s(255,true),
    account_status: { ...s(20), defaultValue: 'ACTIVE' }, last_login_at: { type: D.DATE, allowNull: true }, ...stamps()
  });
  await create('MODULE_ACCOUNT', { account_id: id, email: { ...s(150), unique: true }, password_hash: s(255), role: s(20), hr_user_id: { ...ref('HR_USER','user_id',true), unique: true }, ...stamps() });
  await create('MODULE_SESSION', { sid: { type: D.STRING(128), primaryKey: true }, data: { type: D.TEXT('medium'), allowNull: false }, expires: { type: D.DATE, allowNull: false } });
  await addIndex('MODULE_SESSION',['expires']);
  await create('EMAIL_TEMPLATE', {
    template_id: id, template_name: { ...s(150), unique: true }, subject: s(255), body: { type: D.TEXT, allowNull: false }, usage_type: s(50),
    is_active: { type: D.BOOLEAN, allowNull: false, defaultValue: true }, created_by: ref('HR_USER','user_id'), updated_by: ref('HR_USER','user_id',true,'SET NULL'), ...stamps()
  });
  await addIndex('EMAIL_TEMPLATE',['is_active','usage_type']);
  if (mode !== 'team') {
    await create('CANDIDATE', { candidate_id: id, full_name: s(100), email: s(150), ...stamps() });
    await create('JOB_POSITION', { position_id: id, title: s(150), ...stamps() });
    await create('APPLICATION', { application_id: id, candidate_id: ref('CANDIDATE','candidate_id'), position_id: ref('JOB_POSITION','position_id'), assigned_hr_user_id: ref('HR_USER','user_id'), current_status: s(50), applied_at: time(), ...stamps() });
  }
  await create('SYSTEM_NOTIFICATION', {
    notification_id: id, recipient_user_id: ref('HR_USER','user_id'), application_id: ref('APPLICATION','application_id',true,'SET NULL'),
    notification_type: s(50), title: s(180), message: { type: D.TEXT, allowNull: false }, source_module: { ...s(100), defaultValue: 'Applications' },
    event_key: { ...s(150,true), unique: true }, is_read: { type: D.BOOLEAN, allowNull: false, defaultValue: false }, read_at: { type: D.DATE, allowNull: true }, created_at: time()
  });
  await addIndex('SYSTEM_NOTIFICATION',['recipient_user_id','is_read','created_at']);
  await create('NOTIFICATION_LOG', {
    log_id: id, application_id: ref('APPLICATION','application_id'), template_id: ref('EMAIL_TEMPLATE','template_id'), sender_user_id: ref('HR_USER','user_id'),
    trigger_event: s(100), source_module: s(100), recipient_email: s(150), candidate_name: s(100), position_title: s(150), template_name: s(150),
    email_subject: s(255), email_body: { type: D.TEXT, allowNull: false }, delivery_status: { ...s(20), defaultValue: 'PENDING' }, sent_at: { type: D.DATE, allowNull: true },
    event_key: { ...s(150,true), unique: true }, error_message: s(255,true), is_demo: { type: D.BOOLEAN, allowNull: false, defaultValue: false }, created_at: time()
  });
  await addIndex('NOTIFICATION_LOG',['sender_user_id','delivery_status','sent_at']);
  await addIndex('NOTIFICATION_LOG',['trigger_event','sent_at']);
  await create('NOTIFICATION_ATTACHMENT', { attachment_id: id, log_id: ref('NOTIFICATION_LOG','log_id'), file_name: s(255), file_url: s(255), file_type: s(80), created_at: time() });
}
export async function down() {
  throw new Error('Destructive rollback intentionally disabled. Use a reviewed migration and backup.');
}
