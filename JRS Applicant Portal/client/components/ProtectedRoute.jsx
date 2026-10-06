import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="full-page-message" role="status">
        <div className="spinner-border text-primary" aria-hidden="true" />
        <p>Loading applicant portal...</p>
      </div>
    );
  }

  if (!user) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={"/connect?returnTo=" + encodeURIComponent(returnTo)} replace />;
  }

  return <Outlet />;
}
