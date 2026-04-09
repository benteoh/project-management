/**
 * Shared utilities for parsing rows from CSV / XLSX imports.
 *
 * These helpers are intentionally generic — they do not know about any
 * specific tab (timesheet, forecast, budget, etc.) and can be reused
 * whenever a new import surface is added.
 */

/**
 * Returns the index of the first header that matches any of the candidates
 * (case-insensitive, trimmed). Returns -1 if not found.
 */
export function findCol(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parses a raw date string into an ISO 8601 `YYYY-MM-DD` string.
 * Supports ISO, DD/MM/YYYY (UK), and MM-DD-YYYY (US) formats.
 * Returns null when the input is empty or unrecognisable.
 */
export function parseDate(raw: string): string | null {
  if (!raw.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return raw.trim().slice(0, 10);
  const dmy = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const mdy = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  const d = new Date(raw.trim());
  return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

/**
 * Parses a raw currency / numeric string (e.g. "£1,234.50") into a number.
 * Returns null when the input is empty or not a valid number.
 */
export function parseAmount(raw: string): number | null {
  const stripped = raw.replace(/[£$,\s]/g, "");
  const n = parseFloat(stripped);
  return isNaN(n) ? null : n;
}
