import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AuthCallbackPage() {
  const { refreshSession } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const requestedPath = searchParams.get("returnTo");
  const returnTo = requestedPath?.startsWith("/applicant/") ? requestedPath : "/applicant/jobs";

  useEffect(() => {
    refreshSession()
      .then((user) => {
        if (user) navigate(returnTo, { replace: true });
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [navigate, refreshSession, returnTo]);

  if (failed) {
    return (
      <div className="auth-connect-page">
        <section className="auth-connect-panel surface">
          <p className="eyebrow text-danger">SIGN-IN NOT CONFIRMED</p>
          <h1>The applicant session was not received</h1>
          <p>Return to the authentication connection page and try again.</p>
          <Link className="btn btn-primary btn-lg" to={"/connect?returnTo=" + encodeURIComponent(returnTo)}>Return to sign in</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="full-page-message">
      <div className="spinner-border text-primary" />
      <p>Confirming your applicant session...</p>
    </div>
  );
}
