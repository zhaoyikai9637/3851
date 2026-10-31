import { describe, expect, test, jest } from '@jest/globals';
import { assertDatabaseWriteAllowed, inspectMigrationTarget, moduleTables, tableNames } from '../src/database-safety.js';
import { createMailer } from '../src/mailer.js';

const approved = {
  NODE_ENV: 'test', INTEGRATION_MODE: 'standalone',
  DB_NAME: 'jrs_hr_module_test_unit', DB_WRITE_CONFIRMED: 'jrs_hr_module_test_unit',
  DB_USER: 'jrs_test', DB_PASSWORD: 'isolated-test-only'
};

describe('database write safeguards', () => {
  test('accepts an explicitly confirmed dedicated test database', () => {
    expect(() => assertDatabaseWriteAllowed(approved, 'test')).not.toThrow();
  });

  test('accepts team runtime access without migration confirmation flags', () => {
    const runtime = {
      ...approved,
      NODE_ENV: 'development',
      INTEGRATION_MODE: 'team',
      DB_NAME: 'jrs_hr_module_dev_team',
      DB_WRITE_CONFIRMED: '',
      DB_SHARED_INTEGRATION_CONFIRMED: '',
      DB_USER: 'dev_zhaoyikai'
    };
    expect(() => assertDatabaseWriteAllowed(runtime, 'runtime')).not.toThrow();
  });

  test.each([
    [{ NODE_ENV: 'production' }, 'test'],
    [{ INTEGRATION_MODE: 'team' }, 'test'],
    [{ DB_NAME: 'company_main' }, 'test'],
    [{ DB_WRITE_CONFIRMED: 'jrs_hr_module_test_other' }, 'test'],
    [{ DB_USER: 'root' }, 'test'],
    [{ DB_PASSWORD: 'replace_me' }, 'test'],
    [{}, 'dev']
  ])('rejects unsafe database configuration %#', (patch, purpose) => {
    expect(() => assertDatabaseWriteAllowed({ ...approved, ...patch }, purpose)).toThrow();
  });

  test('normalizes table names from driver-returned shapes', () => {
    expect(tableNames(['hr_user', { tableName: 'Email_Template' }])).toEqual(['HR_USER', 'EMAIL_TEMPLATE']);
  });

  test('rejects unrelated tables before any migration query', async () => {
    const db = { getQueryInterface: () => ({ showAllTables: async () => ['team_users'] }), query: jest.fn() };
    await expect(inspectMigrationTarget(db)).rejects.toThrow('unrelated tables');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('refuses existing module tables without migration history', async () => {
    const db = { getQueryInterface: () => ({ showAllTables: async () => ['HR_USER'] }), query: jest.fn() };
    await expect(inspectMigrationTarget(db)).rejects.toThrow('no migration history');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('accepts a complete recognized migration state', async () => {
    const db = {
      getQueryInterface: () => ({ showAllTables: async () => [...moduleTables, 'SequelizeMeta'] }),
      query: jest.fn().mockResolvedValue([[{ name: '001-module' }]])
    };
    await expect(inspectMigrationTarget(db)).resolves.toEqual({ initialized: true });
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

describe('mailer safety defaults', () => {
  test('uses offline preview with no mail credentials', async () => {
    await expect(createMailer({}).send({ to: 'isolated@example.test', subject: 'Hello', text: 'Preview' }))
      .resolves.toEqual({ preview: true });
  });

  test('requires an explicit SMTP allow flag', () => {
    expect(() => createMailer({ MAIL_MODE: 'smtp', SMTP_HOST: 'localhost', MAIL_FROM: 'test@example.test' }))
      .toThrow('MAIL_ALLOW_SMTP=true');
  });
});
