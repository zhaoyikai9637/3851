import { Umzug, SequelizeStorage } from 'umzug';
import { pathToFileURL } from 'node:url';
import { createDatabase } from './db.js';
import * as initial from './migrations/001-module.js';
import { assertDatabaseWriteAllowed, inspectMigrationTarget } from './database-safety.js';
export function migrator(db) {
  return new Umzug({ migrations: [{ name: '001-module', up: initial.up, down: initial.down }],
    context: db.getQueryInterface(), storage: new SequelizeStorage({ sequelize: db }), logger: console });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    assertDatabaseWriteAllowed();
    db = createDatabase();
    await db.authenticate();
    await inspectMigrationTarget(db);
    await migrator(db).up(); console.log('Migrations complete.');
  }
  catch (e) { console.error('Migration stopped:',e.original?.code || e.message); process.exitCode = 1; }
  finally { if (db) await db.close(); }
}
