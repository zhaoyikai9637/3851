export const qualifications = { SECONDARY: "Secondary school", CERTIFICATE: "Certificate", DIPLOMA: "Diploma", ASSOCIATE: "Associate degree", BACHELOR: "Bachelor's degree", MASTER: "Master's degree", DOCTORATE: "Doctorate", OTHER: "Other qualification" };
export const languages = { en: "English", zh: "Chinese", ms: "Malay", ta: "Tamil", hi: "Hindi", id: "Indonesian", vi: "Vietnamese", th: "Thai", ja: "Japanese", ko: "Korean", fr: "French", de: "German", es: "Spanish", ar: "Arabic", pt: "Portuguese", ru: "Russian", bn: "Bengali", ur: "Urdu", fil: "Filipino", other: "Other language" };
export const levels = { Basic: "Basic", Intermediate: "Intermediate", Advanced: "Advanced", Native: "Native" };
export const cleanText = (value) => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : value;
export function languageCode(value) {
  const text = cleanText(value)?.toLowerCase();
  return Object.entries(languages).find(([code, label]) => code === text || label.toLowerCase() === text)?.[0] ?? value;
}
export function currentMonth() {
  return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Singapore'}).slice(0,7);
}
export function validMonth(value) {
  return typeof value === "string" && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
}
export function experienceError(records, asOf = currentMonth()) {
  if (!Array.isArray(records)) return "Work experience must be a list.";
  for (const row of records) {
    if (!row || !validMonth(row.startDate) || row.startDate > asOf) return "Select a valid start month, not in the future.";
    if (typeof row.currentRole !== "boolean") return "Current role must be true or false.";
    if (row.currentRole) {
      if (row.endDate) return "Current roles must not have an end month.";
    } else if (!validMonth(row.endDate) || row.endDate < row.startDate || row.endDate > asOf) {
      return "Select an end month between the start month and the current month.";
    }
  }
  return "";
}
const monthIndex = (value) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
// Count calendar months inclusively, merging overlaps so concurrent jobs count once.
export function experienceMonths(records, asOf = currentMonth()) {
  if (experienceError(records, asOf)) throw new Error(experienceError(records, asOf));
  const ranges = records.map((row) => [monthIndex(row.startDate), monthIndex(row.currentRole ? asOf : row.endDate)]).sort((a, b) => a[0] - b[0]);
  let total = 0, start, end;
  for (const [from, to] of ranges) {
    if (start === undefined) { start = from; end = to; }
    else if (from <= end + 1) end = Math.max(end, to);
    else { total += end - start + 1; start = from; end = to; }
  }
  return total + (start === undefined ? 0 : end - start + 1);
}
