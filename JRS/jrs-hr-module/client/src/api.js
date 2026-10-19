export class ApiError extends Error {
  constructor(status, message, fields = []) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function createApi(fetcher = (...args) => fetch(...args)) {
  let csrfToken = "";
  const listeners = new Set();
  const api = {
    setToken(value) {
      csrfToken = value || "";
    },
    onUnauthorized(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async request(url, { method = "GET", body, signal } = {}) {
      const mutation = !["GET", "HEAD"].includes(method);
      if (mutation && !csrfToken) await api.csrf();
      const headers = { Accept: "application/json" };
      if (mutation) headers["X-CSRF-Token"] = csrfToken;
      const form = body instanceof FormData;
      if (body !== undefined && !form)
        headers["Content-Type"] = "application/json";
      let response;
      try {
        response = await fetcher(url, {
          method,
          headers,
          credentials: "same-origin",
          signal,
          ...(body !== undefined
            ? { body: form ? body : JSON.stringify(body) }
            : {}),
        });
      } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new ApiError(
          0,
          "Unable to reach the server. Check your connection and try again.",
        );
      }
      if (response.status === 204) return null;
      let value;
      try {
        value = await response.json();
      } catch {
        throw new ApiError(
          response.status,
          "The server returned an unexpected response. Please try again.",
        );
      }
      if (!response.ok) {
        if (response.status === 401 && (url.startsWith("/api/hr/") || url === "/api/auth/logout")) {
          csrfToken = "";
          listeners.forEach((fn) => fn());
        }
        throw new ApiError(
          response.status,
          value?.error?.message || "The request could not be completed.",
          value?.error?.fields || [],
        );
      }
      return value;
    },
    async csrf() {
      const data = await api.request("/api/auth/csrf");
      api.setToken(data.csrfToken);
      return data;
    },
    async me() {
      const data = await api.request("/api/auth/me");
      api.setToken(data.csrfToken);
      return data;
    },
    async logout() {
      await api.request("/api/auth/logout", { method: "POST" });
      api.setToken("");
    },
    async download(id, name) {
      let response;
      try {
        response = await fetcher(`/api/hr/attachments/${id}/download`, {
          credentials: "same-origin",
        });
      } catch {
        throw new ApiError(0, "Unable to download the attachment. Try again.");
      }
      if (!response.ok) {
        if (response.status === 401) listeners.forEach((fn) => fn());
        const value = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          value?.error?.message || "Attachment unavailable.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
  return api;
}
export const api = createApi();
export function query(values) {
  return new URLSearchParams(
    Object.entries(values).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  ).toString();
}
