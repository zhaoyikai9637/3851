import assert from "node:assert/strict";
import { test } from "node:test";
import { experienceError, experienceMonths } from "../../shared/applicantFields.js";
import { educationRecords, languageRecords } from "../data/profileFields.js";
const role = (startDate, endDate, currentRole = false) => ({ startDate, endDate, currentRole });
test("month formats and date order cannot be bypassed", () => {
  for (const start of ["2002.3", "2002 March", "2002-3", "2002-13", "2030-01"]) assert.ok(experienceError([role(start, "2025-01")], "2026-10"));
  assert.ok(experienceError([role("2024-01", "2023-12")], "2026-10"));
  assert.equal(experienceError([role("2002-03", "2002-05")], "2026-10"), "");
});
test("duration counts inclusive calendar months and merges concurrent work", () => {
  assert.equal(experienceMonths([role("2002-03", "2002-05")], "2026-10"), 3);
  assert.equal(experienceMonths([role("2024-01", "2024-06"), role("2024-03", "2024-09")], "2026-10"), 9);
  assert.equal(experienceMonths([role("2026-09", null, true)], "2026-10"), 2);
  assert.equal(experienceMonths([role("2024-01", "2024-01"), role("2024-03", "2024-03")], "2026-10"), 2);
});
test("education years are numeric and empty rows are not stored", () => {
  assert.deepEqual(educationRecords([{ institution: "", qualification: "" }]), []);
  const record = educationRecords([{ institution: " Example  School ", qualification: "Degree", qualificationLevel: "BACHELOR", startYear: "2020", graduationYear: "2024" }])[0];
  assert.equal(record.startYear, 2020);
  assert.equal(record.institution, "Example School");
  assert.throws(() => educationRecords([{ institution: "Example" }]));
});
test("languages use codes, reject duplicate names and require both levels", () => {
  const row = { language: " English ", readingLevel: "Advanced", writingLevel: "Basic" };
  assert.equal(languageRecords([row])[0].language, "en");
  assert.throws(() => languageRecords([row, { ...row, language: "en" }]));
  assert.throws(() => languageRecords([{ ...row, writingLevel: "" }]));
});
