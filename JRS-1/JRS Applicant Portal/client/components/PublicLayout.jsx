import { useState } from "react";
import { ApplicantBreadcrumbTarget } from "./ApplicantBreadcrumbs";
import { BriefcaseBusiness, LogIn, UserRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PublicLayout() {
  const { user, loading } = useAuth();
  const [breadcrumbTarget, setBreadcrumbTarget] = useState(null);

  return (
    <ApplicantBreadcrumbTarget.Provider value={breadcrumbTarget}>
    <div className="public-shell">
      <header className="public-header">
        <Link className="public-brand" to="/jobs" aria-label="JRS open roles">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <strong>JRS</strong>
            <small>JOB RECRUITMENT SYSTEM</small>
          </div>
        </Link>

        <nav className="public-navigation" aria-label="Public navigation">
          <NavLink to="/jobs" className={({ isActive }) => isActive ? "active" : ""}>
            <BriefcaseBusiness size={20} />
            <span>Open roles</span>
          </NavLink>
        </nav>

        {!loading && (
          user ? (
            <Link className="btn btn-primary" to="/applicant/jobs">
              <UserRound size={19} />
              Applicant workspace
            </Link>
          ) : (
            <Link className="btn btn-outline-primary" to="/connect">
              <LogIn size={19} />
              Sign in
            </Link>
          )
        )}
      </header>
      <div className="public-breadcrumb-bar applicant-breadcrumb-target" ref={setBreadcrumbTarget} />

      <main className="public-content">
        <Outlet />
      </main>

    </div>
    </ApplicantBreadcrumbTarget.Provider>
  );
}
