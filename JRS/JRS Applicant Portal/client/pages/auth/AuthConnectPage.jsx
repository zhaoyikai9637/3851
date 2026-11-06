import { ArrowLeft, LogIn, MonitorPlay } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { getApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { loginUrl, safeReturnTo } from "../../utils/navigation";

const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_AUTH !== "false";

export default function AuthConnectPage() {
  const { user, loading, startDemoSession } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [startingPreview, setStartingPreview] = useState(false);
  const [error, setError] = useState("");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  // Without the local demo option this page has nothing to offer, so go straight to sign-in.
  const goStraightToLogin = !demoEnabled && !loading && !user;

  useEffect(() => {
    if (goStraightToLogin) window.location.replace(loginUrl(returnTo));
  }, [goStraightToLogin, returnTo]);

  if (goStraightToLogin) return null;
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
        <h1>Log in to continue</h1>
        <p className="auth-connect-intro">
          Log in or create an account to apply for jobs and track your applications.
        </p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="auth-connect-actions">
          <a className="btn btn-primary btn-lg" href={loginUrl(returnTo)}>
            <LogIn size={20} />
            Log in / Register
          </a>
          {demoEnabled && (
            <button className="btn btn-outline-secondary btn-lg" type="button" onClick={previewAuthenticatedPages} disabled={startingPreview}>
              <MonitorPlay size={20} />
              {startingPreview ? "Opening preview..." : "Preview signed-in pages"}
            </button>
          )}
        </div>

        <Link className="back-link" to="/jobs">
          <ArrowLeft size={19} />
          Back to jobs
        </Link>
      </section>
    </div>
  );
}
