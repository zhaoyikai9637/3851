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

// Simulate a future team-approved type without adding it to live configuration.
vi.mock("../../../shared/template-types.json", async (importOriginal) => ({
  default: { ...(await importOriginal()).default, INTERVIEW_REMINDER: "Interview reminder" },
}));

const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});
let state, fetcher, overrides;
beforeEach(() => {
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
    if (path === '/recruitment/api/auth/me') return json({user:{id:'hr-test'},csrfToken:'shared-token'});
    if (path === '/recruitment/api/hr/job-postings') return json({revision:0,items:[],templates:[]});
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
      const notificationIds = state.notifications
        .filter((notification) => !notification.isRead)
        .map((notification) => notification.notificationId);
      state.notifications.forEach((n) => {
        n.isRead = true;
      });
      return json({ updated: notificationIds.length, notificationIds });
    }
    if (path === "/api/hr/notifications/restore-unread") {
      const ids = new Set(JSON.parse(options.body).notificationIds);
      state.notifications.forEach((notification) => {
        if (ids.has(notification.notificationId)) notification.isRead = false;
      });
      return json({ updated: ids.size });
    }
    if (path.match(/\/notifications\/\d+\/read$/)) {
      state.notifications.find(
        (n) => n.notificationId === Number(path.split("/")[4]),
      ).isRead = true;
      return json(null, 204);
    }
    if (path === "/api/hr/notifications") {
      const f = new URL(url, "http://localhost").searchParams;
      const search = (f.get("search") || "").toLowerCase();
      const items = state.notifications.filter(
        (n) =>
          (f.get("read") !== "unread" || !n.isRead) &&
          (!search ||
            `${n.title} ${n.message} ${n.sourceModule}`
              .toLowerCase()
              .includes(search)) &&
          (!f.get("type") || n.notificationType === f.get("type")) &&
          (!f.get("from") || n.createdAt.slice(0, 10) >= f.get("from")) &&
          (!f.get("to") || n.createdAt.slice(0, 10) <= f.get("to")),
      );
      return json({
        items,
        total: items.length,
        page: Number(f.get("page")),
        pageSize: Number(f.get("pageSize")),
        unread: state.notifications.filter((n) => !n.isRead).length,
        all: state.notifications.length,
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
  it('places communication navigation inside the white workspace header',async()=>{
    mount('/notifications');
    const nav=await screen.findByRole('navigation',{name:'Communication pages'});
    expect(nav.closest('.workspace-header')).not.toBeNull();
    expect(document.querySelector('main')).not.toContainElement(nav);
  });

  it('hosts trusted embedded sections in the header and sends selection to their source frame',async()=>{
    const ui=mount('/reports'),frame=await screen.findByTitle('Reports');
    const data={type:'jrs:sections',key:'reports-tabs',label:'Report sections',items:[{label:'Overview',selected:true},{label:'Job performance',selected:false}]};
    fireEvent(window,new MessageEvent('message',{origin:'https://untrusted.example',source:frame.contentWindow,data}));
    expect(screen.queryByRole('navigation',{name:'Report sections'})).not.toBeInTheDocument();
    fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data}));
    const nav=await screen.findByRole('navigation',{name:'Report sections'});
    expect(nav.closest('.workspace-header')).not.toBeNull();
    expect(within(nav).getByRole('button',{name:'Overview'})).toHaveAttribute('aria-pressed','true');
    const post=vi.spyOn(frame.contentWindow,'postMessage');
    await ui.click(within(nav).getByRole('button',{name:'Job performance'}));
    expect(post).toHaveBeenCalledWith({type:'jrs:select-section',key:'reports-tabs',index:1},window.location.origin);
    await ui.click(screen.getByRole('link',{name:'Dashboard',exact:true}));
    expect(screen.queryByRole('navigation',{name:'Report sections'})).not.toBeInTheDocument();
  });
  it('opens Dashboard by default after entering the HR workspace', async () => {
    mount('/');
    expect(await screen.findByTitle('Dashboard')).toHaveAttribute('src','/recruitment/#/dashboard');
  });
  it('shows template names once without duplicate usage subtitles', async () => {
    mount('/templates');
    const item = await screen.findByRole('button',{name: new RegExp(state.templates[0].templateName)});
    expect(item.querySelector('small')).toBeNull();
  });
  it('restores the Candidates path when returning from an embedded candidate profile', async () => {
    overrides['GET /recruitment/api/hr/candidates'] = () => json({items:[{id:'candidate-a',name:'Test Candidate',email:'candidate@example.test',location:'Singapore'}]});
    const ui = mount('/candidates');
    await ui.click(await screen.findByRole('button', {name:'View candidate'}));
    const frame = screen.getByTitle('Candidates');
    fireEvent(window, new MessageEvent('message', {origin:window.location.origin,source:frame.contentWindow,data:{type:'jrs:location',items:[{label:'Applications',route:'applications'},{label:'Candidate Profile',route:null}]}}));
    await ui.click(screen.getByRole('button',{name:'Back to candidates'}));
    const path = screen.getByRole('navigation',{name:'Current location'});
    expect(within(path).queryByText('Candidate Profile')).not.toBeInTheDocument();
    expect(within(path).getByText('Candidates')).toHaveAttribute('aria-current','page');
  });

  it('lets the browser scroll the full embedded content and rejects untrusted or invalid sizes', async () => {
    mount('/reports');
    const frame = await screen.findByTitle('Reports');
    for (const next of [1600, 820, 1600]) {
      fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data:{type:'jrs:frame',height:next}}));
      await waitFor(()=>expect(frame.style.height).toBe(next+'px'));
    }
    for(const [origin,source,height]of [['https://untrusted.example',frame.contentWindow,2000],[window.location.origin,window,2000],[window.location.origin,frame.contentWindow,-1],[window.location.origin,frame.contentWindow,'3000'],[window.location.origin,frame.contentWindow,Infinity]]){
      fireEvent(window,new MessageEvent('message',{origin,source,data:{type:'jrs:frame',height}}));
      expect(frame.style.height).toBe('1600px');
    }
    expect(frame).toHaveAttribute('scrolling','no');
  });

  it('uses the sidebar to return to Dashboard without an artificial breadcrumb parent', async () => {
    const ui = mount('/interviews');
    expect(await screen.findByRole('heading',{name:'Interviews',level:1})).toHaveClass('visually-hidden');
    expect(screen.queryByRole('navigation', { name: 'Current location' })).not.toBeInTheDocument();
    await ui.click(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('link',{name:'Dashboard'}));
    expect(await screen.findByTitle('Dashboard')).toBeVisible();
  });
  it('sends a stable list budget after reserving outer header, padding and footer space',async()=>{
    mount('/applications');const frame=await screen.findByTitle('Applications');
    frame.getBoundingClientRect=()=>({top:120});
    const footer=document.querySelector('.workspace-footer');footer.getBoundingClientRect=()=>({height:55});
    const post=vi.spyOn(frame.contentWindow,'postMessage');
    fireEvent.load(frame);
    const payload=post.mock.calls.at(-1)[0];
    expect(payload.type).toBe('jrs:viewport');
    expect(payload.availableHeight).toBeGreaterThan(0);
    expect(payload.availableHeight).toBeLessThan(window.innerHeight-175);
    post.mockClear();
    fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data:{type:'jrs:frame',height:400}}));
    expect(post.mock.calls.at(-1)[0].availableHeight).toBe(payload.availableHeight);
  });

  it('opens embedded dialogs at the browser viewport top so footer actions remain reachable',async()=>{
    mount('/interviews');const frame=await screen.findByTitle('Interviews');
    frame.getBoundingClientRect=()=>({top:120});frame.scrollIntoView=vi.fn();
    fireEvent(window,new MessageEvent('message',{origin:window.location.origin,source:frame.contentWindow,data:{type:'jrs:dialog'}}));
    expect(frame.scrollIntoView).toHaveBeenCalledWith({block:'start'});
  });

  it('includes a clickable My Profile parent when editing a profile', async () => {
    const ui = mount('/profile/edit');
    const path = await screen.findByRole('navigation', { name: 'Current location' });
    await ui.click(within(path).getByRole('link', { name: 'My Profile' }));
    expect(await screen.findByRole('heading', { name: 'My Profile', level: 1 })).toBeVisible();
  });

  it('keeps embedded stage paths out of the compact navigation header', async () => {
    const ui = mount('/applications');
    const frame = await screen.findByTitle('Applications');
    fireEvent(window, new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'jrs:location', items: [{label:'Applications',route:'applications'},{label:'Offer',route:null}] } }));
    expect(screen.queryByRole('navigation', { name: 'Current location' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Applications',level:1})).toHaveClass('visually-hidden');
    fireEvent(window, new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'jrs:location', items: [] } }));
    expect(screen.queryByRole('button',{name:'Applications',exact:true})).not.toBeInTheDocument();
    await ui.click(within(screen.getByRole('navigation', { name:'Main navigation' })).getByRole('link', { name:'Reports' }));
    expect(screen.getByRole('heading',{name:'Reports',level:1})).toHaveClass('visually-hidden');
  });

  it('removes the outbox entry and redirects its old URL to Applications', async () => {
    mount('/outbox');
    const navigation = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(navigation).queryByRole('link', { name: 'Email Outbox' })).not.toBeInTheDocument();
    expect(await screen.findByTitle('Applications')).toHaveAttribute('src', '/recruitment/#/applications');
  });

  it.each([['/templates', 'Email Templates'], ['/logs', 'Logs']])('routes embedded navigation to %s without falling back to Notifications', async (path, title) => {
    mount('/applications');
    const frame = await screen.findByTitle('Applications');
    fireEvent(window, new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'jrs:navigate', path } }));
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeVisible();
  });

  it('ignores frame sizing routes and untrusted navigation messages', async () => {
    mount('/applications');
    const frame = await screen.findByTitle('Applications');
    for (const [origin, source, data] of [
      [window.location.origin, frame.contentWindow, { type: 'jrs:frame', height: 850, route: 'notifications' }],
      ['https://untrusted.example', frame.contentWindow, { type: 'jrs:navigate', path: '/templates' }],
      [window.location.origin, window, { type: 'jrs:navigate', path: '/templates' }],
      [window.location.origin, frame.contentWindow, { type: 'jrs:navigate', path: 'https://untrusted.example' }],
    ]) fireEvent(window, new MessageEvent('message', { origin, source, data }));
    expect(frame).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Notification Center' })).not.toBeInTheDocument();
  });

  it.each(["/dashboard", "/applications", "/candidates", "/job-postings", "/interviews", "/outbox", "/reports", "/profile", "/profile/edit"])("hides communication navigation on %s", async (route) => {
    overrides["GET /recruitment/api/hr/candidates"] = () => json({ items: [] });
    overrides["GET /api/hr/job-publications"] = () => json({ items: [] });
    mount(route);
    if(route==="/outbox")await screen.findByTitle("Applications");
    expect(await screen.findByRole("navigation", { name: "Main navigation" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Communication pages" })).not.toBeInTheDocument();
    const location = screen.queryByRole("navigation", { name: "Current location" });
    if(['/applications','/interviews','/outbox','/reports'].includes(route)) {
      expect(location).not.toBeInTheDocument();
      expect(screen.getByRole('heading',{level:1})).toHaveClass('visually-hidden');
    } else {
      expect(location).not.toHaveTextContent("HR Workspace");
      expect(within(location).getByText(/.+/, { selector: '[aria-current="page"]' })).toBeVisible();
    }
    expect(screen.getByRole("button", { name: /Riley Morgan/ })).toBeVisible();
  });

  it.each(["/notifications", "/templates", "/logs"])("shows communication navigation on %s", async (route) => {
    mount(route);
    const tabs = await screen.findByRole("navigation", { name: "Communication pages" });
    expect(screen.queryByRole("navigation", { name: "Current location" })).not.toBeInTheDocument();
    expect(screen.getByRole('heading',{level:1})).toHaveClass('visually-hidden');
    expect(within(tabs).getAllByRole("link")).toHaveLength(3);
    expect(within(tabs).getByRole("link", { current: "page" })).toHaveAttribute("href", route);
  });

  it("updates communication navigation when moving between modules", async () => {
    const ui = mount();
    const sidebar = await screen.findByRole("navigation", { name: "Main navigation" });
    await ui.click(within(sidebar).getByRole("link", { name: "Dashboard" }));
    expect(screen.queryByRole("navigation", { name: "Communication pages" })).not.toBeInTheDocument();
    await ui.click(within(sidebar).getByRole("link", { name: "Notifications" }));
    expect(await screen.findByRole("navigation", { name: "Communication pages" })).toBeVisible();
  });

  it("enters through the local development endpoint when it is enabled", async () => {
    state.signedIn = false;
    overrides['GET /api/auth/config'] = () => json({loginUrl:null,adapterConfigured:true,developmentLogin:true});
    overrides['POST /api/auth/development-login'] = () => { state.signedIn = true; return json(null, 204); };
    const ui = mount("/templates");
    await ui.click(await screen.findByRole("button", { name: "Continue locally" }));
    expect(await screen.findByLabelText("Email subject")).toBeVisible();
    expect(writes('/api/auth/development-login')).toHaveLength(1);
  });
  it("redirects unsigned users directly to configured sign-in without an intermediate page", async () => {
    state.signedIn = false;
    overrides['GET /api/auth/config'] = () => json({loginUrl:'https://team.example.test/sign-in',adapterConfigured:true});
    const replace=vi.fn();
    vi.stubGlobal('location',{href:'http://localhost/hr/profile',replace});
    mount('/profile');
    await waitFor(()=>expect(replace).toHaveBeenCalledWith('https://team.example.test/sign-in?returnTo=%2Fhr%2Fprofile'));
    expect(screen.queryByRole('heading',{name:'Continue through team sign-in'})).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => url.startsWith('/api/hr/'))).toBe(false);
  });
  it('redirects an expired session directly to unified sign-in',async()=>{
    const replace=vi.fn();vi.stubGlobal('location',{href:'http://localhost/hr/notifications',replace});
    overrides['GET /api/auth/config']=()=>json({loginUrl:'http://localhost/pages/login/login.html',adapterConfigured:true});
    overrides['GET /api/hr/notifications']=()=>json({error:{message:'Please sign in.'}},401);
    mount();
    await waitFor(()=>expect(replace).toHaveBeenCalledWith('http://localhost/pages/login/login.html?returnTo=%2Fhr%2Fnotifications'));
    expect(screen.queryByRole('heading',{name:'Continue through team sign-in'})).not.toBeInTheDocument();
    expect(screen.queryByText('New application received')).not.toBeInTheDocument();
  });
  it('logout goes directly to sign-in without reopening the previous HR page',async()=>{
    const replace=vi.fn();vi.stubGlobal('location',{href:'http://localhost/hr/notifications',replace});
    overrides['GET /api/auth/config']=()=>json({loginUrl:'http://localhost/pages/login/login.html',adapterConfigured:true});
    const ui=mount();
    await ui.click(await screen.findByRole('button',{name:/Riley Morgan HR Manager/}));
    await ui.click(screen.getByRole('button',{name:'Logout'}));
    await ui.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Logout'}));
    await waitFor(()=>expect(replace).toHaveBeenCalledWith('http://localhost/pages/login/login.html'));
    expect(screen.queryByRole('navigation',{name:'Main navigation'})).not.toBeInTheDocument();
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
    await screen.findByRole('heading', {name:'Unable to open workspace'});
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
    expect(await screen.findByTitle('Dashboard')).toHaveAttribute('src', '/recruitment/#/dashboard');
    expect(dashboard).toHaveClass("active");
    expect(notifications).not.toHaveClass("active");
    expect(screen.queryByText('This area is ready for the recruitment team module.')).not.toBeInTheDocument();
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
    expect(await screen.findByRole('heading', {name:'Unable to open workspace'})).toBeVisible();
  });
  it("clears protected content when the server reports an expired session", async () => {
    overrides["GET /api/hr/notifications"] = () =>
      json({ error: { message: "Please sign in." } }, 401);
    mount();
    expect(await screen.findByRole('heading', {name:'Unable to open workspace'})).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("session has expired");
    expect(
      screen.queryByText("New application received"),
    ).not.toBeInTheDocument();
  });
});

