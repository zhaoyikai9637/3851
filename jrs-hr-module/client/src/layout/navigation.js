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
];

export function pageName(pathname) {
  return (
    communicationLinks.find(([path]) => path === pathname)?.[1] ||
    workspaceLinks.find(([path]) => path === pathname)?.[1] ||
    "My Profile"
  );
}
