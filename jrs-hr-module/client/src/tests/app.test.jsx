import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { api } from "../api";
import { user, notifications, templates, log } from "./fixtures";

const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});
let state, fetcher, overrides;
beforeEach(() => {
  api.leaveDemo();
  sessionStorage.clear();
  api.setToken("");
  state = {
    user: { ...user },
    notifications: structuredClone(notifications),
    templates: structuredClone(templates),
    log: structuredClone(log),
    signedIn: true,
  };
  overrides = {};
  fetcher = vi.fn(async (url, options = {}) => {
    const path = url.split("?")[0],
      method = options.method || "GET",
      handler = overrides[`${method} ${path}`];
    if (handler) return handler(url, options);
    if (path === "/api/auth/me")
      return state.signedIn
        ? json({
            user: state.user,
            csrfToken: "session-token",
            mode: "standalone",
          })
        : json({ error: { message: "Please sign in." } }, 401);
    if (path === "/api/auth/csrf") return json({ csrfToken: "initial-token" });
    if (path === "/api/auth/config") return json({loginUrl:null,adapterConfigured:true});
    if (path === "/api/auth/logout") {
      state.signedIn = false;
      return json(null, 204);
    }
    if (path === "/api/hr/profile") {
      if (method === "PATCH")
        Object.assign(state.user, JSON.parse(options.body));
      return json(state.user);
    }
    if (path === "/api/hr/notifications/read-all") {
      state.notifications.forEach((n) => {
        n.isRead = true;
      });
      return json({ updated: 1 });
    }
    if (path.match(/\/notifications\/\d+\/read$/)) {
      state.notifications.find(
        (n) => n.notificationId === Number(path.split("/")[4]),
      ).isRead = true;
      return json(null, 204);
    }
    if (path === "/api/hr/notifications") {
      const f = new URL(url, "http://localhost").searchParams;
      const items = state.notifications.filter(
        (n) => f.get("read") !== "unread" || !n.isRead,
      );
      return json({
        items,
        total: items.length,
        page: Number(f.get("page")),
        pageSize: 8,
        unread: state.notifications.filter((n) => !n.isRead).length,
      });
    }
    if (path === "/api/hr/applications/10")
      return json({
        applicationId: 10,
        candidateName: "Casey Taylor",
        positionTitle: "Software Developer",
        currentStatus: "In Progress",
        appliedAt: "2026-09-08T02:30:00Z",
      });
    if (path === "/api/hr/templates" && method === "GET")
      return json({ items: state.templates });
    if (path === "/api/hr/templates" && method === "POST") {
      const item = { ...JSON.parse(options.body), templateId: 3 };
      state.templates.push(item);
      return json(item, 201);
    }
    if (path.match(/\/templates\/\d+$/)) {
      const id = Number(path.split("/").at(-1));
      if (method === "DELETE") {
        state.templates = state.templates.filter((t) => t.templateId !== id);
        return json(null, 204);
      }
      const item = state.templates.find((t) => t.templateId === id);
      Object.assign(item, JSON.parse(options.body));
      return json(item);
    }
    if (path === "/api/hr/logs")
      return json({ items: [state.log], total: 1, page: 1, pageSize: 10 });
    if (path === "/api/hr/logs/1") return json(state.log);
    throw new Error(`Unhandled test route: ${method} ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
});
const mount = (path = "/notifications") => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
};
const writes = (path) =>
  fetcher.mock.calls.filter(
    ([url, options]) => url === path && options.method !== "GET",
  );

describe("authentication and navigation", () => {
  it("opens the isolated fictional demo and exits without calling protected APIs", async () => {
    state.signedIn = false;
    const ui = mount("/templates");
    await ui.click(await screen.findByRole("button", { name: "Open fictional demo" }));
    expect(await screen.findByText(/No API, database, or email activity/)).toBeVisible();
    expect(await screen.findByLabelText("Email subject")).toHaveValue(
      "Interview invitation for [JobTitle]",
    );
    expect(fetcher.mock.calls.some(([url]) => url.startsWith("/api/hr/"))).toBe(false);
    await ui.click(screen.getByRole("button", { name: /Riley Morgan HR Manager/ }));
    await ui.click(screen.getByRole("button", { name: "Logout" }));
    await ui.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Continue through team sign-in" })).toBeVisible();
  });
  it("shows the configured team entry without a password form and resumes the same page after upstream sign-in", async () => {
    state.signedIn = false;
    overrides['GET /api/auth/config'] = () => json({loginUrl:'https://team.example.test/sign-in',adapterConfigured:true});
    const ui = mount('/profile');
    const link = await screen.findByRole('link', {name:'Go to team sign-in'});
    expect(link).toHaveAttribute('href','https://team.example.test/sign-in');
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => url.startsWith('/api/hr/'))).toBe(false);
    state.signedIn = true;
    await ui.click(screen.getByRole('button', {name:'Check sign-in status'}));
    expect(await screen.findByText('DEMO-HR-001')).toBeVisible();
    expect(fetcher.mock.calls.some(([url]) => url === '/api/auth/login')).toBe(false);
  });
  it("reports the missing team integration without inventing a login URL", async () => {
    state.signedIn = false;
    overrides['GET /api/auth/config'] = () => json({loginUrl:null,adapterConfigured:false});
    mount();
    expect(await screen.findByText('Team sign-in is not connected yet.')).toBeVisible();
    expect(screen.queryByRole('link', {name:'Go to team sign-in'})).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it("displays an HR access denial without opening protected pages", async () => {
    overrides['GET /api/auth/me'] = () => json({error:{message:'A verified HR account is required.'}},403);
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('verified HR');
    expect(fetcher.mock.calls.some(([url]) => url.startsWith('/api/hr/'))).toBe(false);
  });
  it("retries a failed initial session check without losing the intended route", async () => {
    overrides['GET /api/auth/me'] = () => json({error:{message:'Service temporarily unavailable.'}},503);
    const ui = mount('/templates');
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    delete overrides['GET /api/auth/me'];
    await ui.click(screen.getByRole('button', {name:'Check sign-in status'}));
    expect(await screen.findByLabelText('Email subject')).toBeVisible();
  });
  it("does not render unsafe team login links", async () => {
    state.signedIn=false;
    overrides['GET /api/auth/config'] = () => json({loginUrl:'javascript:alert(1)',adapterConfigured:false});
    mount();
    await screen.findByRole('heading', {name:'Continue through team sign-in'});
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it("closes the avatar menu with Escape and outside clicks", async () => {
    const ui = mount();
    const account = await screen.findByRole("button", {
      name: /Riley Morgan HR Manager/,
    });
    await ui.click(account);
    expect(screen.getByText("hr1@example.test")).toBeVisible();
    await ui.keyboard("{Escape}");
    expect(account).toHaveFocus();
    expect(account).toHaveAttribute("aria-expanded", "false");
    await ui.click(account);
    await ui.click(
      screen.getByRole("heading", { name: "Notification Center" }),
    );
    expect(account).toHaveAttribute("aria-expanded", "false");
  });
  it("keeps profile access in the avatar menu and makes every workspace item navigable", async () => {
    const ui = mount();
    const account = await screen.findByRole("button", {
      name: /Riley Morgan HR Manager/,
    });
    expect(screen.queryByRole("link", { name: "My Profile" })).not.toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    for (const name of [
      "Dashboard",
      "Applications",
      "Candidates",
      "Job Postings",
      "Interviews",
    ]) {
      expect(within(navigation).getByRole("link", { name })).toBeVisible();
    }
    expect(within(navigation).getByRole("link", { name: "Notifications" })).toBeVisible();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Workspace/Notification Center");
    const communication = screen.getByRole("navigation", {
      name: "Communication pages",
    });
    for (const name of [
      "Notification Center",
      "Email Templates",
      "Notification Log",
    ]) {
      expect(within(communication).getByRole("link", { name })).toBeVisible();
    }
    await ui.click(account);
    expect(screen.getByRole("link", { name: "My Profile" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Edit Profile" })).not.toBeInTheDocument();
  });
  it("moves the sidebar highlight away from Notifications on team placeholder routes", async () => {
    const ui = mount();
    const navigation = await screen.findByRole("navigation", {
      name: "Main navigation",
    });
    const notifications = within(navigation).getByRole("link", {
      name: "Notifications",
    });
    expect(notifications).toHaveClass("active");
    const dashboard = within(navigation).getByRole("link", {
      name: "Dashboard",
    });
    await ui.click(dashboard);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(dashboard).toHaveClass("active");
    expect(notifications).not.toHaveClass("active");
    expect(screen.getByText("This area is ready for the recruitment team module.")).toBeVisible();
  });
  it("retains the session when logout fails, then clears it only on success", async () => {
    overrides["POST /api/auth/logout"] = () =>
      json({ error: { message: "Please retry logout." } }, 500);
    const ui = mount();
    await ui.click(
      await screen.findByRole("button", { name: /Riley Morgan HR Manager/ }),
    );
    await ui.click(screen.getByRole("button", { name: "Logout" }));
    await ui.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Logout",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please retry logout",
    );
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    delete overrides["POST /api/auth/logout"];
    await ui.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Logout",
      }),
    );
    expect(await screen.findByRole('heading', {name:'Continue through team sign-in'})).toBeVisible();
  });
  it("clears protected content when the server reports an expired session", async () => {
    overrides["GET /api/hr/notifications"] = () =>
      json({ error: { message: "Please sign in." } }, 401);
    mount();
    expect(await screen.findByRole('heading', {name:'Continue through team sign-in'})).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("session has expired");
    expect(
      screen.queryByText("New application received"),
    ).not.toBeInTheDocument();
  });
});

describe("notification workflow", () => {
  it("shows loading until the API resolves", async () => {
    let resolve;
    overrides["GET /api/hr/notifications"] = () =>
      new Promise((r) => {
        resolve = r;
      });
    mount();
    await screen.findByRole("heading", { name: "Notification Center" });
    expect(screen.getByText("Loading…")).toBeVisible();
    resolve(json({ items: [], total: 0, page: 1, pageSize: 8, unread: 0 }));
    expect(await screen.findByText("No notifications found")).toBeVisible();
  });
  it("shows a fetch error and reloads on retry", async () => {
    overrides["GET /api/hr/notifications"] = () =>
      json({ error: { message: "Temporary failure" } }, 500);
    const ui = mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Temporary failure",
    );
    delete overrides["GET /api/hr/notifications"];
    await ui.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("New application received")).toBeVisible();
  });
  it("marks an unread notification and reloads the authoritative list", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    await ui.click(screen.getByRole("button", { name: /Unread 1/ }));
    await screen.findByText("New application received");
    expect(
      screen.queryByText("Candidate status updated"),
    ).not.toBeInTheDocument();
    await ui.click(
      screen.getByRole("button", {
        name: /Mark New application received as read/,
      }),
    );
    expect(await screen.findByText("You're all caught up")).toBeVisible();
    expect(writes("/api/hr/notifications/1/read")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Unread 0/ })).toBeVisible();
  });
  it("leaves unread state visible when a mutation fails", async () => {
    overrides["PATCH /api/hr/notifications/1/read"] = () =>
      json({ error: { message: "Could not save read state." } }, 500);
    const ui = mount();
    await screen.findByText("New application received");
    await ui.click(
      screen.getByRole("button", {
        name: /Mark New application received as read/,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save",
    );
    expect(screen.getByRole("button", { name: /Unread 1/ })).toBeVisible();
  });
  it("marks all read and disables the action at zero unread", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    await ui.click(screen.getByRole("button", { name: /Mark all as read/ }));
    await screen.findByText("All notifications marked as read.");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Mark all as read/ }),
      ).toBeDisabled(),
    );
    expect(writes("/api/hr/notifications/read-all")).toHaveLength(1);
  });
  it("applies date and type filters and clears them", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    await ui.selectOptions(
      screen.getByLabelText("Notification type"),
      "STATUS_UPDATED",
    );
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "09/01/2026" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "09/09/2026" },
    });
    await ui.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([url]) =>
          url.includes("type=STATUS_UPDATED&from=2026-09-01&to=2026-09-09"),
        ),
      ).toBe(true),
    );
    await ui.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("From date")).toHaveValue("");
    expect(screen.getByLabelText("Notification type")).toHaveValue("");
  });
  it("uses an English MM/DD/YYYY date format and rejects invalid dates", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    expect(screen.getByLabelText("From date")).toHaveAttribute("placeholder", "MM/DD/YYYY");
    expect(screen.getByLabelText("To date")).toHaveAttribute("placeholder", "MM/DD/YYYY");
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "13/40/2026" },
    });
    await ui.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("MM/DD/YYYY");
  });
  it("restores calendar selection while keeping the English display format", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    const fromCalendar = screen.getByLabelText(
      "Choose From date from calendar",
    );
    const toCalendar = screen.getByLabelText("Choose To date from calendar");
    expect(fromCalendar).toHaveAttribute("type", "date");
    expect(toCalendar).toHaveAttribute("type", "date");
    expect(fromCalendar.getAttribute("max")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toCalendar).toHaveAttribute("max", fromCalendar.getAttribute("max"));
    fromCalendar.focus();
    expect(fromCalendar).toHaveFocus();
    expect(fireEvent.wheel(fromCalendar)).toBe(false);
    expect(fromCalendar).not.toHaveFocus();
    fireEvent.change(fromCalendar, {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(toCalendar, {
      target: { value: "2026-09-09" },
    });
    expect(screen.getByLabelText("From date")).toHaveValue("09/01/2026");
    expect(screen.getByLabelText("To date")).toHaveValue("09/09/2026");
    await ui.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([url]) =>
          url.includes("from=2026-09-01&to=2026-09-09"),
        ),
      ).toBe(true),
    );
  });
  it("limits the calendar and rejects future manual dates", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    const fromCalendar = screen.getByLabelText(
      "Choose From date from calendar",
    );
    expect(fromCalendar.getAttribute("max")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "12/31/9999" },
    });
    await ui.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Future dates are not available for activity history.",
    );
    expect(
      fetcher.mock.calls.some(([url]) => url.includes("to=9999-12-31")),
    ).toBe(false);
  });
  it("shows only a clearly labeled read-only application summary", async () => {
    const ui = mount();
    await ui.click(
      await screen.findByRole("button", {
        name: "View application for New application received",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Casey Taylor")).toBeVisible();
    expect(dialog).toHaveTextContent("Read-only summary");
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
  });
});

describe("email templates", () => {
  it("updates only template fields and supports cancelling local edits", async () => {
    const ui = mount("/templates");
    const subject = await screen.findByLabelText("Email subject");
    await ui.clear(subject);
    await ui.type(subject, "Changed subject");
    await ui.click(screen.getByRole("button", { name: "Cancel" }));
    expect(subject).toHaveValue("Hello [CandidateName]");
    await ui.clear(subject);
    await ui.type(subject, "Saved subject");
    await ui.click(screen.getByRole("button", { name: "Save template" }));
    expect(await screen.findByText("Template saved.")).toBeVisible();
    expect(JSON.parse(writes("/api/hr/templates/1")[0][1].body)).toEqual({
      templateName: "Interview Invite",
      subject: "Saved subject",
      body: templates[0].body,
      usageType: "INTERVIEW_INVITE",
    });
  });
  it("creates a new template with a selected usage", async () => {
    const ui = mount("/templates");
    await screen.findByLabelText("Email subject");
    await ui.click(screen.getByRole("button", { name: /Create template/ }));
    await ui.type(screen.getByLabelText("Template name"), "Acknowledgement");
    await ui.type(screen.getByLabelText("Email subject"), "Thank you");
    await ui.type(
      screen.getByLabelText("Email body"),
      "We received your application.",
    );
    await ui.selectOptions(screen.getByLabelText("Usage type"), "IN_PROGRESS");
    await ui.click(screen.getByRole("button", { name: "Save template" }));
    expect(await screen.findByText("Template saved.")).toBeVisible();
    expect(JSON.parse(writes("/api/hr/templates")[0][1].body).usageType).toBe(
      "IN_PROGRESS",
    );
  });
  it("rejects unsupported variables before submitting", async () => {
    const ui = mount("/templates");
    const subject = await screen.findByLabelText("Email subject");
    fireEvent.change(subject, { target: { value: "Hello [Password]" } });
    await ui.click(screen.getByRole("button", { name: "Save template" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsupported variable: [Password]",
    );
    expect(writes("/api/hr/templates/1")).toHaveLength(0);
  });
  it("inserts variables at the subject cursor and previews HTML as plain text", async () => {
    const ui = mount("/templates");
    const subject = await screen.findByLabelText("Email subject");
    await ui.clear(subject);
    await ui.type(subject, "Hello ");
    await ui.click(screen.getByRole("button", { name: "[CandidateName]" }));
    await waitFor(() => expect(subject).toHaveValue("Hello [CandidateName]"));
    fireEvent.change(screen.getByLabelText("Email body"), {
      target: { value: "<img src=x onerror=alert(1)> [CompanyName]" },
    });
    await ui.click(screen.getByRole("button", { name: "Preview" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Hello Casey Taylor");
    expect(dialog).toHaveTextContent("<img src=x onerror=alert(1)> JRS");
    expect(dialog.querySelector("img")).toBeNull();
  });
  it("preserves edits on conflict errors", async () => {
    overrides["PUT /api/hr/templates/1"] = () =>
      json(
        {
          error: {
            message: "Name already exists, including archived templates.",
          },
        },
        409,
      );
    const ui = mount("/templates");
    const name = await screen.findByLabelText("Template name");
    await ui.clear(name);
    await ui.type(name, "Duplicate");
    await ui.click(screen.getByRole("button", { name: "Save template" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already exists",
    );
    expect(name).toHaveValue("Duplicate");
  });
  it("asks before switching a dirty template", async () => {
    const ui = mount("/templates");
    const subject = await screen.findByLabelText("Email subject");
    await ui.type(subject, " unsaved");
    await ui.click(
      screen.getByRole("button", { name: /Offer Letter Offer letter/ }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Discard unsaved changes?",
    );
    await ui.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(subject).toHaveValue("Hello [CandidateName] unsaved");
    await ui.click(
      screen.getByRole("button", { name: /Offer Letter Offer letter/ }),
    );
    await ui.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByLabelText("Email subject")).toHaveValue(
      "Your offer for [JobTitle]",
    );
  });
  it("deletes only after confirmation, explains historical preservation", async () => {
    const ui = mount("/templates");
    await screen.findByLabelText("Email subject");
    await ui.click(screen.getByRole("button", { name: "Delete", exact: true }));
    expect(writes("/api/hr/templates/1")).toHaveLength(0);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Previously sent emails keep their original content",
    );
    await ui.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(writes("/api/hr/templates/1")).toHaveLength(0);
    await ui.click(screen.getByRole("button", { name: "Delete", exact: true }));
    await ui.click(screen.getByRole("button", { name: "Delete template" }));
    expect(await screen.findByText(/Template deleted/)).toBeVisible();
    expect(writes("/api/hr/templates/1")[0][1].method).toBe("DELETE");
  });
});

describe("logs and HR profile", () => {
  it("shows simulated sent history and the immutable detail snapshot", async () => {
    const ui = mount("/logs");
    expect(await screen.findByText("Simulated · No email sent")).toBeVisible();
    await ui.click(
      screen.getByRole("button", { name: "View email to Casey Taylor" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      await within(dialog).findByText("Original saved subject"),
    ).toBeVisible();
    expect(dialog).toHaveTextContent("Original content remains unchanged");
    expect(dialog).toHaveTextContent("No attachments for this email");
  });
  it("shows attachment errors without presenting a fake download", async () => {
    state.log.attachments = [{ attachmentId: 8, fileName: "offer.pdf" }];
    overrides["GET /api/hr/attachments/8/download"] = () =>
      json({ error: { message: "File no longer available." } }, 404);
    const ui = mount("/logs");
    await ui.click(
      await screen.findByRole("button", { name: "View email to Casey Taylor" }),
    );
    await ui.click(
      await screen.findByRole("button", { name: "Download offer.pdf" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File no longer available",
    );
  });
  it("sends exact trigger and search filters", async () => {
    const ui = mount("/logs");
    await screen.findByText("Casey Taylor");
    await ui.type(screen.getByLabelText("Candidate or position"), "Casey");
    await ui.type(screen.getByLabelText("Trigger event"), "Moved to Interview");
    await ui.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([url]) =>
          url.includes("search=Casey&trigger=Moved+to+Interview"),
        ),
      ).toBe(true),
    );
  });
  it("renders employment details as read-only text", async () => {
    mount("/profile");
    expect(await screen.findByText("DEMO-HR-001")).toBeVisible();
    expect(screen.getByText("+65 1234 5678")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("submits only the allowed fields and updates the avatar account name", async () => {
    const ui = mount("/profile/edit");
    const name = await screen.findByLabelText("Full name");
    await ui.clear(name);
    await ui.type(name, "Riley Updated");
    await ui.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Profile changes saved.")).toBeVisible();
    expect(JSON.parse(writes("/api/hr/profile")[0][1].body)).toEqual({
      fullName: "Riley Updated",
      phone: user.phone,
      officeLocation: user.officeLocation,
    });
    expect(
      screen.getByRole("button", { name: /Riley Updated HR Manager/ }),
    ).toBeVisible();
  });
  it("rejects oversized avatar uploads locally", async () => {
    const ui = mount("/profile/edit");
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "huge.png", {
      type: "image/png",
    });
    await ui.upload(await screen.findByLabelText("Choose a photo"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no larger than 2 MB",
    );
    expect(writes("/api/hr/profile/photo")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeDisabled();
  });
  it("uploads the chosen photo as FormData and preserves unsaved profile text", async () => {
    overrides["POST /api/hr/profile/photo"] = () =>
      json({ ...user, photoUrl: "/api/hr/profile/photo" });
    const ui = mount("/profile/edit");
    const name = await screen.findByLabelText("Full name");
    await ui.clear(name);
    await ui.type(name, "Unsaved Riley");
    await ui.upload(
      screen.getByLabelText("Choose a photo"),
      new File(["valid-in-transport-test"], "face.png", { type: "image/png" }),
    );
    await ui.click(screen.getByRole("button", { name: "Upload photo" }));
    expect(await screen.findByText("Profile photo updated.")).toBeVisible();
    expect(writes("/api/hr/profile/photo")[0][1].body.get("photo").name).toBe(
      "face.png",
    );
    expect(name).toHaveValue("Unsaved Riley");
  });
});
