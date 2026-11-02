import { describe, it, expect, vi } from "vitest";
import { createApi, query } from "../api";
const response = (value, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => value,
});

describe("JSON API transport", () => {
  it("takes CSRF from verified team identity and includes cookies on subsequent mutations", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: "before" }))
      .mockResolvedValueOnce(response({ csrfToken: "after", user: {} }))
      .mockResolvedValueOnce(response(null, 204));
    const api = createApi(fetcher);
    await api.csrf();
    await api.me();
    await api.request("/api/hr/notifications/1/read", { method: "PATCH" });
    expect(fetcher.mock.calls[1][0]).toBe("/api/auth/me");
    expect(api.login).toBeUndefined();
    expect(fetcher.mock.calls[2][1]).toMatchObject({
      credentials: "same-origin",
      headers: { "X-CSRF-Token": "after" },
    });
  });
  it("does not replay failed writes or hide validation fields", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(
          {
            error: {
              message: "Invalid",
              fields: [{ field: "body", message: "Unsupported variable" }],
            },
          },
          422,
        ),
      );
    const api = createApi(fetcher);
    api.setToken("token");
    await expect(
      api.request("/api/hr/templates", { method: "POST", body: {} }),
    ).rejects.toMatchObject({
      status: 422,
      fields: [{ field: "body", message: "Unsupported variable" }],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not replay an expired CSRF request", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ error: { message: "CSRF expired" } }, 403));
    const api = createApi(fetcher);
    api.setToken("old");
    await expect(api.logout()).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("leaves the multipart boundary to the browser", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({}));
    const api = createApi(fetcher);
    api.setToken("token");
    const body = new FormData();
    body.append(
      "photo",
      new File(["image"], "face.png", { type: "image/png" }),
    );
    await api.request("/api/hr/profile/photo", { method: "POST", body });
    expect(fetcher.mock.calls[0][1].body).toBe(body);
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
  });
  it("expires the UI session for protected 401s while initial identity checks remain explicit", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ error: { message: "Sign in" } }, 401));
    const api = createApi(fetcher),
      expired = vi.fn();
    const unsubscribe = api.onUnauthorized(expired);
    await expect(api.request("/api/auth/me")).rejects.toThrow("Sign in");
    expect(expired).not.toHaveBeenCalled();
    await expect(api.request("/api/hr/profile")).rejects.toThrow();
    expect(expired).toHaveBeenCalledTimes(1);
    api.setToken("valid-before-expiry");
    await expect(api.logout()).rejects.toThrow();
    expect(expired).toHaveBeenCalledTimes(2);
    unsubscribe();
    await expect(api.request("/api/hr/profile")).rejects.toThrow();
    expect(expired).toHaveBeenCalledTimes(2);
  });
  it("reports offline and invalid JSON responses without exposing HTML", async () => {
    await expect(
      createApi(vi.fn().mockRejectedValue(new TypeError("fetch failed"))).me(),
    ).rejects.toMatchObject({ status: 0 });
    const fetcher = vi.fn().mockResolvedValue({
      status: 502,
      ok: false,
      json: async () => {
        throw new Error("<html>proxy stack</html>");
      },
    });
    await expect(createApi(fetcher).me()).rejects.toThrow(
      "unexpected response",
    );
  });
  it("preserves AbortError so stale requests can be ignored", async () => {
    const error = new DOMException("Aborted", "AbortError");
    await expect(createApi(vi.fn().mockRejectedValue(error)).me()).rejects.toBe(
      error,
    );
  });
  it("reports missing attachments instead of downloading an error document", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response({ error: { message: "File no longer available." } }, 404),
      );
    await expect(createApi(fetcher).download(1, "offer.pdf")).rejects.toThrow(
      "File no longer available",
    );
  });
  it("serializes only supplied filters and encodes search text", () => {
    expect(query({ search: "Casey & Co", from: "", page: 1 })).toBe(
      "search=Casey+%26+Co&page=1",
    );
  });
});
