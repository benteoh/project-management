/**
 * Shared utilities for parsing rows from CSV / XLSX imports.
 *
 * These helpers are intentionally generic — they do not know about any
 * specific tab (timesheet, forecast, budget, etc.) and can be reused
 * whenever a new import surface is added.
 */

/**
 * Normalise a header label for column matching: BOM, unicode spaces, fullwidth `#` / `.`,
 * collapse runs of whitespace, lowercase.
 */
export function normaliseHeaderForColMatch(s: string): string {
  return s
    .replace(/^\uFEFF|\uFEFF$/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/\u200B|\u200C|\u200D/g, "")
    .replace(/\uFF03/g, "#")
    .replace(/\uFF0E/g, ".")
    .trim()
    .toLowerCase()
    .replace(/\.#/g, ". #")
    .replace(/\s+/g, " ");
}

/**
 * Returns the index of the first header that matches any of the candidates
 * (case-insensitive, trimmed, whitespace-collapsed). Returns -1 if not found.
 */
export function findCol(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => normaliseHeaderForColMatch(h));
  for (const c of candidates) {
    const cand = normaliseHeaderForColMatch(c);
    const idx = norm.indexOf(cand);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * First header index matching any regex (against {@link normaliseHeaderForColMatch} output).
 */
export function findColRegex(headers: string[], patterns: RegExp[]): number {
  const norm = headers.map((h) => normaliseHeaderForColMatch(h));
  for (let i = 0; i < norm.length; i++) {
    const h = norm[i];
    for (const re of patterns) {
      if (re.test(h)) return i;
    }
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
