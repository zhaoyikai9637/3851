// Display-only formatting: database values and experience calculations stay unchanged.
export function formatExperience(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return 'Not provided';
  const years = Number(value);
  if (!Number.isFinite(years) || years < 0) return 'Not provided';
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}
