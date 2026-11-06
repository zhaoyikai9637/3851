import { useLocation } from "react-router-dom";
import { formatDate } from "../recruitment/workspaceClient";

// Small pieces of the embedded workspace markup, reproduced exactly so the scoped
// legacy stylesheet (src/legacy/legacy-scope.css) styles them the same way.

const PATHS = {
  search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 7 7" /></>,
  download: <path d="M12 2v14m-5-5 5 5 5-5M3 17v5h18v-5" />,
  plus: <path d="M12 3v18M3 12h18" />,
  minus: <path d="M4 12h16" />,
  print: <path d="M6 8V2h12v6M6 18H3V8h18v10h-3M6 14h12v8H6z" />,
  expand: <path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6" />,
  file: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 2h6v5H9zM8 11h8M8 15h8M8 19h5" /></>,
};

export function LegacyIcon({ name }) {
  return <svg className="" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name] || PATHS.file}</svg>;
}

const TONES = {
  "Pending Review": "amber", Interview: "purple", "Interview Results": "purple", Offer: "green", Rejected: "red", Hired: "green",
  Active: "blue", Draft: "gray", Closed: "gray", Scheduled: "purple", Completed: "green", Cancelled: "gray", Open: "amber",
};
const AVATAR_TONES = ["blue", "purple", "green", "amber", "red"];

export function Badge({ status }) {
  return <span className={"badge " + (TONES[status] || "gray")}>{status}</span>;
}

export function Avatar({ person }) {
  const tone = AVATAR_TONES[(Number(String(person.id || "").split("-").pop()) || 0) % 5];
  return <span className={"avatar " + tone}>{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>;
}

export function Empty({ title, detail = "Try changing your filters." }) {
  return <div className="empty"><LegacyIcon name="file" /><h3>{title}</h3><p>{detail}</p></div>;
}

export function formatDateTime(value) {
  if (!value) return "";
  return formatDate(value) + ", " + new Date(value).toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit" });
}

// Detail pages return to the list they were opened from (filters and page
// included), or to the full Applications queue when opened directly.
export function useReturnPath() {
  const origin = useLocation().state?.from;
  const back = typeof origin === "string" && origin.startsWith("/") && !origin.startsWith("//") ? origin : "/applications";
  return [back, back.startsWith("/interviews") ? "Back to Interviews" : "Back to Applications"];
}
