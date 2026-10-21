import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const skillOptions = { JAVASCRIPT: "JavaScript", TYPESCRIPT: "TypeScript", REACT: "React", HTML: "HTML", CSS: "CSS", NODE_JS: "Node.js", PYTHON: "Python", JAVA: "Java", SQL: "SQL", MYSQL: "MySQL", GIT: "Git", FIGMA: "Figma", UX_RESEARCH: "UX research", PROTOTYPING: "Prototyping", DATA_ANALYSIS: "Data analysis", EXCEL: "Excel", POWER_BI: "Power BI", TEST_AUTOMATION: "Test automation", MANUAL_TESTING: "Manual testing", PROJECT_MANAGEMENT: "Project management", COMMUNICATION: "Communication", CUSTOMER_SERVICE: "Customer service" };

export function canonicalPhone(value) {
  if (typeof value !== "string" || !value.trim().startsWith("+")) throw new Error("Select a country calling code and enter a valid phone number.");
  const phone = parsePhoneNumberFromString(value, { extract: false });
  if (!phone?.isValid() || phone.ext) throw new Error("Enter a valid phone number without an extension.");
  return phone.number;
}
// JSON preserves the country/state/city tuple without ambiguous separators.
export function locationParts(value) {
  try { const parts = JSON.parse(value); return Array.isArray(parts) && parts.length === 3 ? parts : ["", "", ""]; }
  catch { return value === "Singapore" ? ["SG", "", ""] : ["", "", ""]; }
}
export function locationLabel(value) {
  const [country, state, city] = locationParts(value);
  try { return [city, state, country && new Intl.DisplayNames(["en"], { type: "region" }).of(country)].filter(Boolean).join(", ") || value; }
  catch { return value; }
}
export function canonicalSkills(value) {
  if (!Array.isArray(value) || value.length > 20 || value.some((code) => typeof code !== "string" || !Object.hasOwn(skillOptions, code))) throw new Error("Select up to 20 skills from the list.");
  return [...new Set(value)].sort();
}
