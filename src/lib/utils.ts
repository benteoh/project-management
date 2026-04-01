import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// UK Bank Holidays (England & Wales)
// ---------------------------------------------------------------------------

function isoDateLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function firstMondayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  const dow = d.getDay();
  const offset = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  return new Date(year, month, 1 + offset);
}

function lastMondayOfMonth(year: number, month: number): Date {
  const last = new Date(year, month + 1, 0);
  const dow = last.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  return new Date(year, month, last.getDate() - offset);
}

function substituteWeekend(date: Date): Date {
  const dow = date.getDay();
  if (dow === 6) return addDays(date, 2); // Sat -> Mon
  if (dow === 0) return addDays(date, 1); // Sun -> Mon (or Tue for Boxing Day)
  return date;
}

/**
 * Returns a Set of ISO date strings (YYYY-MM-DD) for England & Wales bank
 * holidays in the given year.
 */
export function getUKBankHolidays(year: number): Set<string> {
  const dates: Date[] = [];

  // New Year's Day
  dates.push(substituteWeekend(new Date(year, 0, 1)));

  // Good Friday & Easter Monday
  const easter = easterSunday(year);
  dates.push(addDays(easter, -2)); // Good Friday
  dates.push(addDays(easter, 1)); // Easter Monday

  // Early May Bank Holiday (first Monday in May)
  dates.push(firstMondayOfMonth(year, 4));

  // Spring Bank Holiday (last Monday in May)
  dates.push(lastMondayOfMonth(year, 4));

  // Summer Bank Holiday (last Monday in August)
  dates.push(lastMondayOfMonth(year, 7));

  // Christmas & Boxing Day substitution rules
  const christmas = new Date(year, 11, 25);
  const christmasDow = christmas.getDay();
  if (christmasDow === 6) {
    // Sat: Christmas -> Mon 27, Boxing -> Tue 28
    dates.push(new Date(year, 11, 27));
    dates.push(new Date(year, 11, 28));
  } else if (christmasDow === 0) {
    // Sun: Boxing -> Mon 26, Christmas -> Tue 27
    dates.push(new Date(year, 11, 26));
    dates.push(new Date(year, 11, 27));
  } else {
    dates.push(christmas);
    dates.push(new Date(year, 11, 26));
  }

  return new Set(dates.map(isoDateLocal));
}

export function formatCurrency(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}
