export function assertDatabaseWriteAllowed(env = process.env, purpose) {
  if (env.NODE_ENV === 'production' || (env.INTEGRATION_MODE || 'standalone') !== 'standalone') {
    throw new Error('Database writes are currently enabled only for a dedicated standalone development/test database. Team integration is pending.');
  }
  const name = env.DB_NAME || '';
  const match = /^jrs_hr_module_(dev|test)_[a-z0-9_]+$/.exec(name);
  if (!match || env.DB_WRITE_CONFIRMED !== name) {
    throw new Error('Confirm a new dedicated database first; DB_NAME must use jrs_hr_module_dev_* or jrs_hr_module_test_* and DB_WRITE_CONFIRMED must equal that exact name.');
  }
  if (purpose && match[1] !== purpose) throw new Error(`This command requires a dedicated ${purpose} database.`);
  if (!env.DB_USER || env.DB_USER.toLowerCase() === 'root') throw new Error('Configure a dedicated development database user, not root.');
  if (!env.DB_PASSWORD || env.DB_PASSWORD.startsWith('replace_')) throw new Error('Configure the database password in the local environment file.');
}

export const moduleTables = ['HR_USER','MODULE_ACCOUNT','MODULE_SESSION','EMAIL_TEMPLATE','CANDIDATE','JOB_POSITION','APPLICATION','SYSTEM_NOTIFICATION','NOTIFICATION_LOG','NOTIFICATION_ATTACHMENT'];
export const tableNames = tables => tables.map(table => String(typeof table === 'string' ? table : table.tableName || Object.values(table)[0]).toUpperCase());

// Read-only check BEFORE Umzug is allowed to create its metadata table.
export async function inspectMigrationTarget(db) {
  const names = tableNames(await db.getQueryInterface().showAllTables());
  const unexpected = names.filter(name => !moduleTables.includes(name) && name !== 'SEQUELIZEMETA');
  if (unexpected.length) throw new Error('Database contains unrelated tables; no migration was attempted. Choose a new dedicated database.');
  const existing = names.filter(name => moduleTables.includes(name));
  if (existing.length) {
    if (!names.includes('SEQUELIZEMETA')) throw new Error('Existing module tables have no migration history. Refusing to adopt or delete them.');
    const [rows] = await db.query('SELECT name FROM `SequelizeMeta`');
    if (!rows.some(row => row.name === '001-module') || existing.length !== moduleTables.length) {
      throw new Error('Incomplete or unrecognized migration state. Keep all tables for diagnosis; no automatic cleanup.');
    }
    return { initialized:true };
  }
  if (names.includes('SEQUELIZEMETA')) {
    const [rows] = await db.query('SELECT name FROM `SequelizeMeta`');
    if (rows.length) throw new Error('Migration history exists without module tables. Refusing to recreate them automatically.');
  }
  return { initialized:false };
}
