import axios from "axios";

const api = axios.create({
  baseURL: "/applicant-api",
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    const session = await axios.get('/api/me', { withCredentials: true });
    config.headers['X-CSRF-Token'] = session.data.csrfToken;
  }
  return config;
});

export function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const validationMessage = error.response?.data?.errors?.[0]?.msg;
  return validationMessage || error.response?.data?.message || fallback;
}

export default api;
