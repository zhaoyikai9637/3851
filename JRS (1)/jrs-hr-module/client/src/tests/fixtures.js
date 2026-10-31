export const user = {
  userId: 1,
  fullName: "Riley Morgan",
  email: "hr1@example.test",
  employeeId: "LOCAL-HR-001",
  role: "HR Manager",
  department: "Human Resources",
  phone: "+65 1234 5678",
  officeLocation: "Main Office",
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
    sourceModule: "Applications",
    createdAt: "2026-09-08T02:30:00Z",
    isRead: false,
  },
  {
    notificationId: 2,
    applicationId: 10,
    notificationType: "STATUS_UPDATED",
    title: "Candidate status updated",
    message: "Casey Taylor is now In Progress.",
    sourceModule: "Applications",
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
  positionTitle: "Software Developer",
  recipientEmail: "candidate1@example.test",
  triggerEvent: "Moved to Interview",
  sourceModule: "Applications",
  templateName: "Historical Invite",
  sentAt: "2026-09-08T02:30:00Z",
  deliveryStatus: "SENT",
  emailSubject: "Original saved subject",
  emailBody:
    "Original content remains unchanged.",
  attachments: [],
};
