import { cleanText, languageCode, languages, levels, qualifications } from "../../shared/applicantFields.js";

function nonempty(rows) {
  if (!Array.isArray(rows)) throw new Error("Records must be a list.");
  return rows.filter((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Invalid record.");
    return Object.values(row).some((value) => value !== "" && value !== null && value !== undefined);
  });
}
export function educationRecords(rows) {
  return nonempty(rows).map((row) => {
    const institution = cleanText(row.institution), qualification = cleanText(row.qualification);
    if (!institution || !qualification || !Object.hasOwn(qualifications, row.qualificationLevel)) throw new Error("Complete the school, qualification name and qualification level.");
    if (!/^\d{4}$/.test(String(row.startYear)) || !/^\d{4}$/.test(String(row.graduationYear))) throw new Error("Select both education years.");
    const startYear = Number(row.startYear), graduationYear = Number(row.graduationYear);
    const current = new Date().getFullYear();
    if (startYear < 1950 || startYear > current || graduationYear < startYear || graduationYear > current + 10) throw new Error("Invalid study period.");
    return { institution, qualification, qualificationLevel: row.qualificationLevel, startYear, graduationYear };
  });
}
export function languageRecords(rows) {
  const seen = new Set();
  return nonempty(rows).map((row) => {
    const language = languageCode(row.language);
    if (!Object.hasOwn(languages, language) || !Object.hasOwn(levels, row.readingLevel) || !Object.hasOwn(levels, row.writingLevel)) throw new Error("Select a language and both proficiency levels.");
    const otherLanguage = language === "other" ? cleanText(row.otherLanguage) : "";
    if (language === "other" && (typeof otherLanguage !== "string" || !otherLanguage || otherLanguage.length > 60)) throw new Error("Specify the other language name.");
    const key = language === "other" ? `other:${otherLanguage.toLowerCase()}` : language;
    if (seen.has(key)) throw new Error("Each language may only be added once.");
    seen.add(key);
    return { language, readingLevel: row.readingLevel, writingLevel: row.writingLevel, ...(otherLanguage ? { otherLanguage } : {}) };
  });
}
