import { describe, expect, it } from 'vitest';
// Load the real dialect during collection, outside each configuration assertion's deadline.
// Sequelize otherwise loads it lazily inside the first constructor call.
import 'mysql2';
import { createDatabase } from '../src/db.js';

const base = {
  DB_NAME: 'jrs_hr_module_dev_team',
  DB_USER: 'team-user',
  DB_PASSWORD: 'team-password',
  DB_HOST: 'mysql.example.test',
  DB_PORT: '12345',
};

describe('database transport', () => {
  it('enables certificate verification when a shared database CA is configured', async () => {
    const db = createDatabase({ ...base, DB_SSL_CA: 'TEST CA CERTIFICATE' });

    try {
      expect(db.options.dialectOptions.ssl).toEqual({
        ca: 'TEST CA CERTIFICATE',
        rejectUnauthorized: true,
      });
    } finally {
      await db.close();
    }
  });

  it('keeps local development connections free of TLS options', async () => {
    const db = createDatabase(base);

    try {
      expect(db.options.dialectOptions).toBeUndefined();
    } finally {
      await db.close();
    }
  });
});
