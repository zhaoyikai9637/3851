import { describe, expect, it } from 'vitest';
import { installOriginalTemplates } from '../src/original-content.js';
import { templateSchema, renderTemplate } from '../src/validation.js';
import content from '../data/original-content.json' with { type: 'json' };

describe('original HR content', () => {
  it('validates and renders every template with the existing four-variable contract', () => {
    for (const template of content.templates) {
      expect(templateSchema.safeParse(template).success).toBe(true);
      const text = renderTemplate(template.subject + template.body, { CandidateName: 'Avery Chen', JobTitle: 'QA Analyst', CompanyName: 'Example Company', HRName: 'Jordan Lin' });
      expect(text).not.toMatch(/\[(CandidateName|JobTitle|CompanyName|HRName)\]/);
    }
  });
  it('installs missing templates while retaining an owner-edited template on repeated runs', async () => {
    const rows = [{ templateName: 'JRS — Interview invitation', body: 'Owner edited this content.' }];
    const models = {
      HrUser: { findByPk: async id => id === 1 ? { accountStatus: 'ACTIVE' } : null },
      Template: { findOrCreate: async ({ where, defaults }) => {
        const existing = rows.find(row => row.templateName === where.templateName);
        if (existing) return [existing, false];
        const row = { ...where, ...defaults }; rows.push(row); return [row, true];
      } },
    };
    const db = { transaction: async callback => callback({}) };
    expect(await installOriginalTemplates(db, models, 1)).toEqual({ created: 8, retained: 1 });
    expect(await installOriginalTemplates(db, models, 1)).toEqual({ created: 0, retained: 9 });
    expect(rows[0].body).toBe('Owner edited this content.');
    expect(rows[1].createdBy).toBe(1);
  });
  it('refuses to attach content to an unknown HR profile', async () => {
    await expect(installOriginalTemplates({ transaction: async fn => fn({}) }, { HrUser: { findByPk: async () => null } }, 999)).rejects.toThrow('active HR profile');
  });
});
