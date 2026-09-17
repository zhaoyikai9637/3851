import { businessToday, dateTime } from "../../shared";

export const INITIAL_NOTIFICATION_FILTERS = {
  read: "all",
  search: "",
  type: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 20,
};

export const NOTIFICATION_PRESENTATION = {
  NEW_APPLICATION: { icon: "applications", action: "Review application" },
  STATUS_UPDATED: { icon: "person", action: "View candidate" },
  INTERVIEW: { icon: "calendar", action: "Open interview" },
  MESSAGE: { icon: "mail", action: "Read message" },
  OFFER: { icon: "jobs", action: "Review offer" },
  SYSTEM: { icon: "bell", action: "View details" },
};

function businessDate(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousBusinessDate(today) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function groupNotifications(items, now = new Date()) {
  const today = businessToday(now);
  const yesterday = previousBusinessDate(today);
  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const item of items) {
    const date = businessDate(item.createdAt);
    const group = date === today ? groups[0] : date === yesterday ? groups[1] : groups[2];
    group.items.push(item);
  }
  return groups.filter((group) => group.items.length);
}

export function notificationTime(value, group, now = new Date()) {
  const date = new Date(value);
  if (group === "Today") {
    const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60)
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-minutes, "minute");
    const hours = Math.max(1, Math.floor(minutes / 60));
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-hours, "hour");
  }
  if (group === "Yesterday")
    return `Yesterday, ${new Intl.DateTimeFormat("en-SG", {
      timeStyle: "short",
      timeZone: "Asia/Singapore",
    }).format(date)}`;
  return dateTime(value);
}

export function notificationTypeLabel(type) {
  return (
    {
      NEW_APPLICATION: "New application",
      STATUS_UPDATED: "Status updated",
    }[type] || type
  );
}
