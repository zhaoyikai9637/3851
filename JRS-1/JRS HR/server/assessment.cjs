"use strict";
const { fail } = require("./errors.cjs");

function parseAssessment(value) {
  let rows;
  try {
    rows = JSON.parse(value);
  } catch {
    fail(422, "Assessment criteria must be valid JSON.");
  }
  if (!Array.isArray(rows) || rows.length > 20) fail(422, "Use up to 20 assessment criteria.");
  const labels = new Set();
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      Object.keys(row).some((key) => !["label", "rating"].includes(key))
    )
      fail(422, "Invalid assessment criterion.");
    if (typeof row.label !== "string" || !row.label.trim() || row.label.trim().length > 80)
      fail(422, "Each criterion needs a name of up to 80 characters.");
    const label = row.label.trim().replace(/\s+/g, " "),
      key = label.toLowerCase();
    if (labels.has(key)) fail(422, "Assessment criterion names must be distinct.");
    labels.add(key);
    if (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5)
      fail(422, "Rate each assessment criterion from 1 to 5.");
    return { label, rating: row.rating };
  });
}
module.exports = { parseAssessment };
