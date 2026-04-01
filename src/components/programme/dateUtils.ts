// Date utilities for the programme tree.
// Dates are stored in dd-Mon-yy format (e.g. "06-Aug-25") to match
// the format used in DSP's existing Excel programmes.

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function parseProgrammeDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const mi = MONTH_NAMES.findIndex((m) => m.toLowerCase() === parts[1].toLowerCase());
  if (mi === -1 || isNaN(day)) return null;
  const yr = parseInt(parts[2], 10);
  return new Date(yr < 100 ? 2000 + yr : yr, mi, day);
}

export function formatProgrammeDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

export function atStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parses ISO `YYYY-MM-DD`, programme `dd-Mon-yy` via {@link parseProgrammeDate}, or `Date.parse` fallback.
 * Use {@link parseFlexibleActivityDateStartOfDay} when comparing calendar days (e.g. late vs today).
 */
export function parseFlexibleActivityDate(value: string): Date | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsedIso = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsedIso.getTime()) ? null : parsedIso;
  }

  const parsedProgramme = parseProgrammeDate(value);
  if (parsedProgramme && !Number.isNaN(parsedProgramme.getTime())) return parsedProgramme;

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parseFlexibleActivityDateStartOfDay(value: string): Date | null {
  const d = parseFlexibleActivityDate(value);
  return d ? atStartOfDay(d) : null;
}
