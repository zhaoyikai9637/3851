export function normaliseText(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

const employmentTypes = { full_time: "FULL_TIME", "full-time": "FULL_TIME", "full time": "FULL_TIME", part_time: "PART_TIME", "part-time": "PART_TIME", "part time": "PART_TIME" };
const experienceLevels = { years_1_3: "YEARS_1_3", "1-3 years": "YEARS_1_3", years_3_5: "YEARS_3_5", "3-5 years": "YEARS_3_5", years_5_7: "YEARS_5_7", "5-7 years": "YEARS_5_7" };

export const employmentCode = (value) => employmentTypes[normaliseText(value)] ?? null;
export const experienceCode = (value) => experienceLevels[normaliseText(value)] ?? null;

const workModes = { hybrid: "HYBRID", remote: "REMOTE", onsite: "ON_SITE", "on-site": "ON_SITE", "on site": "ON_SITE", on_site: "ON_SITE" };
export const workModeCode = (value) => workModes[normaliseText(value)] ?? null;

export function normaliseJobStorage(job) {
  const values = { employmentType: employmentCode(job.employmentType), experienceLevel: experienceCode(job.experienceLevel), workMode: workModeCode(job.workMode) };
  for (const [field, value] of Object.entries(values)) {
    if (!value) throw new Error(`Invalid ${field}; choose an approved option.`);
  }
  return { ...job, ...values };
}
