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

export function toISODate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
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

export function generateDailyDates(startIso: string, endIso: string): Date[] {
  const dates: Date[] = [];
  const current = new Date(startIso);
  const end = new Date(endIso);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
