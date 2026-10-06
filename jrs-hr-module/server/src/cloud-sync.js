// Only business records are exported. Authentication material never enters snapshots.
const businessTables = ['HR_USER', 'CANDIDATE', 'JOB_POSITION', 'APPLICATION',
  'EMAIL_TEMPLATE', 'SYSTEM_NOTIFICATION', 'NOTIFICATION_LOG', 'NOTIFICATION_ATTACHMENT'];
export async function inspectCloudDatabase(connection) {
  await connection.query('SET SESSION TRANSACTION READ ONLY');
  await connection.beginTransaction();
  try {
    const [columns] = await connection.query('SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION');
    const counts = {}, records = {};
    for (const table of [...businessTables, 'MODULE_ACCOUNT', 'MODULE_SESSION']) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      counts[table] = Number(row.count);
      if (businessTables.includes(table) && counts[table]) {
        if (counts[table] > 10000) throw new Error('Snapshot exceeds 10000 rows per table; review a paginated export first.');
        const [rows] = await connection.query(`SELECT * FROM \`${table}\` LIMIT 10000`);
        records[table] = rows;
      }
    }
    return { columns, counts, records, importableRows: Object.values(records).reduce((n, rows) => n + rows.length, 0) };
  } finally {
    await connection.rollback();
  }
}
