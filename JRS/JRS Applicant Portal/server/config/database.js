import { Sequelize } from "sequelize";

export function createSequelize() {
  return new Sequelize(
    process.env.DB_NAME || "jrs_applicant_portal",
    process.env.DB_USER || "root",
    process.env.DB_PASSWORD || "",
    {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      dialect: "mysql",
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      define: {
        underscored: true,
        timestamps: true,
      },
    },
  );
}
