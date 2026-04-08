import type { SheetData } from "./types";

/**
 * Headers to exclude from both display and DB storage.
 * Includes UI-prepended columns (No., Alert, Details/Note) and columns
 * that are not needed for this platform (activity, phase, office).
 */
const EXCLUDED_HEADERS = new Set([
  "no.",
  "no",
  "alert",
  "note",
  "details",
  "activity",
  "phase",
  "office",
  "rate",
  "amount",
  "proj",
  "proj.",
  "proj.#",
  "proj#",
  "proj. #",
]);

export function stripExcludedColumns(sheet: SheetData): SheetData {
  const keepIdx = sheet.headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => !EXCLUDED_HEADERS.has(h.trim().toLowerCase()))
    .map(({ i }) => i);
  return {
    ...sheet,
    headers: keepIdx.map((i) => sheet.headers[i]),
    rows: sheet.rows.map((row) => keepIdx.map((i) => row[i] ?? "")),
  };
}
