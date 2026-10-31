import { ApiError } from "../../src/api";
const endpoint = "/recruitment/api/hr/job-postings";

export function createJobsClient(fetcher = (...args) => fetch(...args)) {
  let csrf = "",
    pending = null;
  async function request(url, options = {}) {
    let response;
    try {
      response = await fetcher(url, { credentials: "same-origin", ...options });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new ApiError(
        0,
        "Unable to reach the server. Your changes have not been discarded. Retry to check the saved state.",
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        response.status,
        "The server returned an unexpected response. Retry to check the saved state.",
      );
    }
    if (!response.ok)
      throw Object.assign(
        new ApiError(
          response.status,
          data.error?.message || "The job request could not be completed.",
        ),
        { code: data.error?.code },
      );
    return data;
  }
  async function write(url, body, revision) {
    const signature = JSON.stringify({ url, body });
    if (pending?.signature !== signature) pending = { signature, key: crypto.randomUUID() };
    try {
      const data = await request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          "If-Match": String(revision),
          "Idempotency-Key": pending.key,
        },
        body: JSON.stringify(body),
      });
      pending = null;
      return data;
    } catch (error) {
      if (error.status >= 400 && error.status < 500) pending = null;
      throw error;
    }
  }
  return {
    async load(signal) {
      const [identity, data] = await Promise.all([
        request("/recruitment/api/auth/me", { signal }),
        request(endpoint, { signal }),
      ]);
      csrf = identity.csrfToken;
      return data;
    },
    save: (body, revision) => write(endpoint, body, revision),
    status: (id, status, revision) =>
      write(`${endpoint}/${encodeURIComponent(id)}/status`, { status }, revision),
  };
}
