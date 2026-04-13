/** Quarter-hour steps for generated hours (matches typical timesheet granularity). */
export function roundHoursQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/** Whole hours per entry, each ≤ `maxPerDay`, summing to `Math.round(totalHours)`. */
export function splitWholeHoursIntoMaxPerDay(totalHours: number, maxPerDay: number): number[] {
  const t = Math.max(0, Math.round(totalHours));
  if (t === 0) return [];
  const cap = Math.max(1, Math.floor(maxPerDay));
  const chunks: number[] = [];
  let left = t;
  while (left > 0) {
    const n = Math.min(cap, left);
    chunks.push(n);
    left -= n;
  }
  return chunks;
}
