// Shared navigation helpers for the applicant portal.

// Statuses that no longer block a new application (mirrors server/applicant-data.mjs).
const CLOSED_STATUSES = ["Withdrawn", "Rejected"];

export function isActiveApplication(application) {
  return Boolean(application) && !CLOSED_STATUSES.includes(application.status);
}

// Only in-portal applicant paths are accepted as a return target.
export function safeReturnTo(value, fallback = "/applicant/jobs") {
  return typeof value === "string" && value.startsWith("/applicant/") && !/[\\\r\n]/.test(value) ? value : fallback;
}

// The shared sign-in page lives outside this React app, so this returns a full URL.
export function loginUrl(returnTo, { register = false } = {}) {
  const url = new URL(import.meta.env.VITE_AUTH_LOGIN_URL || "/pages/login/login.html", window.location.origin);
  url.searchParams.set("returnTo", safeReturnTo(returnTo));
  if (register) url.searchParams.set("mode", "register");
  return url.toString();
}

// Signed-in applicants viewing a public job page are moved to the matching workspace page.
export function workspacePathFor(publicPath) {
  return publicPath.startsWith("/jobs") ? "/applicant" + publicPath : "/applicant/jobs";
}
