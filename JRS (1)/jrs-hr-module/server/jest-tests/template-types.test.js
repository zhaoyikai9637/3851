import { describe, expect, test, jest } from '@jest/globals';
import Ajv from 'ajv';
import types from '../../shared/template-types.json' with { type: 'json' };

// Simulate a shared configuration extension, not a real database change.
jest.unstable_mockModule('../../shared/template-types.json', () => ({
  default: { ...types, INTERVIEW_REMINDER: 'Interview reminder' }
}));
const { templateSchema } = await import('../src/validation.js');
const { openapi } = await import('../src/openapi.js');
const input = { templateName: 'Reminder', subject: 'Interview reminder', body: 'Please review your invitation.', usageType: 'INTERVIEW_REMINDER' };

describe('shared template types', () => {
  test.each(['APPLICATION_REJECTION', 'INTERVIEW_REJECTION', 'OFFER_WITHDRAWAL', 'OFFER_DECLINED_ACKNOWLEDGEMENT'])('accepts stage-specific %s in validation and the API contract', usageType => {
    const value = { ...input, usageType };
    expect(templateSchema.safeParse(value).success).toBe(true);
    expect(new Ajv({ strict: false }).compile(openapi.components.schemas.TemplateInput)(value)).toBe(true);
  });
  test('accepts a type added only to the shared registry', () => {
    expect(templateSchema.parse(input).usageType).toBe('INTERVIEW_REMINDER');
  });
  test('accepts the added type in the API request schema', () => {
    const schema = openapi.components.schemas.TemplateInput;
    expect(new Ajv({ strict: false }).compile(schema)(input)).toBe(true);
  });
  test.each(['FUTURE_WORKFLOW', 'toString', ''])('rejects unsupported type %s', usageType => {
    expect(templateSchema.safeParse({ ...input, usageType }).success).toBe(false);
  });
  test('allows reading an unknown stored code without allowing it on writes', () => {
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(openapi.components.schemas.Template);
    expect(validate({ ...input, usageType: 'FUTURE_WORKFLOW', templateId: 1, isActive: true,
      createdBy: 1, updatedBy: 1, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z' })).toBe(true);
  });
});
