import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "/applicant-api");
const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  if (apiBaseUrl === "/applicant-api" && !["get", "head", "options"].includes((config.method || "get").toLowerCase())) {
    const session = await axios.get("/api/me", { withCredentials: true });
    config.headers["X-CSRF-Token"] = session.data.csrfToken;
  }
  return config;
});

export function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const validationMessage = error.response?.data?.errors?.[0]?.msg;
  return validationMessage || error.response?.data?.message || fallback;
}

export default api;
