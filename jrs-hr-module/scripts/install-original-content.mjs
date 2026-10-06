import { createDatabase } from '../server/config/database.js';
import { defineModels } from '../server/src/models.js';
import { assertDatabaseWriteAllowed } from '../server/src/database-safety.js';
import { installOriginalTemplates } from '../server/src/original-content.js';

let db;
try {
  assertDatabaseWriteAllowed(process.env, 'seed');
  const hrUserId = Number(process.argv[2]);
  if (!Number.isInteger(hrUserId) || hrUserId < 1) throw new Error('Provide an active local HR profile ID.');
  db = createDatabase();
  await db.authenticate();
  const result = await installOriginalTemplates(db, defineModels(db), hrUserId);
  console.log(JSON.stringify({ ...result, database: process.env.DB_NAME, mailSent: 0 }));
} catch (error) {
  console.error('Content installation stopped:', error.code || error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}
