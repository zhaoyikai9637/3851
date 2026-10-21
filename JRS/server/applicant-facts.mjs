import { skillOptions } from '../JRS Applicant Portal/shared/contactFields.js';
import { currentMonth as businessMonth } from '../JRS Applicant Portal/shared/applicantFields.js';
import { httpError } from './security.mjs';
export function workFacts(experiences, currentMonth = businessMonth()) {
  const month = value => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) throw httpError(400, 'Enter a valid employment month.');
    return Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
  };
  const now = month(currentMonth), intervals = [], skills = new Map();
  for (const row of experiences) {
    const start = month(row.startDate), end = row.currentRole ? now : month(row.endDate);
    if (start > end || end > now) throw httpError(400, 'Employment date range is invalid.');
    intervals.push([start, end]);
    for (const text of (Array.isArray(row.skills)?row.skills.map(code=>skillOptions[code]||code):String(row.skills || '').split(','))) { const skill = text.trim(); if (skill && !skills.has(skill.toLowerCase())) skills.set(skill.toLowerCase(), skill); }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0, previous = null;
  for (const [start, end] of intervals) {
    if (!previous || start > previous[1]+1) { if (previous) total += previous[1] - previous[0]+1; previous = [start, end]; }
    else previous[1] = Math.max(previous[1], end);
  }
  if (previous) total += previous[1] - previous[0]+1;
  if (total > 70 * 12) throw httpError(400, 'Employment date range exceeds 70 years.');
  return { experience: Math.round(total / 12 * 10) / 10, skills: [...skills.values()] };
}
