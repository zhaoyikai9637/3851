const STORAGE_KEY = "jrs.hr.local-demo.v1";

const seed = () => ({
  user: {
    userId: 9001,
    fullName: "Riley Morgan",
    email: "riley.morgan@example.test",
    employeeId: "DEMO-HR-001",
    role: "HR Manager",
    department: "Human Resources",
    phone: "+65 6123 4567",
    officeLocation: "Harbour Demo Office",
    accountStatus: "ACTIVE",
    lastLoginAt: "2026-09-10T01:15:00Z",
    photoUrl: null,
  },
  notifications: [
    {
      notificationId: 101,
      applicationId: 501,
      notificationType: "NEW_APPLICATION",
      title: "New application received",
      message: "Casey Taylor applied for Software Developer.",
      sourceModule: "Applications (Fictional demo)",
      createdAt: "2026-09-10T02:30:00Z",
      isRead: false,
    },
    {
      notificationId: 102,
      applicationId: 502,
      notificationType: "STATUS_UPDATED",
      title: "Candidate status updated",
      message: "Jordan Lee moved to the interview stage.",
      sourceModule: "Applications (Fictional demo)",
      createdAt: "2026-09-09T07:45:00Z",
      isRead: false,
    },
    {
      notificationId: 103,
      applicationId: 501,
      notificationType: "STATUS_UPDATED",
      title: "Application review completed",
      message: "Casey Taylor is now In Progress.",
      sourceModule: "Applications (Fictional demo)",
      createdAt: "2026-09-08T04:10:00Z",
      isRead: true,
    },
  ],
  applications: {
    501: { candidateName: "Casey Taylor", positionTitle: "Software Developer", currentStatus: "IN_PROGRESS", appliedAt: "2026-09-08T02:30:00Z" },
    502: { candidateName: "Jordan Lee", positionTitle: "Product Designer", currentStatus: "INTERVIEW", appliedAt: "2026-09-07T06:20:00Z" },
  },
  templates: [
    { templateId: 201, templateName: "Interview Invite", subject: "Interview invitation for [JobTitle]", body: "Dear [CandidateName],\n\nWe would like to invite you to an interview for the [JobTitle] role at [CompanyName].\n\nKind regards,\n[HRName]", usageType: "INTERVIEW_INVITE" },
    { templateId: 202, templateName: "Offer Letter", subject: "Your offer from [CompanyName]", body: "Dear [CandidateName],\n\nWe are pleased to offer you the [JobTitle] position.\n\nKind regards,\n[HRName]", usageType: "OFFER_LETTER" },
    { templateId: 203, templateName: "Application Update", subject: "An update on your application", body: "Dear [CandidateName],\n\nYour application for [JobTitle] is currently in progress.\n\nKind regards,\n[HRName]", usageType: "IN_PROGRESS" },
    { templateId: 204, templateName: "Application Accepted", subject: "Welcome to [CompanyName]", body: "Dear [CandidateName],\n\nWe are delighted that you have accepted our offer.\n\nKind regards,\n[HRName]", usageType: "ACCEPTED" },
    { templateId: 205, templateName: "Application Outcome", subject: "Your application for [JobTitle]", body: "Dear [CandidateName],\n\nThank you for your interest. We will not be progressing your application on this occasion.\n\nKind regards,\n[HRName]", usageType: "REJECTED" },
  ],
  logs: [
    { logId: 301, candidateName: "Casey Taylor", positionTitle: "Software Developer (Fictional)", recipientEmail: "casey.taylor@example.test", triggerEvent: "Moved to Interview", sourceModule: "Applications (Fictional demo)", templateName: "Historical Interview Invite", sentAt: "2026-09-08T03:00:00Z", deliveryStatus: "SENT", isDemo: true, emailSubject: "Interview invitation for Software Developer", emailBody: "SIMULATED HISTORY — no email was sent.\n\nDear Casey Taylor, your fictional interview slot is ready.", attachments: [] },
    { logId: 302, candidateName: "Jordan Lee", positionTitle: "Product Designer (Fictional)", recipientEmail: "jordan.lee@example.test", triggerEvent: "Status Updated", sourceModule: "Applications (Fictional demo)", templateName: "Application Update", sentAt: "2026-09-07T08:00:00Z", deliveryStatus: "SENT", isDemo: true, emailSubject: "An update on your application", emailBody: "SIMULATED HISTORY — no email was sent.\n\nDear Jordan Lee, your fictional application is in progress.", attachments: [] },
  ],
  nextTemplateId: 206,
});

const copy = (value) => structuredClone(value);
const parseBody = (body) => typeof body === "string" ? JSON.parse(body) : body;
const dateOnly = (value) => value?.slice(0, 10);

function loadState() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return value?.user && Array.isArray(value.templates) ? value : seed();
  } catch {
    return seed();
  }
}

