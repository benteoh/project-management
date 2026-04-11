import type { SheetData } from "./types";
import { normaliseHeaderForColMatch } from "@/lib/xlsx/xlsxUtils";

/**
 * Headers to strip from the timesheet grid only (synthetic / duplicate UI).
 * Do **not** list import columns (Proj. #, Activity, Phase, etc.) — they must * stay on `sheet.headers` so save + `raw_data` keep the full file.
 */
const EXCLUDED_HEADERS = new Set([
  normaliseHeaderForColMatch("No."),
  normaliseHeaderForColMatch("No"),
  normaliseHeaderForColMatch("Alert"),
  normaliseHeaderForColMatch("Note"),
  normaliseHeaderForColMatch("Details"),
]);

export function stripExcludedColumns(sheet: SheetData): SheetData {
  const keepIdx = sheet.headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => !EXCLUDED_HEADERS.has(normaliseHeaderForColMatch(h)))
    .map(({ i }) => i);
  return {
    ...sheet,
    headers: keepIdx.map((i) => sheet.headers[i]),
    rows: sheet.rows.map((row) => keepIdx.map((i) => row[i] ?? "")),
  };
}