describe("notification workflow", () => {
  it("shows authoritative all and unread counts", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "All 2" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Unread 1" })).toBeVisible();
  });
  it("shows loading until the API resolves", async () => {
    let resolve;
    overrides["GET /api/hr/notifications"] = () =>
      new Promise((r) => {
        resolve = r;
      });
    mount();
    await screen.findByRole("heading", { name: "Notification Center" });
    expect(
      screen.getByRole("status", { name: "Loading notifications" }),
    ).toBeVisible();
    resolve(
      json({ items: [], total: 0, page: 1, pageSize: 20, unread: 0, all: 0 }),
    );
    expect(await screen.findByText("No notifications yet")).toBeVisible();
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
        name: "More actions for New application received",
      }),
    );
    await ui.click(
      screen.getByRole("menuitem", { name: "Mark as read" }),
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
        name: "More actions for New application received",
      }),
    );
    await ui.click(
      screen.getByRole("menuitem", { name: "Mark as read" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save",
    );
    expect(screen.getByRole("button", { name: /Unread 1/ })).toBeVisible();
  });
  it("marks all read and restores the affected notifications from Undo", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    await ui.click(screen.getByRole("button", { name: /Mark all as read/ }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Mark all as read/ }),
      ).not.toBeInTheDocument(),
    );
    expect(writes("/api/hr/notifications/read-all")).toHaveLength(1);
    await ui.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(writes("/api/hr/notifications/restore-unread")).toHaveLength(1),
    );
    expect(await screen.findByRole("button", { name: "Unread 1" })).toBeVisible();
  });
  it("moves read-state changes into an accessible row actions menu", async () => {
    const ui = mount();
    await screen.findByText("Candidate status updated");
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    await ui.click(
      screen.getByRole("button", {
        name: "More actions for Candidate status updated",
      }),
    );
    await ui.click(screen.getByRole("menuitem", { name: "Mark as unread" }));
    await waitFor(() =>
      expect(writes("/api/hr/notifications/restore-unread")).toHaveLength(1),
    );
    expect(await screen.findByRole("button",{name:"Unread 2"})).toBeVisible();
    expect(screen.queryByText("Unread notifications restored.")).not.toBeInTheDocument();
  });
  it("automatically applies search, date and type filters, exposes chips and clears them", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    await ui.type(screen.getByLabelText("Search notifications"), "Casey");
    await ui.selectOptions(
      screen.getByLabelText("Notification type"),
      "STATUS_UPDATED",
    );
    await ui.click(screen.getByRole("button", { name: "Date" }));
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "01 09 2026" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "09 09 2026" },
    });
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([url]) =>
          url.includes("search=Casey&type=STATUS_UPDATED&from=2026-09-01&to=2026-09-09"),
        ),
      ).toBe(true),
    );
    expect(screen.getByRole("button", { name: /Remove Search: Casey filter/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Remove Status updated filter/ })).toBeVisible();
    await ui.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("Notification type")).toHaveValue("");
    expect(screen.getByLabelText("Search notifications")).toHaveValue("");
    expect(screen.queryByLabelText("From date")).not.toBeInTheDocument();
    await ui.click(screen.getByRole("button", { name: "Date" }));
    expect(screen.getByLabelText("From date")).toHaveValue("");
  });
  it("distinguishes an empty filtered result from an empty inbox", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    await ui.type(screen.getByLabelText("Search notifications"), "No matching record");
    expect(
      await screen.findByRole("heading", {
        name: "No notifications match these filters",
      }),
    ).toBeVisible();
    expect(screen.queryByText("No notifications yet")).not.toBeInTheDocument();
  });
  it("uses an English DD MM YYYY date format and rejects invalid dates", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    await ui.click(screen.getByRole("button", { name: "Date" }));
    expect(screen.getByLabelText("From date")).toHaveAttribute("placeholder", "DD MM YYYY");
    expect(screen.getByLabelText("To date")).toHaveAttribute("placeholder", "DD MM YYYY");
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "13 40 2026" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("DD MM YYYY");
  });
  it("restores English calendar selection and sends ISO history bounds",async()=>{
    const ui=mount();await screen.findByText("New application received");await ui.click(screen.getByRole("button",{name:"Date"}));
    for(const [label,day] of [["From date",1],["To date",9]]) {
      await ui.click(screen.getByRole("button",{name:`Open ${label} calendar`}));
      await ui.click(screen.getByRole("button",{name:"Choose month"}));
      await ui.click(screen.getByRole("button",{name:"Choose year"}));
      await ui.click(screen.getByRole("button",{name:"2026",exact:true}));
      await ui.click(screen.getByRole("button",{name:"September",exact:true}));
      await ui.click(screen.getByRole("button",{name:`${day} September 2026`}));
    }
    expect(screen.getByLabelText("From date")).toHaveValue("01 09 2026");
    expect(screen.getByLabelText("To date")).toHaveValue("09 09 2026");
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url.includes("from=2026-09-01&to=2026-09-09"))).toBe(true));
  });
  it("rejects future manual history dates without native localized inputs",async()=>{
    const ui=mount();await screen.findByText("New application received");await ui.click(screen.getByRole("button",{name:"Date"}));
    expect(document.querySelector('input[type="date"]')).toBeNull();
    fireEvent.change(screen.getByLabelText("To date"),{target:{value:"31 12 9999"}});
    expect(await screen.findByRole("alert")).toHaveTextContent("Future dates");
    expect(fetcher.mock.calls.some(([url])=>url.includes("to=9999-12-31"))).toBe(false);
  });
  it("shows only a clearly labeled read-only application summary", async () => {
    const ui = mount();
    await ui.click(
      await screen.findByRole("button", {
        name: "Review application: New application received",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Casey Taylor")).toBeVisible();
    expect(dialog).toHaveTextContent("Read-only summary");
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
    await ui.click(
      within(dialog).getByRole("button", { name: "Close", exact: true }),
    );
    expect(writes("/api/hr/notifications/1/read")).toHaveLength(1);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", {
            name: "Review application: New application received",
          })
          .closest("li"),
      ).not.toHaveClass("unread"),
    );
  });
  it("groups notifications by business date, uses semantic actions and hides small-result pagination", async () => {
    const now = new Date();
    const today = now.toISOString();
    const yesterday = new Date(now.getTime() - 86400000).toISOString();
    const earlier = new Date(now.getTime() - 7 * 86400000).toISOString();
    state.notifications[0].createdAt = today;
    state.notifications[1].createdAt = yesterday;
    state.notifications.push({
      ...structuredClone(state.notifications[1]),
      notificationId: 3,
      title: "Earlier recruitment activity",
      createdAt: earlier,
    });
    mount();
    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Yesterday" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Earlier" })).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Review application: New application received",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "View candidate: Candidate status updated",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Results pages" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Unread", { selector: ".badge-soft" })).not.toBeInTheDocument();
  });
  it("opens row actions from the keyboard", async () => {
    const ui = mount();
    await screen.findByText("New application received");
    const trigger = screen.getByRole("button", {
      name: "More actions for New application received",
    });
    trigger.focus();
    await ui.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Mark as read" })).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("email templates", () => {
  it.each([
    ["APPLICATION_REJECTION", "Application Rejection"],
    ["INTERVIEW_REJECTION", "Interview Rejection"],
    ["OFFER_WITHDRAWAL", "Offer Withdrawal"],
    ["OFFER_DECLINED_ACKNOWLEDGEMENT", "Offer Declined Acknowledgement"],
  ])("saves and reopens the stage-specific type %s", async (code, label) => {
    const ui = mount("/templates");
    const usage = await screen.findByLabelText("Usage type");
    expect(within(usage).getByRole("option", { name: label, exact: true })).toHaveValue(code);
    await ui.selectOptions(usage, code);
    await ui.click(screen.getByRole("button", { name: "Save template" }));
    await screen.findByText("Template saved.");
    await ui.click(screen.getByRole("button", { name: /Offer Letter/ }));
    await ui.click(screen.getByRole("button", { name: /Interview Invite/, exact: true }));
    expect(screen.getByLabelText("Usage type")).toHaveValue(code);
  });
  it.each([
    ["/templates", "Email Templates"],
    ["/logs", "Logs"],
  ])("matches the notification heading hierarchy on %s", async (route, title) => {
    mount(route);
    const heading = await screen.findByRole("heading", { level: 1, name: title });
    expect(heading).toHaveClass('visually-hidden');
    if(route==="/templates") expect(await screen.findByText("2 saved templates")).toBeVisible();
    expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
  });
  it.each([0, 1, 3])("shows the saved template count for %i items", async (count) => {
    state.templates = Array.from({ length: count }, (_, index) => ({ ...templates[0], templateId: index + 1 }));
    mount("/templates");
    expect(await screen.findByText(`${count} saved template${count === 1 ? "" : "s"}`)).toBeVisible();
  });
  it.each([0, 1, 37])("uses the API total rather than the current log page length for %i emails", async (total) => {
    overrides["GET /api/hr/logs"] = () => json({ items: total ? [state.log] : [], total, page: 1, pageSize: 10 });
    mount("/logs");
    if(total) expect(await screen.findByText(total===37?"1–10 of 37":"1–1 of 1")).toBeVisible(); else expect(await screen.findByText("No sent emails found")).toBeVisible();
    const heading = screen.getByRole("heading", { level: 1, name: "Logs" });
    expect(heading.parentElement.querySelector("p")).toBeNull();
  });
  it("keeps filtered results working without a heading count", async () => {
    overrides["GET /api/hr/logs"] = (url) => {
      const filtered = new URL(url, "http://localhost").searchParams.get("search");
      return json({ items: filtered ? [] : [state.log], total: filtered ? 0 : 1, page: 1, pageSize: 10 });
    };
    const ui = mount("/logs");
    await screen.findByRole("table",{name:"Sent email history"});
    await ui.type(screen.getByLabelText("Search"), "No match");
    await ui.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("No sent emails found")).toBeVisible();
    const heading = screen.getByRole("heading", { level: 1, name: "Logs" });
    expect(heading.parentElement.querySelector("p")).toBeNull();
  });
  it.each(["/templates", "/logs"])("does not invent a zero count when %s fails to load", async (route) => {
    overrides[`GET /api/hr${route}`] = () => json({ error: { message: "Service unavailable." } }, 503);
    mount(route);
    await screen.findByRole("alert");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.parentElement.querySelector("p")).toBeNull();
  });
  it("selects, saves and reopens a type added only to shared configuration", async () => {
    const ui = mount("/templates");
    const usage = await screen.findByLabelText("Usage type");
    await ui.selectOptions(usage, "INTERVIEW_REMINDER");
    await ui.click(screen.getByRole("button", { name: "Save template" }));
    expect(await screen.findByText("Template saved.")).toBeVisible();
    expect(state.templates[0].usageType).toBe("INTERVIEW_REMINDER");
    await ui.click(screen.getByRole("button", { name: /Offer Letter/ }));
    expect(screen.getByLabelText("Usage type")).toHaveValue("OFFER_LETTER");
    await ui.click(screen.getByRole("button", { name: /Interview Invite/ }));
    expect(screen.getByLabelText("Usage type")).toHaveValue("INTERVIEW_REMINDER");
  });
  it("preserves unknown types and blocks saving until an explicit supported choice", async () => {
    state.templates[0].usageType = "FUTURE_WORKFLOW";
    const ui = mount("/templates");
    const usage = await screen.findByLabelText("Usage type");
    expect(usage).toHaveValue("FUTURE_WORKFLOW");
    expect(screen.getByRole("alert")).toHaveTextContent("Unsupported usage type: FUTURE_WORKFLOW");
    fireEvent.change(screen.getByLabelText("Email subject"), { target: { value: "Updated subject" } });
    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "Save template" }).closest("form"));
    expect(state.templates[0].usageType).toBe("FUTURE_WORKFLOW");
    expect(writes("/api/hr/templates/1")).toHaveLength(0);
    await ui.selectOptions(usage, "IN_PROGRESS");
    await ui.click(screen.getByRole("button", { name: "Save template" }));
    expect(await screen.findByText("Template saved.")).toBeVisible();
    expect(state.templates[0].usageType).toBe("IN_PROGRESS");
  });
  it("presents the template total as inventory metadata, not an unread badge", async () => {
    mount("/templates");
    expect(await screen.findByText(`${templates.length} saved templates`)).toBeVisible();
    expect(document.querySelector(".template-list-panel .count-pill")).toBeNull();
  });

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
  it("shows an editor status only while changes are unsaved", async () => {
    const ui = mount("/templates");
    const subject = await screen.findByLabelText("Email subject");
    const editorHeading = screen.getByRole("heading", { name: "Edit template" }).parentElement;
    await ui.type(subject, " changed");
    expect(within(editorHeading).getByText("Unsaved changes")).toBeVisible();
    await ui.click(screen.getByRole("button", { name: "Cancel" }));
    expect(subject).toHaveValue("Hello [CandidateName]");
    expect(editorHeading.querySelector("p")).toBeNull();
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
    expect(await screen.findByText("3 saved templates")).toBeVisible();
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
  it('previews workflow variables as labelled placeholders without inventing interview or offer facts',async()=>{
    const ui=mount('/templates');
    const body=await screen.findByLabelText('Email body');
    fireEvent.change(body,{target:{value:'[InterviewDate] [InterviewTime] [InterviewLocation] [OfferSalary] [OfferDeadline]'}});
    await ui.click(screen.getByRole('button',{name:'Preview'}));
    const dialog=screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Interview date from application');
    expect(dialog).toHaveTextContent('Approved salary from offer');
    expect(dialog).not.toHaveTextContent('[InterviewDate]');
    expect(dialog).toHaveTextContent('actual application');
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
      screen.getByRole("button", { name: /Offer Letter/ }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Discard unsaved changes?",
    );
    await ui.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(subject).toHaveValue("Hello [CandidateName] unsaved");
    await ui.click(
      screen.getByRole("button", { name: /Offer Letter/ }),
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
    expect(await screen.findByText("1 saved template")).toBeVisible();
  });
});

describe("logs and HR profile", () => {
  it("shows sent history and the immutable detail snapshot", async () => {
    const ui = mount("/logs");
    expect(await screen.findByText("Sent")).toBeVisible();
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
    await ui.type(screen.getByLabelText("Search"), "Casey");
    await ui.selectOptions(screen.getByLabelText("Event"), "Moved to Interview");
    await ui.click(screen.getByRole("button", { name: "Apply" }));
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
    expect(await screen.findByText("LOCAL-HR-001")).toBeVisible();
    expect(screen.getByText("+65 1234 5678")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Communication pages" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/notifications",
    );
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
it("opens allowlisted HR deep links from the embedded dashboard while rejecting untrusted routes",async()=>{
 const ui=mount("/dashboard");const frame=await screen.findByTitle("Dashboard");
 fireEvent(window,new MessageEvent("message",{origin:location.origin,source:frame.contentWindow,data:{type:"jrs:workspace",intent:true,route:"applications/offer"}}));
 await waitFor(()=>expect(screen.getByTitle("Applications")).toHaveAttribute("src","/recruitment/#/applications/offer"));
 const next=screen.getByTitle("Applications");
 fireEvent(window,new MessageEvent("message",{origin:location.origin,source:next.contentWindow,data:{type:"jrs:workspace",intent:true,route:"https://evil.test"}}));
 fireEvent(window,new MessageEvent("message",{origin:location.origin,source:next.contentWindow,data:{type:"jrs:workspace",route:"dashboard"}}));
 expect(screen.getByTitle("Applications")).toHaveAttribute("src","/recruitment/#/applications/offer");
});
it('fits Candidates to the viewport and requests the remaining records on the next page',async()=>{
 const rows=Array.from({length:18},(_,i)=>({id:'fit-'+i,name:'Person '+(i+1),email:'person-'+i+'@example.test'}));
 overrides['GET /recruitment/api/hr/candidates']=url=>{
  const params=new URL(url,'http://localhost').searchParams,limit=Number(params.get('limit')),page=Number(params.get('page'));
  return json({items:rows.slice((page-1)*limit,page*limit),total:rows.length,page,limit});
 };
 const rect=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){
  const height=this.matches('.candidate-list-workspace')?200+document.querySelectorAll('tbody tr').length*80:this.matches('tr')?80:this.matches('.workspace-footer')?55:0;
  return {top:this.matches('.candidate-list-workspace')?140:0,height,bottom:height,left:0,right:1000,width:1000};
 });
 try{
  const ui=mount('/candidates');
  await waitFor(()=>expect(screen.getByText('1–4 of 18')).toBeVisible());
  expect(screen.getByRole('searchbox',{name:'Search candidates'})).toBeVisible();
  await ui.click(screen.getByRole('button',{name:'Next',exact:true}));
  expect(await screen.findByRole('button',{name:'View profile for Person 5',exact:true})).toBeVisible();
  expect(screen.getByText('5–8 of 18')).toBeVisible();
  const reads=()=>fetcher.mock.calls.filter(([url])=>url.startsWith('/recruitment/api/hr/candidates?')).length;
  const beforeReturn=reads();
  await ui.click(screen.getByRole('button',{name:'View profile for Person 5',exact:true}));
  await ui.click(screen.getByRole('button',{name:'Back to candidates',exact:true}));
  expect(await screen.findByText('5–8 of 18')).toBeVisible();
  expect(reads()).toBe(beforeReturn);
 }finally{rect.mockRestore();}
});

it("keeps the Candidates parent path and search context when opening a person",async()=>{
 overrides["GET /recruitment/api/hr/candidates"]=()=>json({items:[{id:"person-1",name:"Casey",email:"casey@example.test"}],total:21,page:2,limit:20});
 const ui=mount("/candidates?q=Casey&page=2");
 await ui.click(await screen.findByRole("button",{name:"View profile for Casey"}));
 const frame=screen.getByTitle("Candidates");
 fireEvent(window,new MessageEvent("message",{origin:location.origin,source:frame.contentWindow,data:{type:"jrs:location",items:[{label:"Applications",route:"applications"},{label:"Candidate Profile"}]}}));
 const path=screen.getByRole("navigation",{name:"Current location"});
 expect(within(path).queryByRole("button",{name:"Applications",exact:true})).not.toBeInTheDocument();
 await ui.click(within(path).getByRole("button",{name:"Candidates",exact:true}));
 expect(await screen.findByRole("searchbox",{name:"Search candidates"})).toHaveValue("Casey");
 expect(screen.getByText("Page 2 of 2")).toBeVisible();
});
it("leaves the candidate profile when switching to another HR workspace", async () => {
  overrides["GET /recruitment/api/hr/candidates"] = () => json({items:[{id:"person-1",name:"Casey"}],total:1,page:1,limit:20});
  const ui = mount("/candidates");
  await ui.click(await screen.findByRole("button", {name:"View profile for Casey"}));
  expect(screen.getByTitle("Candidates")).toHaveAttribute("src","/recruitment/#/candidate/person-1");
  await ui.click(screen.getByRole("link", {name:"Reports",exact:true}));
  expect(await screen.findByTitle("Reports")).toHaveAttribute("src","/recruitment/#/reports");
  expect(screen.queryByRole("button",{name:"Back to candidates"})).not.toBeInTheDocument();
  await ui.click(screen.getByRole("link", {name:"Candidates",exact:true}));
  expect(await screen.findByRole("button",{name:"View profile for Casey"})).toBeVisible();
});
