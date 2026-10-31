import { describe, expect, test } from '@jest/globals';
import { inspectCloudDatabase } from '../src/cloud-sync.js';

// This driver double refuses writes and authentication-record exports.
function connection({ templateCount = 0, interrupted = false } = {}) {
  const events = [];
  return {
    events,
    async query(sql) {
      events.push(sql);
      if (sql === 'SET SESSION TRANSACTION READ ONLY') return [[]];
      if (sql.includes('information_schema.COLUMNS')) return [[]];
      if (sql.startsWith('SELECT COUNT(*)')) {
        if (interrupted) throw new Error('Connection interrupted');
        return [[{ count: sql.includes('MODULE_ACCOUNT') ? 1 : sql.includes('EMAIL_TEMPLATE') ? templateCount : 0 }]];
      }
      if (sql === 'SELECT * FROM `EMAIL_TEMPLATE` LIMIT 10000') return [[{ template_id: 7, template_name: 'Team template' }]];
      throw new Error('Unexpected SQL: ' + sql);
    },
    async beginTransaction() { events.push('BEGIN'); },
    async rollback() { events.push('ROLLBACK'); }
  };
}

describe('read-only cloud inspection', () => {
  test('excludes account records from an empty business snapshot', async () => {
    const db = connection();
    const snapshot = await inspectCloudDatabase(db);
    expect(snapshot.counts.MODULE_ACCOUNT).toBe(1);
    expect(snapshot.records).toEqual({});
    expect(snapshot.importableRows).toBe(0);
    expect(db.events.slice(0, 2)).toEqual(['SET SESSION TRANSACTION READ ONLY', 'BEGIN']);
    expect(db.events.at(-1)).toBe('ROLLBACK');
  });
  test('captures allowed business content without modifying rows', async () => {
    const db = connection({ templateCount: 1 });
    expect((await inspectCloudDatabase(db)).records.EMAIL_TEMPLATE).toEqual([{ template_id: 7, template_name: 'Team template' }]);
    expect(db.events.at(-1)).toBe('ROLLBACK');
  });
  test('rolls back when the driver fails', async () => {
    const db = connection({ interrupted: true });
    await expect(inspectCloudDatabase(db)).rejects.toThrow('Connection interrupted');
    expect(db.events.at(-1)).toBe('ROLLBACK');
  });
  test('refuses oversized snapshots before exporting records', async () => {
    const db = connection({ templateCount: 10001 });
    await expect(inspectCloudDatabase(db)).rejects.toThrow('10000 rows');
    expect(db.events.some(sql => sql.startsWith('SELECT *'))).toBe(false);
    expect(db.events.at(-1)).toBe('ROLLBACK');
  });
});
