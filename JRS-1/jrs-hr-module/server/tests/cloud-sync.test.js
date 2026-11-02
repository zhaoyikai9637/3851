import { describe, expect, it } from 'vitest';
import { inspectCloudDatabase } from '../src/cloud-sync.js';

function database({ populated = false, fail = false } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (fail && sql.includes('COUNT')) throw new Error('Connection interrupted');
      if (sql.includes('information_schema.COLUMNS')) return [[{ TABLE_NAME: 'HR_USER', COLUMN_NAME: 'user_id', DATA_TYPE: 'int' }]];
      if (sql.includes('COUNT')) return [[{ count: sql.includes('MODULE_ACCOUNT') || (populated && sql.includes('EMAIL_TEMPLATE')) ? 1 : 0 }]];
      if (sql.startsWith('SELECT * FROM `EMAIL_TEMPLATE`')) return [[{ template_id: 7, template_name: 'Team template', body: 'Dear [CandidateName]' }]];
      return [[]];
    },
    async beginTransaction() { queries.push('BEGIN'); },
    async rollback() { queries.push('ROLLBACK'); },
  };
}

describe('cloud inspection', () => {
  it('reports an empty business database without importing the existing login account', async () => {
    const db = database();
    const result = await inspectCloudDatabase(db);
    expect(result.counts.MODULE_ACCOUNT).toBe(1);
    expect(result.records).toEqual({});
    expect(result.importableRows).toBe(0);
    expect(db.queries.some(sql => /SELECT \* FROM `MODULE_(ACCOUNT|SESSION)`/.test(sql))).toBe(false);
    expect(db.queries[0]).toBe('SET SESSION TRANSACTION READ ONLY');
    expect(db.queries.at(-1)).toBe('ROLLBACK');
  });

  it('captures reusable template content in a private snapshot and leaves cloud rows untouched', async () => {
    const db = database({ populated: true });
    const result = await inspectCloudDatabase(db);
    expect(result.records.EMAIL_TEMPLATE).toEqual([{ template_id: 7, template_name: 'Team template', body: 'Dear [CandidateName]' }]);
    expect(result.importableRows).toBe(1);
    expect(db.queries.some(sql => /^(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)/.test(sql))).toBe(false);
  });

  it('ends the read-only transaction when inspection fails', async () => {
    const db = database({ fail: true });
    await expect(inspectCloudDatabase(db)).rejects.toThrow('Connection interrupted');
    expect(db.queries.at(-1)).toBe('ROLLBACK');
  });
});
