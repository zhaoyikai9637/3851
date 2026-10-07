import { describe, expect, test } from '@jest/globals';
import content from '../data/original-content.json' with { type: 'json' };
import { installOriginalTemplates } from '../src/original-content.js';
import { templateSchema, renderTemplate } from '../src/validation.js';

describe('original content installation', () => {
  test.each(content.templates)('validates and renders $templateName using the supported variables', template => {
    expect(templateSchema.safeParse(template).success).toBe(true);
    const text = renderTemplate(template.subject + template.body, {
      CandidateName: 'Avery Chen', JobTitle: 'QA Analyst', CompanyName: 'Example Company', HRName: 'Jordan Lin'
    });
    expect(text).not.toMatch(/\[(CandidateName|JobTitle|CompanyName|HRName)\]/);
  });
  test('retains owner edits and avoids duplicate rows on repeated installation', async () => {
    const rows = [{ templateName: 'JRS — Interview invitation', body: 'Owner edited content.' }];
    const transaction = {};
    const db = { transaction: async run => run(transaction) };
    const models = {
      HrUser: { findByPk: async () => ({ accountStatus: 'ACTIVE' }) },
      Template: { findOrCreate: async ({ where, defaults, transaction: passed }) => {
        expect(passed).toBe(transaction);
        const existing = rows.find(row => row.templateName === where.templateName);
        if (existing) return [existing, false];
        const row = { ...defaults }; rows.push(row); return [row, true];
      } }
    };
    expect(await installOriginalTemplates(db, models, 1)).toEqual({ created: 4, retained: 1 });
    expect(await installOriginalTemplates(db, models, 1)).toEqual({ created: 0, retained: 5 });
    expect(rows).toHaveLength(5);
    expect(rows[0].body).toBe('Owner edited content.');
    expect(rows[1]).toMatchObject({ createdBy: 1, updatedBy: 1, isActive: true });
  });
  test.each([null, { accountStatus: 'DISABLED' }])('rejects a missing or inactive HR profile: %j', async hr => {
    const db = { transaction: async run => run({}) };
    const models = { HrUser: { findByPk: async () => hr }, Template: { findOrCreate: async () => { throw new Error('Unexpected template write'); } } };
    await expect(installOriginalTemplates(db, models, 99)).rejects.toThrow('active HR profile');
  });
});
