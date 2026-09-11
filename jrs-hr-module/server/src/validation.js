import { z } from 'zod';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const idSchema = z.coerce.number().int().positive().max(2147483647);
const line = n => z.string().trim().min(1).max(n).refine(s => !/[\r\n]/.test(s), 'Must be one line');
export const variables = ['CandidateName', 'JobTitle', 'CompanyName', 'HRName'];
export function renderTemplate(text, values) {
  return text.replace(/\[([A-Za-z][A-Za-z0-9_]*)\]/g, (_, key) => {
    if (!variables.includes(key) || typeof values[key] !== 'string') throw new HttpError(422, `Unsupported or missing variable: [${key}]`);
    return values[key];
  });
}
const templateContent = z.string().trim().min(1).max(20000).refine(s => [...s.matchAll(/\[([A-Za-z][A-Za-z0-9_]*)\]/g)].every(m => variables.includes(m[1])), 'Unsupported template variable');
export const usageTypes = ['INTERVIEW_INVITE', 'OFFER_LETTER', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS'];
export const templateSchema = z.object({ templateName: line(150), subject: templateContent.refine(s => s.length <= 255 && !/[\r\n]/.test(s), 'Subject must be one line, 255 characters maximum'), body: templateContent, usageType: z.enum(usageTypes) }).strict();
export const profileSchema = z.object({ fullName: line(100), phone: z.string().trim().max(20).regex(/^[+0-9 ()-]*$/, 'Enter a valid phone number'), officeLocation: z.string().trim().max(100) }).strict();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), 'Invalid date').optional();
const sharedFilters = {
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10),
  from: date, to: date
};
const chronological = schema => schema.strict().refine(x => !x.from || !x.to || x.from <= x.to, { message: 'From date must not be after To date', path: ['to'] });
export const notificationFiltersSchema = chronological(z.object({
  ...sharedFilters,
  read: z.enum(['all', 'unread']).default('all'), type: z.enum(['NEW_APPLICATION', 'STATUS_UPDATED']).optional(),
}));
export const logFiltersSchema = chronological(z.object({
  ...sharedFilters, search: z.string().trim().max(150).optional(), trigger: z.string().trim().max(100).optional(),
  status: z.literal('SENT').optional()
}));
// Kept for existing notification-filter callers; logs have their own strict contract.
export const filtersSchema = notificationFiltersSchema;
