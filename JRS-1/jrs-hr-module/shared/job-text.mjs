// Display existing paragraphs as bullets without changing stored job text.
export function jobBulletPoints(value) {
  return (Array.isArray(value) ? value : [value]).flatMap(item =>
    String(item ?? "").split(/\r?\n/).map(line => line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "")).filter(Boolean)
  );
}
