import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { ErrorBox, Loading } from "./shared";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function teamLoginLink(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  const [entry, setEntry] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    let active = true;
    setChecking(true);
    setError(null);
    // Configuration and the authenticated profile are independent. A config
    // failure does not discard a valid identity; it leaves the link unavailable.
    Promise.allSettled([api.request("/api/auth/config"), api.me()]).then(([config, auth]) => {
      if (!active) return;
      setEntry(config.status === "fulfilled" ? config.value : null);
      setSession(auth.status === "fulfilled" ? auth.value : null);
      if (auth.status === "rejected" && auth.reason.status !== 401) setError(auth.reason);
      else if (config.status === "rejected") setError(config.reason);
      setChecking(false);
    });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => api.onUnauthorized(() => {
    setSession(null);
    setError(Object.assign(new Error("Your session has expired. Please sign in again."), {status:401}));
  }), []);
  const loginUrl = teamLoginLink(entry?.loginUrl);
  const redirecting = !checking && !session && Boolean(loginUrl) && (!error || error.status === 401);
  useEffect(() => {
    if (!redirecting) return;
    const target = new URL(loginUrl);
    const current = new URL(window.location.href);
    if (!signedOut && current.pathname.startsWith('/hr/')) target.searchParams.set('returnTo', current.pathname + current.search + current.hash);
    window.location.replace(target.href);
  }, [redirecting, loginUrl, signedOut]);
  async function developmentLogin() {
    setChecking(true);
    setError(null);
    try {
      await api.request("/api/auth/development-login", { method: "POST" });
      setSession(await api.me());
    } catch (nextError) {
      setError(nextError);
    } finally { setChecking(false); }
  }
  const value = {
    ...session,
    setUser: (user) => setSession((s) => ({ ...s, user })),
    async logout() {
      await api.logout();
      setSignedOut(true);
      setSession(null);
      setError(null);
    },
  };
  if (checking || redirecting) return <main className="startup"><Loading /></main>;
  if (!session) return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="access-title">
        <p className="eyebrow">JRS · HR WORKSPACE</p>
        <h1 id="access-title">{entry?.developmentLogin ? 'Local workspace access' : 'Unable to open workspace'}</h1>
        <ErrorBox error={error} />
        {entry?.adapterConfigured === false && <p>Team sign-in is not connected yet.</p>}
        {!loginUrl && !entry?.developmentLogin && <p>The team sign-in address has not been configured.</p>}
        <div className="access-actions">
          {loginUrl && <a className="btn btn-primary" href={loginUrl}>Go to team sign-in</a>}
          {entry?.developmentLogin && <button className="btn btn-primary" onClick={developmentLogin}>Continue locally</button>}
          <button className="btn btn-outline-secondary" onClick={() => setAttempt((n) => n + 1)}>Check sign-in status</button>
        </div>
      </section>
    </main>
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
