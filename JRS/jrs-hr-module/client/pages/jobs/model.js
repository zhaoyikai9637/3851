export function displayDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function isoDate(value) {
  if (!value.trim()) return "";
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error("Enter a valid date using DD/MM/YYYY.");
  const [, day, month, year] = match,
    iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso)
    throw new Error("Enter a valid date using DD/MM/YYYY.");
  return iso;
}

export function jobDraft(job = {}) {
  job = job || {};
  return {
    id: job.id,
    title: job.title || "",
    department: job.department || "",
    type: job.type || "Full-time",
    mode: job.mode || "On-site",
    location: job.location || "",
    experience: job.experience || "",
    skills: Array.isArray(job.skills) ? job.skills.join(", ") : job.skills || "",
    description: job.description || "",
    requirements: Array.isArray(job.requirements)
      ? job.requirements.join("\n")
      : job.requirements || "",
    status: job.status || "Draft",
    salaryRange: job.salaryRange || "",
    closingDate: displayDate(job.closingDate),
    publishDate: displayDate(job.publishDate),
    unpublishDate: displayDate(job.unpublishDate),
  };
}

export function jobPayload(draft) {
  const fail = (message, tab) => {
    throw Object.assign(new Error(message), { tab });
  };
  for (const [key, label] of [
    ["title", "Job title"],
    ["department", "Department"],
    ["location", "Location"],
    ["experience", "Experience"],
    ["skills", "Required skills"],
  ])
    if (!draft[key].trim()) fail(`${label} is required.`, "Overview");
  if (!draft.description.trim()) fail("Job description is required.", "Requirements");
  const requirements = draft.requirements
    .split(/\r?\n/)
    .map((row) => row.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s*)/, ""))
    .filter(Boolean);
  if (requirements.length < 8 || requirements.length > 12)
    fail("Enter 8 to 12 distinct job requirements, one per line.", "Requirements");
  if (
    new Set(requirements.map((row) => row.toLowerCase().replace(/\s+/g, " "))).size !==
    requirements.length
  )
    fail("Job requirements must not contain duplicate criteria.", "Requirements");
  const payload = { ...draft, requirements: requirements.join("\n") };
  try {
    for (const key of ["closingDate", "publishDate", "unpublishDate"])
      payload[key] = isoDate(draft[key]);
  } catch (error) {
    fail(error.message, "Publishing");
  }
  if (payload.publishDate && payload.closingDate && payload.closingDate < payload.publishDate)
    fail("Closing date must not be before publication.", "Publishing");
  if (payload.publishDate && payload.unpublishDate && payload.unpublishDate < payload.publishDate)
    fail("Unpublish date must not be before publication.", "Publishing");
  return payload;
}
