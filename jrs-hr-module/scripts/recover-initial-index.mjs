// One-time, non-destructive recovery for the observed 2026-09-09 INDEX privilege
// failure. Normal migrations still refuse all incomplete/unrecognized schemas.
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { createDatabase } from "../server/src/db.js";
import {
  assertDatabaseWriteAllowed,
  inspectMigrationTarget,
  tableNames,
} from "../server/src/database-safety.js";
import { up } from "../server/src/migrations/001-module.js";

const exactDev = "jrs_hr_module_dev_20260908",
  exactTest = "jrs_hr_module_test_20260908";
const initialTables = [
  "HR_USER",
  "MODULE_ACCOUNT",
  "MODULE_SESSION",
  "SEQUELIZEMETA",
];
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
function assertSame(a, b, label) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(
      `Recovery refused: ${label} differs from the successfully tested schema.`,
    );
}
function columnsShape(columns) {
  return Object.entries(columns)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => [name, stable(value)]);
}
function indexShape(indexes) {
  return indexes
    .map((i) => ({
      name: i.name,
      unique: i.unique,
      fields: i.fields.map((f) => [f.attribute, f.length, f.order]),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function fkShape(rows) {
  return rows
    .map((r) => [
      r.columnName,
      r.referencedTableName?.toUpperCase(),
      r.referencedColumnName,
    ])
    .sort();
}
async function compareTable(q, reference, table) {
  assertSame(
    columnsShape(await q.describeTable(table)),
    columnsShape(await reference.describeTable(table)),
    `${table} columns`,
  );
  assertSame(
    indexShape(await q.showIndex(table)),
    indexShape(await reference.showIndex(table)),
    `${table} indexes`,
  );
  assertSame(
    fkShape(await q.getForeignKeyReferencesForTable(table)),
    fkShape(await reference.getForeignKeyReferencesForTable(table)),
    `${table} foreign keys`,
  );
}
async function main() {
  if (process.argv[2] !== "--resume-20260909-index-failure")
    throw new Error(
      "Explicit recovery flag required. This is not a general migration command.",
    );
  const env = dotenv.parse(
    await fs.readFile(new URL("../server/.env", import.meta.url)),
  );
  const test = dotenv.parse(
    await fs.readFile(new URL("../server/.env.test", import.meta.url)),
  );
  assertDatabaseWriteAllowed(env, "dev");
  assertDatabaseWriteAllowed(test, "test");
  if (
    env.DB_NAME !== exactDev ||
    test.DB_NAME !== exactTest ||
    [env, test].some((e) => e.DB_HOST !== "127.0.0.1" || e.DB_PORT !== "3306")
  )
    throw new Error(
      "Recovery target differs from the observed dedicated local schemas.",
    );
  const db = createDatabase(env),
    referenceDb = createDatabase(test);
  try {
    const q = db.getQueryInterface(),
      reference = referenceDb.getQueryInterface();
    if (!(await inspectMigrationTarget(referenceDb)).initialized)
      throw new Error(
        "The isolated reference schema must have a successful migration first.",
      );
    assertSame(
      tableNames(await q.showAllTables()).sort(),
      [...initialTables].sort(),
      "initial table set",
    );
    for (const table of initialTables) {
      const [[row]] = await db.query(
        `SELECT COUNT(*) AS total FROM ${q.queryGenerator.quoteIdentifier(table)}`,
      );
      if (Number(row.total) !== 0)
        throw new Error(`Recovery refused: ${table} contains data.`);
      await compareTable(q, reference, table);
    }
    const [triggers] = await db.query(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()",
    );
    if (triggers.length)
      throw new Error("Recovery refused: unexpected triggers.");
    // Build the reviewed initial migration as a plan without executing its DDL.
    const operations = [];
    await up({
      context: {
        showAllTables: async () => [],
        queryGenerator: q.queryGenerator,
        createTable: async (name, attributes, options) =>
          operations.push({ name, attributes, options }),
        sequelize: { query: async (sql) => operations.push({ sql }) },
      },
    });
    console.log(
      "Verified three empty module tables, metadata, columns, indexes and foreign keys.",
    );
    for (const operation of operations) {
      if (operation.name) {
        if (!initialTables.includes(operation.name))
          await q.createTable(
            operation.name,
            operation.attributes,
            operation.options,
          );
      } else {
        const match = /^CREATE INDEX `([a-z_]+)` ON `([A-Z_]+)` \(/.exec(
          operation.sql,
        );
        if (!match) throw new Error("Recovery plan contains unexpected SQL.");
        if (!initialTables.includes(match[2])) await db.query(operation.sql);
      }
    }
    // Record success only AFTER the completed schema matches the tested schema.
    for (const table of tableNames(await reference.showAllTables()))
      await compareTable(q, reference, table);
    await db.query("INSERT INTO `SequelizeMeta` (`name`) VALUES (:name)", {
      replacements: { name: "001-module" },
    });
    console.log(
      "Recovery complete. Existing empty tables were preserved; missing tables/indexes were created and migration history recorded.",
    );
  } finally {
    await db.close();
    await referenceDb.close();
  }
}
main().catch((e) => {
  console.error("Recovery stopped:", e.original?.code || e.message);
  process.exitCode = 1;
});