export function createDemoApi() {
  let state = loadState();
  const save = () => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const notFound = () => { throw Object.assign(new Error("This fictional demo item was not found."), { status: 404 }); };
  const listPage = (items, params, defaultSize) => {
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.max(1, Number(params.get("pageSize")) || defaultSize);
    return { items: copy(items.slice((page - 1) * pageSize, page * pageSize)), total: items.length, page, pageSize };
  };
  return {
    reset() {
      state = seed();
      save();
    },
    async me() {
      return { user: copy(state.user), mode: "demo", csrfToken: "local-demo-only" };
    },
    async csrf() {
      return { csrfToken: "local-demo-only" };
    },
    async logout() {},
    async download() {
      throw Object.assign(new Error("Demo attachments are not stored or downloaded."), { status: 404 });
    },
    async request(rawUrl, options = {}) {
      const method = options.method || "GET";
      const url = new URL(rawUrl, window.location.origin);
      const path = url.pathname;
      if (path === "/api/auth/config") return { loginUrl: null, adapterConfigured: false };
      if (path === "/api/auth/me") return this.me();
      if (path === "/api/auth/csrf") return { csrfToken: "local-demo-only" };
      if (path === "/api/auth/logout" && method === "POST") return null;
      if (path === "/api/hr/profile" && method === "GET") return copy(state.user);
      if (path === "/api/hr/profile" && method === "PATCH") {
        const body = parseBody(options.body);
        state.user = { ...state.user, fullName: body.fullName, phone: body.phone, officeLocation: body.officeLocation };
        save();
        return copy(state.user);
      }
      if (path === "/api/hr/profile/photo" && method === "POST") {
        const file = options.body?.get?.("photo");
        if (file) state.user.photoUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("The demo photo could not be read."));
          reader.readAsDataURL(file);
        });
        return copy(state.user);
      }
      if (path === "/api/hr/notifications" && method === "GET") {
        const unread = state.notifications.filter((item) => !item.isRead).length;
        let items = state.notifications.filter((item) =>
          (url.searchParams.get("read") !== "unread" || !item.isRead) &&
          (!url.searchParams.get("type") || item.notificationType === url.searchParams.get("type")) &&
          (!url.searchParams.get("from") || dateOnly(item.createdAt) >= url.searchParams.get("from")) &&
          (!url.searchParams.get("to") || dateOnly(item.createdAt) <= url.searchParams.get("to"))
        );
        return { ...listPage(items, url.searchParams, 8), unread };
      }
      if (path === "/api/hr/notifications/read-all" && method === "PATCH") {
        state.notifications.forEach((item) => { item.isRead = true; });
        save();
        return { updated: state.notifications.length };
      }
      const notificationMatch = path.match(/^\/api\/hr\/notifications\/(\d+)\/read$/);
      if (notificationMatch && method === "PATCH") {
        const item = state.notifications.find((row) => row.notificationId === Number(notificationMatch[1]));
        if (!item) return notFound();
        item.isRead = true;
        save();
        return copy(item);
      }
      const applicationMatch = path.match(/^\/api\/hr\/applications\/(\d+)$/);
      if (applicationMatch) {
        const item = state.applications[applicationMatch[1]];
        if (!item) return notFound();
        return copy(item);
      }
      if (path === "/api/hr/templates" && method === "GET") return { items: copy(state.templates) };
      if (path === "/api/hr/templates" && method === "POST") {
        const item = { ...parseBody(options.body), templateId: state.nextTemplateId++ };
        state.templates.push(item);
        save();
        return copy(item);
      }
      const templateMatch = path.match(/^\/api\/hr\/templates\/(\d+)$/);
      if (templateMatch) {
        const index = state.templates.findIndex((row) => row.templateId === Number(templateMatch[1]));
        if (index < 0) return notFound();
        if (method === "DELETE") {
          state.templates.splice(index, 1);
          save();
          return null;
        }
        if (method === "PUT") {
          state.templates[index] = { ...state.templates[index], ...parseBody(options.body) };
          save();
          return copy(state.templates[index]);
        }
      }
      if (path === "/api/hr/logs" && method === "GET") {
        const search = (url.searchParams.get("search") || "").toLowerCase();
        const trigger = (url.searchParams.get("trigger") || "").toLowerCase();
        const items = state.logs.filter((item) =>
          (!search || `${item.candidateName} ${item.positionTitle}`.toLowerCase().includes(search)) &&
          (!trigger || item.triggerEvent.toLowerCase() === trigger) &&
          (!url.searchParams.get("from") || dateOnly(item.sentAt) >= url.searchParams.get("from")) &&
          (!url.searchParams.get("to") || dateOnly(item.sentAt) <= url.searchParams.get("to"))
        );
        return listPage(items, url.searchParams, 10);
      }
      const logMatch = path.match(/^\/api\/hr\/logs\/(\d+)$/);
      if (logMatch) {
        const item = state.logs.find((row) => row.logId === Number(logMatch[1]));
        if (!item) return notFound();
        return copy(item);
      }
      throw Object.assign(new Error(`This action is unavailable in the local demo (${method} ${path}).`), { status: 404 });
    },
  };
}
