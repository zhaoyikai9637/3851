import { Component, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { Avatar, ErrorBox, Modal } from "./shared";
import { Notifications } from "./pages/Notifications";
import { Templates } from "./pages/Templates";
import { Logs } from "./pages/Logs";
import { Profile, EditProfile } from "./pages/Profile";
import { Icon } from "./icons";

const tabs = [
  ["/notifications", "Notification Center"],
  ["/templates", "Email Templates"],
  ["/logs", "Notification Log"],
];
const workspaceLinks = [
  ["/dashboard", "Dashboard", "dashboard"],
  ["/applications", "Applications", "applications"],
  ["/candidates", "Candidates", "person"],
  ["/job-postings", "Job Postings", "jobs"],
  ["/interviews", "Interviews", "calendar"],
];
class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="alert alert-danger" role="alert">
        This page could not be displayed.{" "}
        <button
          className="btn btn-outline-danger"
          onClick={() => location.reload()}
        >
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/notifications" replace />} />
          {workspaceLinks.map(([path, name]) => (
            <Route
              key={path}
              path={path.slice(1)}
              element={<TeamWorkspacePlaceholder title={name} />}
            />
          ))}
          <Route path="notifications" element={<Notifications />} />
          <Route path="templates" element={<Templates />} />
          <Route path="logs" element={<Logs />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/edit" element={<EditProfile />} />
          <Route
            path="*"
            element={
              <div className="empty-state">
                <h1>Page not found</h1>
                <Link to="/notifications">Return to Notification Center</Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
function TeamWorkspacePlaceholder({ title }) {
  return (
    <section className="surface team-workspace-placeholder">
      <p className="eyebrow">JRS WORKSPACE</p>
      <h1>{title}</h1>
      <p className="subtle mb-0">
        This area is ready for the recruitment team module.
      </p>
    </section>
  );
}
function Layout() {
  const { user, mode, logout } = useAuth();
  const [sidebar, setSidebar] = useState(false),
    [menu, setMenu] = useState(false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const menuRef = useRef(null),
    trigger = useRef(null),
    location = useLocation();
  const isProfilePage = location.pathname.startsWith("/profile");
  useEffect(() => {
    setMenu(false);
    setSidebar(false);
    const pageTitle =
      tabs.find(([path]) => path === location.pathname)?.[1] ||
      workspaceLinks.find(([path]) => path === location.pathname)?.[1] ||
      "My Profile";
    document.title = `${pageTitle} · JRS`;
  }, [location.pathname]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    const keyboard = (e) => {
      if (e.key === "Escape") {
        setMenu(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [menu]);
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await logout();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const navigation = (
    <>
      <div className="brand">
        <span className="brand-mark">J</span>
        <span>
          JRS<span className="brand-subtitle">HR WORKSPACE</span>
        </span>
      </div>
      <p className="sidebar-label">WORKSPACE</p>
      <nav aria-label="Main navigation">
        {workspaceLinks.map(([path, name, icon]) => (
          <NavLink
            key={path}
            to={path}
            end
            onClick={() => setSidebar(false)}
          >
            <Icon name={icon} />
            {name}
          </NavLink>
        ))}
        <NavLink
          to="/notifications"
          onClick={() => setSidebar(false)}
          className={() =>
            tabs.some(([path]) => location.pathname === path) ? "active" : ""
          }
        >
          <Icon name="bell" />
          Notifications
        </NavLink>
      </nav>
      <div className="sidebar-foot">
        <span className="online-dot" />{" "}
        {mode === "demo" ? "Local fictional demo" : mode === "standalone" ? "Standalone demo workspace" : "HR workspace"}
        <small>Thoughtful communication, every step.</small>
      </div>
    </>
  );
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{navigation}</aside>
      {sidebar && (
        <Modal title="Workspace navigation" onClose={() => setSidebar(false)}>
          <div className="mobile-navigation">{navigation}</div>
        </Modal>
      )}
      <div className="workspace-body">
        <header className={`topbar${isProfilePage ? " profile-topbar" : ""}`}>
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setSidebar(true)}
          >
            ☰
          </button>
          {!isProfilePage && (
            <nav className="top-tabs" aria-label="Communication pages">
              {tabs.map(([path, name]) => (
                <NavLink key={path} to={path}>
                  {name}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="account-control" ref={menuRef}>
            <button
              ref={trigger}
              className="account-button"
              aria-expanded={menu}
              aria-controls="account-menu"
              onClick={() => setMenu((v) => !v)}
            >
              <Avatar user={user} />
              <span className="account-name">
                {user.fullName}
                <small>{user.role}</small>
              </span>
              <span aria-hidden="true">⌄</span>
            </button>
            {menu && (
              <div id="account-menu" className="account-menu">
                <div className="account-menu-heading">
                  <strong>{user.fullName}</strong>
                  <small>{user.email}</small>
                </div>
                <Link to="/profile">My Profile</Link>
                <button
                  onClick={() => {
                    setMenu(false);
                    setConfirm(true);
                    setError(null);
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <PageBoundary key={location.pathname}>
            <Outlet />
          </PageBoundary>
        </main>
        <footer className="workspace-footer">
          <span>JRS · Human Resources</span>
          <span>Dates shown in UTC+08:00</span>
        </footer>
      </div>
      {confirm && (
        <Modal
          title="Log out of your workspace?"
          onClose={() => !busy && setConfirm(false)}
          footer={
            <>
              <button
                className="btn btn-outline-secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={signOut}
              >
                {busy ? "Logging out…" : "Logout"}
              </button>
            </>
          }
        >
          <p>{mode === "demo" ? "This will close the fictional demo and return to the team sign-in page." : "This will end your team session. Use the team sign-in page to access your HR workspace again."}</p>
          <ErrorBox error={error} />
        </Modal>
      )}
    </div>
  );
}
