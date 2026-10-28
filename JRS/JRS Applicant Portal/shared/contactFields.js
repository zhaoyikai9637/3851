import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const MAX_SKILLS = 50;
export const MAX_SKILL_LENGTH = 60;

const preferredSkillCase = new Map([
  ["javascript", "JavaScript"], ["typescript", "TypeScript"], ["react", "React"],
  ["html", "HTML"], ["css", "CSS"], ["node.js", "Node.js"], ["python", "Python"],
  ["java", "Java"], ["sql", "SQL"], ["mysql", "MySQL"], ["git", "Git"],
  ["figma", "Figma"], ["ux research", "UX research"], ["prototyping", "Prototyping"],
  ["data analysis", "Data analysis"], ["excel", "Excel"], ["power bi", "Power BI"],
  ["test automation", "Test automation"], ["manual testing", "Manual testing"],
  ["project management", "Project management"], ["communication", "Communication"],
  ["customer service", "Customer service"], ["c++", "C++"], ["c#", "C#"],
  ["aws", "AWS"], ["php", "PHP"], ["vue.js", "Vue.js"], ["angular", "Angular"],
  ["docker", "Docker"], ["kubernetes", "Kubernetes"], ["jira", "Jira"],
  ["rest api", "REST API"],
  ["node_js", "Node.js"], ["ux_research", "UX research"], ["data_analysis", "Data analysis"],
  ["power_bi", "Power BI"], ["test_automation", "Test automation"], ["manual_testing", "Manual testing"],
  ["project_management", "Project management"], ["customer_service", "Customer service"],
]);

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

export function normaliseSkill(value) {
  if (typeof value !== "string") throw new Error("Enter a valid skill name.");
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > MAX_SKILL_LENGTH) throw new Error(`Each skill must contain 1 to ${MAX_SKILL_LENGTH} characters.`);
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .+#/&()_-]*$/u.test(cleaned)) throw new Error("Use letters, numbers, spaces, or common skill symbols only.");
  return preferredSkillCase.get(cleaned.toLocaleLowerCase("en")) || cleaned;
}

export function canonicalSkills(value) {
  if (!Array.isArray(value) || value.length > MAX_SKILLS) throw new Error(`Add up to ${MAX_SKILLS} skills.`);
  const unique = new Map();
  value.forEach((skill) => {
    const cleaned = normaliseSkill(skill);
    const key = cleaned.toLocaleLowerCase("en");
    if (!unique.has(key)) unique.set(key, cleaned);
  });
  return [...unique.values()].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}
