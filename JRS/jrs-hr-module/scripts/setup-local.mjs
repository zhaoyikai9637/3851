import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import readline from "node:readline";
import { createInterface } from "node:readline/promises";

export const targets = [
  {
    name: "jrs_hr_module_dev_20260908",
    user: "jrs_hr_module_dev",
    file: ".env",
    environment: "development",
  },
  {
    name: "jrs_hr_module_test_20260908",
    user: "jrs_hr_module_test",
    file: ".env.test",
    environment: "test",
  },
];
const serverDir = fileURLToPath(new URL("../server/", import.meta.url));
const secret = () => randomBytes(32).toString("base64url") + "Aa9!";
export function grantDatabase(name, partialRevokes) {
  if (!targets.some((t) => t.name === name))
    throw new Error("Unapproved database name.");
  // MySQL treats underscores as grant wildcards unless partial_revokes is ON.
  return "`" + (partialRevokes ? name : name.replaceAll("_", "\\_")) + "`";
}
function environmentFile(target, password, seedPassword) {
  return `# Generated locally. Never commit or share this file.
NODE_ENV=${target.environment}
HOST=127.0.0.1
PORT=3001
APP_ORIGIN=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${target.name}
DB_USER=${target.user}
DB_PASSWORD=${password}
DB_WRITE_CONFIRMED=${target.name}
SESSION_SECRET=${randomBytes(48).toString("hex")}
INTEGRATION_MODE=standalone
COMPANY_NAME=JRS
SEED_PASSWORD=${seedPassword}
UPLOAD_DIR=./uploads
MAIL_MODE=preview
MAIL_ALLOW_SMTP=false
`;
}
export async function preflight(connection) {
  const [schemas] = await connection.execute(
    "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?, ?)",
    targets.map((t) => t.name),
  );
  if (schemas.length)
    throw new Error(
      "STOP: an approved schema name already exists. No existing database will be adopted or changed.",
    );
  const [accounts] = await connection.execute(
    "SELECT User FROM mysql.user WHERE User IN (?, ?)",
    targets.map((t) => t.user),
  );
  if (accounts.length)
    throw new Error(
      "STOP: a dedicated account name already exists. No existing account will be changed.",
    );
  const [[settings]] = await connection.query(
    "SELECT VERSION() AS version, @@port AS port, @@global.partial_revokes AS partialRevokes",
  );
  if (Number(settings.port) !== 3306)
    throw new Error("STOP: server port differs from the approved target.");
  return settings;
}
function hiddenPassword() {
  return new Promise((resolve, reject) => {
    process.stdout.write("MySQL administrator password (hidden): ");
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    let value = "";
    const finish = () => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
    };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === "c") {
        finish();
        reject(new Error("Cancelled."));
      } else if (key.name === "return" || key.name === "enter") {
        finish();
        resolve(value);
      } else if (key.name === "backspace") value = value.slice(0, -1);
      else if (
        text &&
        !key.ctrl &&
        !key.meta &&
        !/[\r\n\x00-\x1f\x7f]/.test(text)
      )
        value += text;
    };
    process.stdin.on("keypress", onKey);
    process.stdin.resume();
  });
}
async function main() {
  if (!process.stdin.isTTY)
    throw new Error(
      "Run this command directly in a local interactive terminal. Do not pass passwords as arguments.",
    );
  for (const t of targets) {
    try {
      await fs.access(path.join(serverDir, t.file));
    } catch (e) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    throw new Error(
      `STOP: server/${t.file} already exists. Local configuration will not be overwritten.`,
    );
  }
  console.log(
    "Approved local targets: 127.0.0.1:3306, two NEW dedicated JRS schemas.",
  );
  console.log(
    "No old SQL, existing schema adoption, account replacement, DROP, or mail delivery.",
  );
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const user =
    (await prompt.question("MySQL administrator username [root]: ")).trim() ||
    "root";
  prompt.close();
  let password = await hiddenPassword();
  let connection;
  try {
    connection = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3306,
      user,
      password,
      connectTimeout: 10000,
      multipleStatements: false,
    });
    password = "";
    const settings = await preflight(connection);
    console.log(
      `Connected to MySQL ${settings.version}; approved schemas and accounts are absent.`,
    );
    const plans = targets.map((t) => ({
      ...t,
      password: secret(),
      seedPassword: secret(),
    }));
    // Keep generated credentials before any DDL. Never overwrite config or delete
    // objects after a partial failure; local files permit diagnosis/recovery.
    for (const t of plans)
      await fs.writeFile(
        path.join(serverDir, t.file),
        environmentFile(t, t.password, t.seedPassword),
        { flag: "wx", mode: 0o600 },
      );
    for (const t of plans) {
      await connection.query(
        `CREATE DATABASE \`${t.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      for (const host of ["localhost", "127.0.0.1"]) {
        // Generated password/account identifiers have an intentionally limited alphabet.
        await connection.query(
          `CREATE USER '${t.user}'@'${host}' IDENTIFIED BY '${t.password}'`,
        );
        await connection.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES ON ${grantDatabase(t.name, Boolean(Number(settings.partialRevokes)))}.* TO '${t.user}'@'${host}'`,
        );
      }
      const check = await mysql.createConnection({
        host: "127.0.0.1",
        port: 3306,
        user: t.user,
        password: t.password,
        database: t.name,
        connectTimeout: 10000,
      });
      try {
        await check.query("SELECT DATABASE()");
      } finally {
        await check.end();
      }
      console.log(
        `Created and verified ${t.name} with a separate local account.`,
      );
    }
    console.log(
      "Setup complete. Credentials exist only in server/.env and server/.env.test.",
    );
    console.log(
      "Next: npm.cmd run db:migrate ; npm.cmd run db:seed ; npm.cmd run test:mysql",
    );
    console.log(
      "HR fixture data is ready. Sign-in belongs to the team; configure its adapter when available.",
    );
  } catch (error) {
    // SQL exceptions can contain passwords in their SQL text; never print objects,
    // stack traces, sqlMessage or the driver message for a database error.
    if (error.sql || error.sqlState || error.code) {
      console.error(
        `Setup stopped (${error.code || "DATABASE_ERROR"}). Existing objects/config are preserved. Do not delete or rerun blindly.`,
      );
      process.exitCode = 1;
    } else throw error;
  } finally {
    password = "";
    await connection?.end();
    process.stdin.pause();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
    process.stdin.pause();
  });
}
