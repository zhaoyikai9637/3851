import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { Icon } from "../icons";
import { Avatar, ErrorBox, Modal } from "../shared";
import { communicationLinks, navigationGroups, pageName } from "./navigation";
import { WorkspacePath } from "./WorkspacePath";

function SidebarNavigation({ pathname, onNavigate }) {
  const communicationPage = communicationLinks.some(([path]) => path === pathname);
  return (
    <>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><span className="brand-circle brand-circle-dark" /><span className="brand-circle brand-circle-blue" /></span>
        <span>
          JRS<span className="brand-subtitle">HR WORKSPACE</span>
        </span>
      </div>
      <nav aria-label="Main navigation">
        {navigationGroups.map(([label, links]) => (
          <div className="sidebar-group" key={label}>
            <p className="sidebar-label">{label}</p>
            {/* Notifications stays highlighted on its Templates and Logs tabs. */}
            {links.map(([path, name, icon]) => (
              <NavLink
                key={path}
                to={path}
                end
                onClick={onNavigate}
                className={({ isActive }) => (isActive || (path === "/notifications" && communicationPage) ? "active" : "")}
              >
                <Icon name={icon} />
                {name}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span>HR workspace</span>
        <small>Thoughtful communication, every step.</small>
      </div>
    </>
  );
}

function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null),
    triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const keyboard = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
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
  }, [open]);
  return (
    <div className="account-control" ref={menuRef}>
      <button
        ref={triggerRef}
        className="account-button"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar user={user} />
        <span className="account-name">
          {user.fullName}
          <small>{user.role}</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div id="account-menu" className="account-menu">
          <div className="account-menu-heading">
            <strong>{user.fullName}</strong>
            <small>{user.email}</small>
          </div>
          <Link to="/profile">My Profile</Link>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function WorkspaceLayout() {
  const [trail, setTrail] = useState(null);
  const [sections,setSections]=useState(null);
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false),
    [confirmLogout, setConfirmLogout] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const location = useLocation();
  const isCommunicationPage = communicationLinks.some(([path]) => path === location.pathname);
  // Every workspace page shows its title in the header; pages whose header hosts section tabs show the tabs instead.
  const navigationOnly = isCommunicationPage || location.pathname === '/reports';
  useEffect(() => {
    setSidebarOpen(false);
    document.title = `${pageName(location.pathname)} · JRS`;
  }, [location.pathname]);
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await logout();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }
  const navigation = (
    <SidebarNavigation pathname={location.pathname} onNavigate={() => setSidebarOpen(false)} />
  );
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{navigation}</aside>
      {sidebarOpen && (
        <Modal title="Workspace navigation" onClose={() => setSidebarOpen(false)}>
          <div className="mobile-navigation">{navigation}</div>
        </Modal>
      )}
      <div className="workspace-body compact-workspace">
        <div className={`workspace-header${navigationOnly ? ' navigation-only-header' : ''}`}>
        <header className="topbar compact-topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          {navigationOnly ? <h1 className="visually-hidden" id="workspace-page-title">{pageName(location.pathname)}</h1> : <div className="workspace-title">
            <WorkspacePath
              pathname={location.pathname}
              // Applications and Interviews show only their title; embedded stage paths stay out of the header.
              trail={trail?.owner === location.key && !['/applications', '/interviews'].includes(location.pathname) ? trail : null}
            />
          </div>}
          <AccountMenu
            user={user}
            onLogout={() => {
              setConfirmLogout(true);
              setError(null);
            }}
          />
        </header>
        {isCommunicationPage && (
          <nav className="workspace-sections" aria-label="Communication pages">
            {communicationLinks.map(([path,name])=><NavLink key={path} to={path}>{name}</NavLink>)}
          </nav>
        )}
        {!isCommunicationPage&&sections?.owner===location.key&&sections.items.length>0&&(
          <nav className="workspace-sections" aria-label={sections.label}>
            {sections.items.map((item,index)=><button type="button" key={index} className={item.selected?'active':''} aria-pressed={item.selected} onClick={()=>sections.select(index)}>{item.label}</button>)}
          </nav>
        )}
        </div>
        <main
          id="main-content"
          className="main-content"
          tabIndex={-1}
          aria-labelledby="workspace-page-title"
        >
          <Outlet context={{ setTrail, setSections, compactHeading: true }} />
        </main>
        <footer className="workspace-footer">
          <span>JRS · Human Resources</span>
          <span>Dates shown in UTC+08:00</span>
        </footer>
      </div>
      {confirmLogout && (
        <Modal
          title="Log out of your workspace?"
          onClose={() => !busy && setConfirmLogout(false)}
          footer={
            <>
              <button
                className="btn btn-outline-secondary"
                disabled={busy}
                onClick={() => setConfirmLogout(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={signOut}>
                {busy ? "Logging out…" : "Logout"}
              </button>
            </>
          }
        >
          <p>
            This will end your session. Use the team sign-in page to access your HR workspace again.
          </p>
          <ErrorBox error={error} />
        </Modal>
      )}
    </div>
  );
}
