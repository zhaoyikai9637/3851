import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

export function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const validationMessage = error.response?.data?.errors?.[0]?.msg;
  return validationMessage || error.response?.data?.message || fallback;
}

export default api;
