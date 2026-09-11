export const user = {
  userId: 1,
  fullName: "Riley Morgan",
  email: "hr1@example.test",
  employeeId: "DEMO-HR-001",
  role: "HR Manager",
  department: "Human Resources",
  phone: "+65 1234 5678",
  officeLocation: "Demo Office",
  accountStatus: "ACTIVE",
  lastLoginAt: "2026-09-08T02:30:00Z",
  photoUrl: null,
};
export const notifications = [
  {
    notificationId: 1,
    applicationId: 10,
    notificationType: "NEW_APPLICATION",
    title: "New application received",
    message: "Casey Taylor applied for Software Developer.",
    sourceModule: "Applications (Demo)",
    createdAt: "2026-09-08T02:30:00Z",
    isRead: false,
  },
  {
    notificationId: 2,
    applicationId: 10,
    notificationType: "STATUS_UPDATED",
    title: "Candidate status updated",
    message: "Casey Taylor is now In Progress.",
    sourceModule: "Applications (Demo)",
    createdAt: "2026-09-07T02:30:00Z",
    isRead: true,
  },
];
export const templates = [
  {
    templateId: 1,
    templateName: "Interview Invite",
    subject: "Hello [CandidateName]",
    body: "Welcome to [CompanyName].\nRegards, [HRName]",
    usageType: "INTERVIEW_INVITE",
  },
  {
    templateId: 2,
    templateName: "Offer Letter",
    subject: "Your offer for [JobTitle]",
    body: "Dear [CandidateName], your offer is ready.",
    usageType: "OFFER_LETTER",
  },
];
export const log = {
  logId: 1,
  candidateName: "Casey Taylor",
  positionTitle: "Software Developer (Demo)",
  recipientEmail: "candidate1@example.test",
  triggerEvent: "Moved to Interview",
  sourceModule: "Applications (Demo)",
  templateName: "Historical Invite",
  sentAt: "2026-09-08T02:30:00Z",
  deliveryStatus: "SENT",
  isDemo: true,
  emailSubject: "Original saved subject",
  emailBody:
    "SIMULATED HISTORY — no email was sent.\nOriginal content remains unchanged.",
  attachments: [],
};
