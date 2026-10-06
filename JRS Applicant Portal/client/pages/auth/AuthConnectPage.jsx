import { ArrowLeft, ExternalLink, LogIn, MonitorPlay } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { getApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

function safeReturnTo(value) {
  return value?.startsWith("/applicant/") ? value : "/applicant/jobs";
}

function teamLoginUrl(returnTo) {
  const loginUrl = new URL(
    import.meta.env.VITE_AUTH_LOGIN_URL || "http://127.0.0.1:3002/login",
    window.location.origin,
  );
  const callbackUrl = new URL("/auth/complete", window.location.origin);
  callbackUrl.searchParams.set("returnTo", returnTo);
  loginUrl.searchParams.set("returnTo", callbackUrl.toString());
  return loginUrl.toString();
}

export default function AuthConnectPage() {
  const { user, loading, startDemoSession } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [startingPreview, setStartingPreview] = useState(false);
  const [error, setError] = useState("");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  if (!loading && user) return <Navigate to={returnTo} replace />;

  async function previewAuthenticatedPages() {
    setStartingPreview(true);
    setError("");
    try {
      await startDemoSession();
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError, "The local applicant preview is not available."));
    } finally {
      setStartingPreview(false);
    }
  }

  return (
    <div className="auth-connect-page">
      <section className="auth-connect-panel surface">
        <p className="eyebrow text-primary">AUTHENTICATION HANDOFF</p>
        <h1>Sign in to continue your application</h1>
        <p className="auth-connect-intro">
          Account registration and password verification are provided by the team's shared login module.
          After authentication, the applicant returns here and enters the detailed workspace.
        </p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="auth-connect-actions">
          <a className="btn btn-primary btn-lg" href={teamLoginUrl(returnTo)}>
            <LogIn size={20} />
            Continue to team sign-in
            <ExternalLink size={17} />
          </a>
          {import.meta.env.VITE_ENABLE_DEMO_AUTH !== "false" && (
            <button className="btn btn-outline-secondary btn-lg" type="button" onClick={previewAuthenticatedPages} disabled={startingPreview}>
              <MonitorPlay size={20} />
              {startingPreview ? "Opening preview..." : "Preview signed-in pages"}
            </button>
          )}
        </div>

        <Link className="back-link" to="/jobs">
          <ArrowLeft size={19} />
          Return to public jobs
        </Link>
      </section>
    </div>
  );
}
