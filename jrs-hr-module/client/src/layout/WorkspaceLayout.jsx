import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { Icon } from "../icons";
import { Avatar, ErrorBox, Modal } from "../shared";
import { communicationLinks, pageName, workspaceLinks } from "./navigation";

function SidebarNavigation({ pathname, onNavigate }) {
  const communicationPage = communicationLinks.some(([path]) => path === pathname);
  return <>
    <div className="brand"><span className="brand-mark">J</span><span>JRS<span className="brand-subtitle">HR WORKSPACE</span></span></div>
    <p className="sidebar-label">WORKSPACE</p>
    <nav aria-label="Main navigation">
      {workspaceLinks.map(([path, name, icon]) => <NavLink key={path} to={path} end onClick={onNavigate}><Icon name={icon} />{name}</NavLink>)}
      <NavLink to="/notifications" onClick={onNavigate} className={() => communicationPage ? "active" : ""}><Icon name="bell" />Notifications</NavLink>
    </nav>
    <div className="sidebar-foot"><span>HR workspace</span><small>Thoughtful communication, every step.</small></div>
  </>;
}

function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null), triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const keyboard = (event) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", keyboard); };
  }, [open]);
  return <div className="account-control" ref={menuRef}>
    <button ref={triggerRef} className="account-button" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen((value) => !value)}>
      <Avatar user={user} /><span className="account-name">{user.fullName}<small>{user.role}</small></span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id="account-menu" className="account-menu">
      <div className="account-menu-heading"><strong>{user.fullName}</strong><small>{user.email}</small></div>
      <Link to="/profile">My Profile</Link>
      <button onClick={() => { setOpen(false); onLogout(); }}>Logout</button>
    </div>}
  </div>;
}

export function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false), [confirmLogout, setConfirmLogout] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const location = useLocation(), isProfilePage = location.pathname.startsWith("/profile");
  useEffect(() => { setSidebarOpen(false); document.title = `${pageName(location.pathname)} · JRS`; }, [location.pathname]);
  async function signOut() { setBusy(true); setError(null); try { await logout(); } catch (nextError) { setError(nextError); } finally { setBusy(false); } }
  const navigation = <SidebarNavigation pathname={location.pathname} onNavigate={() => setSidebarOpen(false)} />;
  return <div className="workspace">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">{navigation}</aside>
    {sidebarOpen && <Modal title="Workspace navigation" onClose={() => setSidebarOpen(false)}><div className="mobile-navigation">{navigation}</div></Modal>}
    <div className="workspace-body">
      <header className={`topbar${isProfilePage ? " profile-topbar" : ""}`}>
        <button className="icon-button mobile-toggle" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button>
        {!isProfilePage && <nav className="top-tabs" aria-label="Communication pages">{communicationLinks.map(([path, name]) => <NavLink key={path} to={path}>{name}</NavLink>)}</nav>}
        <AccountMenu user={user} onLogout={() => { setConfirmLogout(true); setError(null); }} />
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}><Outlet /></main>
      <footer className="workspace-footer"><span>JRS · Human Resources</span><span>Dates shown in UTC+08:00</span></footer>
    </div>
    {confirmLogout && <Modal title="Log out of your workspace?" onClose={() => !busy && setConfirmLogout(false)} footer={<><button className="btn btn-outline-secondary" disabled={busy} onClick={() => setConfirmLogout(false)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={signOut}>{busy ? "Logging out…" : "Logout"}</button></>}>
      <p>This will end your session. Use the team sign-in page to access your HR workspace again.</p><ErrorBox error={error} />
    </Modal>}
  </div>;
}
