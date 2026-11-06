export const communicationLinks = [
  ["/notifications", "Notifications"],
  ["/templates", "Templates"],
  ["/logs", "Logs"],
];

export const workspaceLinks = [
  ["/dashboard", "Dashboard", "dashboard"],
  ["/applications", "Applications", "applications"],
  ["/candidates", "Candidates", "person"],
  ["/job-postings", "Job Postings", "jobs"],
  ["/interviews", "Interviews", "calendar"],
  ["/reports", "Reports", "reports"],
];

// Sidebar sections. Templates and Logs are reached from the Notifications page tabs,
// so the sidebar keeps one entry per area.
export const navigationGroups = [
  ["RECRUITMENT", [
    ["/dashboard", "Dashboard", "dashboard"],
    ["/job-postings", "Job Postings", "jobs"],
    ["/applications", "Applications", "applications"],
    ["/candidates", "Candidates", "candidates"],
    ["/interviews", "Interviews", "calendar"],
  ]],
  ["COMMUNICATION", [
    ["/notifications", "Notifications", "bell"],
    ["/reports", "Reports", "reports"],
  ]],
];

export function pageName(pathname) {
  if(pathname === "/notifications") return "Notification Center";
  if(pathname === "/templates") return "Email Templates";
  return (
    communicationLinks.find(([path]) => path === pathname)?.[1] ||
    workspaceLinks.find(([path]) => path === pathname)?.[1] ||
    (pathname.startsWith("/profile") ? "My Profile" : "HR Workspace")
  );
}
