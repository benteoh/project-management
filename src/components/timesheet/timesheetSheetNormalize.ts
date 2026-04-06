import type { SheetData } from "./types";

/**
 * Headers that match UI-prepended columns (No., Alert, Details/Note) on export.
 * Real uploads should not use these; if they do, we drop them so DB rows stay clean.
 */
const DISPLAY_ONLY_HEADERS = new Set(["no.", "no", "alert", "note", "details"]);

export function stripUiMirrorColumns(sheet: SheetData): SheetData {
  const keepIdx = sheet.headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => !DISPLAY_ONLY_HEADERS.has(h.trim().toLowerCase()))
    .map(({ i }) => i);
  return {
    ...sheet,
    headers: keepIdx.map((i) => sheet.headers[i]),
    rows: sheet.rows.map((row) => keepIdx.map((i) => row[i] ?? "")),
  };
}
