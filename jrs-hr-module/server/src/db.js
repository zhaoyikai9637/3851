import './env.js';
import { Sequelize } from 'sequelize';
export function createDatabase(env = process.env) {
  if (!env.DB_NAME || !env.DB_USER || !env.DB_PASSWORD) throw new Error('Set explicit DB_NAME, DB_USER and DB_PASSWORD in the local server environment.');
  return new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
    dialect: 'mysql', host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306),
    logging: false, timezone: '+00:00', pool: { max: 5, min: 0, acquire: 15000 },
    define: { freezeTableName: true, underscored: true, charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }
  });
}
