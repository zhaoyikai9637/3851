import { useCallback, useEffect, useRef, useState } from "react";

// Shared client for native React pages that work on the recruitment workspace
// snapshot (/recruitment/api/hr/workspace) and its command endpoint. It follows
// the same protocol as the embedded workspace: CSRF token from auth/me, the
// snapshot revision as If-Match, and one idempotency key per distinct command.

async function readJson(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server response could not be read. Please refresh.");
  }
  if (!response.ok) {
    const error = new Error(data.error?.message || "Request failed.");
    error.status = response.status;
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

const requestKey = () => "request-" + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));

export function useWorkspace(fetcher = (...args) => fetch(...args), returnTo = "/hr/dashboard") {
  const [db, setDb] = useState(null);
  const [error, setError] = useState("");
  const csrf = useRef("");
  const pending = useRef(null);
  const dbRef = useRef(null);
  dbRef.current = db;

  const load = useCallback(async () => {
    try {
      const [me, workspace] = await Promise.all([
        fetcher("/recruitment/api/auth/me", { credentials: "same-origin" }).then(readJson),
        fetcher("/recruitment/api/hr/workspace", { credentials: "same-origin" }).then(readJson),
      ]);
      csrf.current = me.csrfToken || "";
      setDb(workspace);
      setError("");
      return workspace;
    } catch (requestError) {
      if (requestError.status === 401) {
        window.location.assign("/pages/login/login.html?returnTo=" + encodeURIComponent(returnTo));
        return null;
      }
      setError(requestError.message);
      return null;
    }
  }, [fetcher, returnTo]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = useCallback(
    async (command, payload) => {
      const fingerprint = JSON.stringify({ command, payload });
      if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: requestKey() };
      try {
        const result = await fetcher("/recruitment/api/hr/commands/" + encodeURIComponent(command), {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf.current,
            "If-Match": String(dbRef.current?.revision ?? 0),
            "Idempotency-Key": pending.current.key,
          },
          body: JSON.stringify(payload),
        }).then(readJson);
        pending.current = null;
        setDb(result.db);
        return result.result;
      } catch (requestError) {
        if (requestError.status && requestError.status < 500) pending.current = null;
        if (requestError.code === "REVISION_CONFLICT") {
          await load();
          requestError.message = "Newer changes were loaded. Review the current data before saving again.";
        }
        throw requestError;
      }
    },
    [fetcher, load],
  );

  return { db, error, load, commit };
}

export const candidateOf = (db, application) => db.candidates.find((item) => item.id === application?.candidateId) || { name: "Unknown candidate", email: "" };
export const jobOf = (db, application) => db.jobs.find((item) => item.id === application?.jobId) || { title: "Unknown job", status: "" };

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

// Business dates are Singapore dates, matching the embedded workspace.
export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? value + "T12:00:00+08:00" : value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", day: "2-digit", month: "2-digit", year: "numeric" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`;
}

export function singaporeToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
