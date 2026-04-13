import type { ForecastProgrammeNode, ScopeItem } from "./types";

export function cleanScopeLabel(name: string): string {
  return name
    .replace(/^\d+\.\s*/, "") // strip leading index prefix ("13. ") only — never strip digits embedded in the title
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

export function scopesFromTree(tree: ForecastProgrammeNode[]): ScopeItem[] {
  return tree
    .filter((n) => n.type === "scope")
    .map((n) => ({ id: n.id, label: cleanScopeLabel(n.name) }));
}

/** Calendar YYYY-MM-DD in the user's local timezone (e.g. “today”, week helpers). */
export function toISODate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Calendar YYYY-MM-DD in UTC — use for {@link generateDailyDates} so column `field` keys match
 * `forecast_entries.date` and CSV ISO strings regardless of client timezone.
 */
export function toISODateUtc(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${mm}-${dd}`;
}

/** Display an ISO calendar date (YYYY-MM-DD) in en-GB short form for tooltips. */
export function formatIsoDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function computeStartDate(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  return toISODate(monday);
}

export function msUntilNextSaturdayMidnight(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const nextSat = new Date(now);
  nextSat.setDate(now.getDate() + daysUntilSat);
  nextSat.setHours(0, 0, 0, 0);
  return nextSat.getTime() - now.getTime();
}

// Returns the Monday of the week containing the given ISO date (or today).
export function startOfWeek(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToMonday);
  return toISODate(d);
}

// Returns the ISO date for today + N months.
export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

/**
 * Every calendar day from `startIso` through `endIso` (inclusive), as UTC-noon `Date` instances
 * so timezone/DST cannot shift the calendar day vs `YYYY-MM-DD` strings from the DB.
 */
export function generateDailyDates(startIso: string, endIso: string): Date[] {
  const dates: Date[] = [];
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  if ([sy, sm, sd, ey, em, ed].some((n) => !Number.isFinite(n)) || startIso > endIso) {
    return dates;
  }
  let y = sy;
  let m = sm;
  let d = sd;
  const endY = ey;
  const endM = em;
  const endD = ed;
  while (y < endY || (y === endY && m < endM) || (y === endY && m === endM && d <= endD)) {
    dates.push(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
    const t = new Date(Date.UTC(y, m - 1, d));
    t.setUTCDate(t.getUTCDate() + 1);
    y = t.getUTCFullYear();
    m = t.getUTCMonth() + 1;
    d = t.getUTCDate();
  }
  return dates;
}
