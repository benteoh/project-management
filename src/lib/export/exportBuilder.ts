import ExcelJS from "exceljs";

/**
 * Describes how to extract and display one column of data for a given row type T.
 * Used by both CSV and XLSX builders — define once, reuse for any export format.
 */
export interface ExportColumn<T> {
  header: string;
  /** Character width hint for XLSX column sizing. */
  width: number;
  getValue: (row: T) => string | number | null;
}

/**
 * A named sheet of typed rows with column definitions and an optional title bar.
 * Pass this to `buildCsv` or `buildXlsx` to produce the file.
 */
export interface ExportSheet<T> {
  /** Shown as a gold merged title bar in XLSX; omitted from CSV. */
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /**
   * Optional: rows where this returns true get bold text + light-grey fill in XLSX.
   * Useful for grouping rows (e.g. scope-level rows in the Programme export).
   */
  isHighlighted?: (row: T) => boolean;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvCell(value: string | number | null): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv<T>(sheet: ExportSheet<T>): string {
  const lines: string[] = [];
  lines.push(sheet.columns.map((c) => csvCell(c.header)).join(","));
  for (const row of sheet.rows) {
    lines.push(sheet.columns.map((c) => csvCell(c.getValue(row))).join(","));
  }
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

const GOLD_ARGB = "FFE4A824";
const HEADER_FILL_ARGB = "FFF4F4F5"; // zinc-100 — matches design system muted surface
const HIGHLIGHT_FILL_ARGB = "FFF4F4F5";

export async function buildXlsx<T>(sheet: ExportSheet<T>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Export");

  const colCount = sheet.columns.length;

  // Row 1: gold title bar merged across all columns
  ws.addRow([sheet.title]);
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { bold: true, size: 12, color: { argb: "FF000000" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD_ARGB } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 24;

  // Row 2: column headers — bold, light grey fill, frozen below
  ws.addRow(sheet.columns.map((c) => c.header));
  const headerRow = ws.getRow(2);
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL_ARGB } };
    cell.alignment = { vertical: "middle" };
  });
  headerRow.height = 20;

  // Freeze title + header rows
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

  // Set column widths from column definitions
  ws.columns = sheet.columns.map((c) => ({ width: c.width }));

  // Data rows
  for (const row of sheet.rows) {
    const values = sheet.columns.map((c) => c.getValue(row));
    const wsRow = ws.addRow(values);
    wsRow.height = 18;
    if (sheet.isHighlighted?.(row)) {
      wsRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true, size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIGHLIGHT_FILL_ARGB } };
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
