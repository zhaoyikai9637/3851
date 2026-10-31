import { describe, it, expect, vi } from 'vitest';
import Ajv from 'ajv';
vi.mock('../../shared/template-types.json', async (importOriginal) => ({
  default: { ...(await importOriginal()).default, INTERVIEW_REMINDER: 'Interview reminder' },
}));
import { templateSchema } from '../src/validation.js';
import { contractValidator } from './helpers/api-contract.js';

describe('template type extension', () => {
  const input = { templateName: 'Reminder', subject: 'Your interview', body: 'Please review your invitation.', usageType: 'INTERVIEW_REMINDER' };
  it.each(['APPLICATION_REJECTION', 'INTERVIEW_REJECTION', 'OFFER_WITHDRAWAL', 'OFFER_DECLINED_ACKNOWLEDGEMENT'])('accepts stage-specific %s in validation and the API contract', async usageType => {
    const value = { ...input, usageType };
    expect(templateSchema.safeParse(value).success).toBe(true);
    const contract = await contractValidator();
    expect(new Ajv({ strict: false }).compile(contract.spec.components.schemas.TemplateInput)(value)).toBe(true);
  });
  it('accepts a shared-config extension in backend validation', () => {
    expect(templateSchema.parse(input).usageType).toBe('INTERVIEW_REMINDER');
  });
  it('accepts the same extension in the documented request contract', async () => {
    const contract = await contractValidator();
    const schema = contract.spec.paths['/api/hr/templates'].post.requestBody.content['application/json'].schema;
    expect(new Ajv({ strict: false }).compile(schema)(input)).toBe(true);
  });
  it('documents unknown stored types as readable without allowing unknown writes', async () => {
    const contract = await contractValidator();
    const item = { ...input, usageType: 'FUTURE_WORKFLOW', templateId: 1, isActive: true, createdBy: 1, updatedBy: 1, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z' };
    expect(() => contract.response('/api/hr/templates', 'get', { status: 200, headers: { 'content-type': 'application/json' }, body: { items: [item] } })).not.toThrow();
    expect(templateSchema.safeParse({ ...input, usageType: 'FUTURE_WORKFLOW' }).success).toBe(false);
  });
});
