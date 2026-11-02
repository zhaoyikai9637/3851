import { describe, expect, test } from '@jest/globals';
import {
  HttpError, businessToday, idSchema, logFiltersSchema,
  notificationFiltersSchema, profileSchema, renderTemplate, templateSchema
} from '../src/validation.js';

const template = {
  templateName: 'Interview Invite',
  subject: 'Hello [CandidateName]',
  body: 'Interview for [JobTitle] at [CompanyName]. Regards, [HRName]',
  usageType: 'INTERVIEW_INVITE'
};

describe('email template validation', () => {
  test('renders the four approved placeholders as plain text without recursive substitution', () => {
    expect(renderTemplate('[CandidateName] [JobTitle] [CompanyName] [HRName]', {
      CandidateName: '[HRName]', JobTitle: '<Engineer>', CompanyName: 'Example', HRName: 'Riley'
    })).toBe('[HRName] <Engineer> Example Riley');
  });

  test.each(['[Unknown]', '[CandidateName]'])('rejects unsupported or missing placeholder %s', input => {
    try {
      renderTemplate(input, {});
      throw new Error('Expected a validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(422);
    }
  });

  test('trims allowed template fields', () => {
    expect(templateSchema.parse({ ...template, templateName: ' Interview Invite ' })).toEqual(template);
  });

  test.each([
    { subject: 'Hi\nBcc: someone@example.test' },
    { body: '[Unknown]' },
    { templateName: ' ' },
    { usageType: 'REMINDER' },
    { createdBy: 1 }
  ])('rejects invalid or extra template input %#', patch => {
    expect(templateSchema.safeParse({ ...template, ...patch }).success).toBe(false);
  });
});

describe('profile and identifier validation', () => {
  test('normalizes only editable profile fields', () => {
    expect(profileSchema.parse({ fullName: ' Riley ', phone: ' +65 1234 ', officeLocation: ' Office ' }))
      .toEqual({ fullName: 'Riley', phone: '+65 1234', officeLocation: 'Office' });
  });

  test.each(['email', 'employeeId', 'role', 'accountStatus', 'profilePhotoUrl', 'userId'])
    ('rejects protected profile field %s', field => {
      expect(profileSchema.safeParse({ fullName: 'Riley', phone: '', officeLocation: '', [field]: 'changed' }).success)
        .toBe(false);
    });

  test.each(['0', '-1', '1.5', '2147483648', 'not-a-number'])('rejects invalid ID %s', value => {
    expect(idSchema.safeParse(value).success).toBe(false);
  });
});

describe('historical date filters', () => {
  test('uses the UTC+08 calendar-day boundary', () => {
    expect(businessToday(new Date('2026-09-10T15:59:59Z'))).toBe('2026-09-10');
    expect(businessToday(new Date('2026-09-10T16:00:00Z'))).toBe('2026-09-11');
  });

  test('supplies bounded notification pagination defaults', () => {
    expect(notificationFiltersSchema.parse({})).toMatchObject({ page: 1, pageSize: 10, read: 'all' });
  });

  test.each([
    { from: '2026-02-30' }, { from: '9999-12-31' }, { to: '9999-12-31' },
    { from: '2026-09-09', to: '2026-09-08' }, { page: '0' }, { pageSize: '51' },
    { unexpected: 'x' }
  ])('rejects malformed notification filters %#', filters => {
    expect(notificationFiltersSchema.safeParse(filters).success).toBe(false);
  });

  test('accepts only SENT as a log status filter', () => {
    expect(logFiltersSchema.parse({ status: 'SENT', search: ' Riley ' })).toMatchObject({ status: 'SENT', search: 'Riley' });
    expect(logFiltersSchema.safeParse({ status: 'PREVIEW' }).success).toBe(false);
  });

  test('rejects future dates on the log path too', () => {
    expect(logFiltersSchema.safeParse({ to: '9999-12-31' }).success).toBe(false);
  });
});
