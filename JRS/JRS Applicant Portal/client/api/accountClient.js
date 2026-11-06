import axios from "axios";

// Client for the shared account API (/api), which owns the personal profile.
// Writes carry the session's CSRF token, read from /api/me.
const accountApi = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { Accept: "application/json" },
});

accountApi.interceptors.request.use(async (config) => {
  if (!["get", "head", "options"].includes((config.method || "get").toLowerCase())) {
    const session = await axios.get("/api/me", { withCredentials: true });
    config.headers["X-CSRF-Token"] = session.data.csrfToken;
  }
  return config;
});

export function getAccountError(error, fallback = "Something went wrong. Please try again.") {
  return error.response?.data?.error || error.response?.data?.message || fallback;
}

export default accountApi;
