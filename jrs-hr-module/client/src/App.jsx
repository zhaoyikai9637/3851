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

const tabs = [
  ["/notifications", "Notification Center"],
  ["/templates", "Email Templates"],
  ["/logs", "Notification Log"],
];
const icons = {
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  log: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
};
export function Icon({ name }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.log}
    </svg>
  );
}
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
function Layout() {
  const { user, mode, logout, resetDemo } = useAuth();
  const [sidebar, setSidebar] = useState(false),
    [menu, setMenu] = useState(false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const menuRef = useRef(null),
    trigger = useRef(null),
    location = useLocation();
  useEffect(() => {
    setMenu(false);
    setSidebar(false);
    document.title = `${tabs.find(([path]) => path === location.pathname)?.[1] || "My Profile"} · JRS`;
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
        {tabs.map(([path, name], i) => (
          <NavLink key={path} to={path} onClick={() => setSidebar(false)}>
            <Icon name={["bell", "mail", "log"][i]} />
            {name}
          </NavLink>
        ))}
        <NavLink to="/profile" onClick={() => setSidebar(false)}>
          <Icon name="person" />
          My Profile
        </NavLink>
      </nav>
      <div className="sidebar-context">
        <p className="sidebar-label">HIRING TEAM</p>
        <p>
          Positions · Applications
          <br />
          Interviews · Offers
        </p>
        <small>Managed by the recruitment team</small>
      </div>
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
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setSidebar(true)}
          >
            ☰
          </button>
          <nav className="top-tabs" aria-label="Communication pages">
            {tabs.map(([path, name]) => (
              <NavLink key={path} to={path}>
                {name}
              </NavLink>
            ))}
          </nav>
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
                <Link to="/profile/edit">Edit Profile</Link>
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
        {mode === "demo" && (
          <div className="demo-banner" role="status">
            <span><strong>LOCAL DEMO</strong> · Fictional data · No API, database, or email activity</span>
            <button className="btn btn-sm btn-light" onClick={resetDemo}>Reset demo</button>
          </div>
        )}
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
