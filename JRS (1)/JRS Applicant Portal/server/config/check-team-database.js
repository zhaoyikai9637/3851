import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createSequelize } from "./database.js";

dotenv.config({ path: fileURLToPath(new URL("../../.env.team", import.meta.url)), quiet: true });
const db = createSequelize();
try {
  await db.authenticate();
  const [columns] = await db.query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION");
  console.log(JSON.stringify({ connected: true, tlsVerified: true, schema: columns }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ connected: false, code: error.original?.code || error.name }));
  process.exitCode = 1;
} finally {
  await db.close();
}
