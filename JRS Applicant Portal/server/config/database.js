import { Sequelize } from "sequelize";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function createSequelize() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const ca = process.env.DB_SSL_CA || (process.env.DB_SSL_CA_FILE
    ? fs.readFileSync(path.resolve(root, process.env.DB_SSL_CA_FILE), "utf8") : undefined);
  if (process.env.INTEGRATION_MODE === "team" && !ca) {
    throw new Error("Team database requires a verified CA certificate.");
  }
  return new Sequelize(
    process.env.DB_NAME || "jrs_applicant_portal",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      dialect: "mysql",
      dialectOptions: ca ? { ssl: { ca, rejectUnauthorized: true } } : {},
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      define: {
        underscored: true,
        timestamps: true,
      },
    },
  );
}
