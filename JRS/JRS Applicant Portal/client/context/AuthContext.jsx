import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  async function startDemoSession() {
    const { data } = await api.post("/auth/demo-session");
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await api.post("/auth/logout");
    // Signed-out applicants return to the public job list rather than a sign-in form.
    window.location.replace("/jobs");
  }

  const value = useMemo(
    () => ({ user, loading, refreshSession, startDemoSession, logout }),
    [user, loading, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
