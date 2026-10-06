import { BriefcaseBusiness, FileText, LogOut, Menu, Search, UserRoundSearch, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const pageTitles = {
  "/applicant/jobs": "Find a Suitable Role",
  "/applicant/resume": "Resume and Profile",
  "/applicant/resume/upload": "Upload Resume",
  "/applicant/status": "Application Status",
};

const navItems = [
  { to: "/applicant/jobs", label: "Jobs", icon: Search },
  { to: "/applicant/resume", label: "My Resume", icon: FileText },
  { to: "/applicant/status", label: "Application Status", icon: UserRoundSearch },
];

function titleForPath(pathname) {
  if (pathname.startsWith("/applicant/jobs/")) return "Role Details";
  if (pathname.startsWith("/applicant/apply/")) return "Submit Application";
  return pageTitles[pathname] || "Applicant Portal";
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Applicant navigation">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <strong>JRS</strong>
            <small>JOB RECRUITMENT SYSTEM</small>
          </div>
          <button className="icon-button sidebar-close d-lg-none" type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation">
            <X size={24} />
          </button>
        </div>

        <p className="sidebar-label">APPLICANT</p>
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="sidebar-link logout-button" type="button" onClick={handleLogout}>
          <LogOut size={22} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </aside>

      {menuOpen && <button className="sidebar-backdrop d-lg-none" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="main-column">
        <header className="topbar">
          <div className="d-flex align-items-center gap-3">
            <button className="icon-button d-lg-none" type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
              <Menu size={26} />
            </button>
            <h1>{titleForPath(location.pathname)}</h1>
          </div>

          <div className="applicant-identity">
            <div className="avatar" aria-hidden="true">{user?.fullName?.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
            <div className="identity-copy d-none d-sm-block">
              <strong>{user?.fullName}</strong>
              <span>Applicant</span>
            </div>
            <BriefcaseBusiness className="identity-icon d-none d-md-block" size={22} aria-hidden="true" />
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
