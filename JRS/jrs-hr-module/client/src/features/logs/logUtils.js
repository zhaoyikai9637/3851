export const initialLogFilters = { search: "", trigger: "", from: "", to: "", page: 1, pageSize: 10 };

export function logDayLabel(value, now = new Date()) {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() - 86400000));
  if (localDate === today) return "Today";
  if (localDate === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" }).format(new Date(value));
}

export function groupLogs(items) {
  return items.reduce((groups, item) => {
    const label = logDayLabel(item.sentAt);
    const group = groups.find((entry) => entry.label === label);
    if (group) group.items.push(item);
    else groups.push({ label, items: [item] });
    return groups;
  }, []);
}
