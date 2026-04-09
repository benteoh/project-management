import * as XLSX from "xlsx";

import type { SheetData } from "./types";

/**
 * Returns the display string for a single cell.
 *
 * Text cells (t === 's'): use the raw string — applying the format string again
 * causes "$$" for currency-formatted text cells. Number/date/boolean cells use
 * Excel's pre-formatted text (w) so display matches what Excel shows.
 */
function cellDisplay(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (cell.t === "s") return String(cell.v);
  if (cell.w !== undefined) return cell.w;
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v);
}

export function parseTimesheetWorkbook(file: File): Promise<SheetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array", cellText: true, cellDates: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const ref = sheet["!ref"];
        if (!ref) {
          resolve({ headers: [], rows: [], fileName: file.name });
          return;
        }
        const range = XLSX.utils.decode_range(ref);
        const grid: string[][] = [];
        for (let r = range.s.r; r <= range.e.r; r++) {
          const row: string[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            row.push(cellDisplay(sheet[XLSX.utils.encode_cell({ r, c })]));
          }
          grid.push(row);
        }
        const dataRows = grid.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
        resolve({ headers: grid[0] ?? [], rows: dataRows, fileName: file.name });
      } catch {
        reject(new Error("Could not parse file. Make sure it is a valid CSV or Excel file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}
