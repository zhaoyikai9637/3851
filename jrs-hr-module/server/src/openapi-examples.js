// Fictional documentation examples only. This token cannot establish a session.
const at = '2026-09-09T02:30:00.000Z';
export const exampleCsrf = '0'.repeat(64);
export const exampleProfile = {
  userId: 1, employeeId: 'DEMO-HR-001', fullName: 'Riley Morgan',
  email: 'hr1@example.test', phone: '', role: 'HR Manager',
  department: 'Human Resources', officeLocation: 'Demo Office',
  photoUrl: null, accountStatus: 'ACTIVE', lastLoginAt: null,
};
export const exampleTemplateInput = {
  templateName: 'Example acknowledgement', subject: 'Hello [CandidateName]',
  body: 'Thank you for applying to [CompanyName] for [JobTitle]. Regards, [HRName]',
  usageType: 'IN_PROGRESS',
};
export const exampleTemplate = {
  ...exampleTemplateInput, templateId: 1, isActive: true,
  createdBy: 1, updatedBy: null, createdAt: at, updatedAt: at,
};
export const exampleNotification = {
  notificationId: 1, recipientUserId: 1, applicationId: 1,
  notificationType: 'NEW_APPLICATION', title: 'New application received',
  message: 'Casey Taylor applied for Software Developer (Demo).',
  sourceModule: 'Applications (Demo)', isRead: false, readAt: null, createdAt: at,
};
export const exampleLog = {
  logId: 1, applicationId: 1, templateId: 1, senderUserId: 1,
  triggerEvent: 'Moved to Interview', sourceModule: 'Applications (Demo)',
  recipientEmail: 'candidate1@example.test', candidateName: 'Casey Taylor',
  positionTitle: 'Software Developer (Demo)', templateName: 'Historical invitation',
  emailSubject: 'SIMULATED interview invitation', deliveryStatus: 'SENT',
  sentAt: at, createdAt: at, isDemo: true,
};
export const exampleLogDetail = {
  ...exampleLog,
  emailBody: 'SIMULATED HISTORY: no email was sent. Dear Casey, this is the original saved content.',
  attachments: [{ attachmentId: 1, fileName: 'Demo note.txt', fileType: 'text/plain' }],
};
export const exampleApplication = {
  applicationId: 1, candidateName: 'Casey Taylor',
  positionTitle: 'Software Developer (Demo)', currentStatus: 'In Progress', appliedAt: at,
};
const sample = (value, summary = 'Fictional example; IDs are illustrative') => ({ summary, value });
const page = item => ({ items: [item], total: 1, page: 1, pageSize: 10 });
export const successExamples = {
  health: { healthy: sample({ status: 'ok', module: 'hr-notifications' }, 'Process is running') },
  csrf: { token: sample({ csrfToken: exampleCsrf }, 'Illustrative token; use the live session token') },
  authConfig: {
    pending: sample({ loginUrl: null, adapterConfigured: false }, 'Current state: teammate sign-in is not implemented'),
    registered: sample({ loginUrl: 'https://team.example.test/sign-in', adapterConfigured: true }, 'Illustrative adapter registration; not evidence of integration'),
  },
  me: { hr: sample({ user: exampleProfile, csrfToken: exampleCsrf, mode: 'standalone' }) },
  profile: { profile: sample(exampleProfile) },
  updateProfile: { saved: sample(exampleProfile) },
  uploadPhoto: { saved: sample({ ...exampleProfile, photoUrl: '/api/hr/profile/photo' }) },
  notifications: {
    unread: sample({ ...page(exampleNotification), unread: 1 }),
    empty: sample({ items: [], total: 0, page: 1, pageSize: 10, unread: 0 }, 'No notifications match the filters'),
  },
  readAll: { updated: sample({ updated: 1 }, 'Number of previously unread notifications updated') },
  templates: { available: sample({ items: [exampleTemplate] }), empty: sample({ items: [] }, 'No active templates') },
  createTemplate: { created: sample(exampleTemplate) },
  updateTemplate: { saved: sample({ ...exampleTemplate, updatedBy: 1 }) },
  logs: { sent: sample(page(exampleLog)), empty: sample({ items: [], total: 0, page: 1, pageSize: 10 }, 'No successful history matches') },
  log: { snapshot: sample(exampleLogDetail) },
  application: { assigned: sample(exampleApplication) },
};
export const requestExamples = {
  updateProfile: { allowedFields: sample({ fullName: 'Riley Morgan', phone: '', officeLocation: 'Demo Office' }) },
  createTemplate: { acknowledgement: sample(exampleTemplateInput) },
  updateTemplate: { futureContent: sample({ ...exampleTemplateInput, subject: 'Application update for [CandidateName]' }) },
};
export const errorExamples = {
  400: { malformedJson: sample({ error: { message: 'Malformed JSON body.' } }, 'Example malformed request') },
  401: { teamSignIn: sample({ error: { message: 'Continue through the team sign-in page.' } }) },
  403: {
    csrf: sample({ error: { message: 'CSRF token missing or expired. Refresh and retry.' } }),
    origin: sample({ error: { message: 'Untrusted request origin.' } }),
    inactiveHr: sample({ error: { message: 'HR profile is no longer authorized.' } }),
    changedSession: sample({ error: { message: 'The team session changed. Refresh before retrying.' } }),
  },
  404: { inaccessible: sample({ error: { message: 'Record not found or not accessible.' } }), missingFile: sample({ error: { message: 'File no longer available.' } }) },
  409: { reservedName: sample({ error: { message: 'A record with that name already exists (including archived templates).' } }) },
  413: { largeBody: sample({ error: { message: 'Request body is too large.' } }) },
  422: {
    invalidFields: sample({ error: { message: 'Please check the entered values.', fields: [{ field: 'body', message: 'Unsupported template variable' }] } }),
    upload: sample({ error: { message: 'Upload one image, no larger than 2 MB.' } }),
  },
  500: { failed: sample({ error: { message: 'Something went wrong. Please try again.' } }) },
  503: { upstream: sample({ error: { message: 'Something went wrong. Please try again.' } }, 'Upstream adapter unavailable; no identity fallback') },
};
