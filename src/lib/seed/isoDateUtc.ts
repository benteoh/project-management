/** ISO calendar dates in UTC (no time-of-day) — matches `forecast_entries.date` format. */

export function parseIsoDate(s: string): { y: number; m: number; d: number } {
  const p = s.split("-").map(Number);
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid ISO date: ${s}`);
  }
  return { y: p[0]!, m: p[1]!, d: p[2]! };
}

export function toIsoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Earlier of two `YYYY-MM-DD` strings (lexicographic compare). */
export function minIso(a: string, b: string): string {
  return a <= b ? a : b;
}

function utcTime(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d);
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const { y, m, d } = parseIsoDate(iso);
  const t = utcTime(y, m, d) + deltaDays * 86_400_000;
  const dt = new Date(t);
  return toIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 0 = Monday … 6 = Sunday */
export function dayOfWeekMon0(iso: string): number {
  const { y, m, d } = parseIsoDate(iso);
  const dow = new Date(utcTime(y, m, d)).getUTCDay();
  return (dow + 6) % 7;
}

export function mondayOfSameWeek(iso: string): string {
  const k = dayOfWeekMon0(iso);
  return addDaysIso(iso, -k);
}

/** Move by `dayDelta` working days within Mon–Fri of the same calendar week as `iso`. */
export function shiftWeekdayInSameWeek(iso: string, dayDelta: number): string {
  const mon = mondayOfSameWeek(iso);
  const idx = dayOfWeekMon0(iso);
  const nextIdx = Math.min(4, Math.max(0, idx + dayDelta));
  return addDaysIso(mon, nextIdx);
}

export function iterateWeekdaysInclusive(startIso: string, endIso: string): string[] {
  const startParts = parseIsoDate(startIso);
  const endParts = parseIsoDate(endIso);
  if (
    utcTime(startParts.y, startParts.m, startParts.d) > utcTime(endParts.y, endParts.m, endParts.d)
  ) {
    return [];
  }

  const out: string[] = [];
  let cur = startIso;
  const endT = utcTime(endParts.y, endParts.m, endParts.d);
  for (;;) {
    const { y, m, d } = parseIsoDate(cur);
    const t = utcTime(y, m, d);
    if (t > endT) break;
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

/** Monday-based week identity (YYYY-MM-DD of that week’s Monday). */
export function weekBucketMonday(iso: string): string {
  return mondayOfSameWeek(iso);
}

/** Next calendar date that falls on a weekday (Mon–Fri), UTC. */
export function nextWeekdayIso(iso: string): string {
  let cur = addDaysIso(iso, 1);
  for (let i = 0; i < 14; i++) {
    const mon0 = dayOfWeekMon0(cur);
    if (mon0 <= 4) return cur;
    cur = addDaysIso(cur, 1);
  }
  return cur;
}
