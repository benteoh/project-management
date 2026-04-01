"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Upload } from "lucide-react";

type SheetData = {
  headers: string[];
  rows: string[][];
  fileName: string;
};

/**
 * Returns the display string for a single cell.
 *
 * Using `raw: false` with sheet_to_json applies the Excel format string to every
 * cell, including text cells. If a text cell already contains "$50" and the
 * column has a currency format, SheetJS produces "$$50". We avoid this by
 * reading cell objects directly:
 *   - Text cells (t === 's'): return the raw string value — never re-format.
 *   - Number/date/boolean cells: return the Excel-formatted text (w) so the
 *     display matches exactly what Excel shows (e.g. "$50.00", "01/04/2026").
 */
function cellDisplay(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  // Text cells: use the raw string — applying the format string again causes "$$"
  if (cell.t === "s") return String(cell.v);
  // Everything else: use Excel's pre-formatted text when available
  if (cell.w !== undefined) return cell.w;
  // Fallback: convert the raw value to a string
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v);
}

function parseWorkbook(file: File): Promise<SheetData> {
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
            const addr = XLSX.utils.encode_cell({ r, c });
            row.push(cellDisplay(sheet[addr]));
          }
          grid.push(row);
        }

        const headers = grid[0] ?? [];
        const rows = grid.slice(1);

        resolve({ headers, rows, fileName: file.name });
      } catch {
        reject(new Error("Could not parse file. Make sure it is a valid CSV or Excel file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

export function TimesheetTab() {
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const parsed = await parseWorkbook(file);
      setSheet(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0]);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  }

  if (!sheet) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="border-border text-foreground hover:border-gold hover:text-gold flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-12 py-10 transition-colors"
        >
          <Upload className="h-8 w-8" strokeWidth={1.5} />
          <span className="text-sm font-medium">Upload timesheet</span>
          <span className="text-muted-foreground text-xs">CSV or Excel (.xlsx, .xls)</span>
        </button>
        {loading && <p className="text-muted-foreground text-sm">Parsing file…</p>}
        {error && <p className="text-status-critical text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
        <p className="text-muted-foreground text-xs">
          {sheet.fileName} — {sheet.rows.length} rows
        </p>
        <button
          type="button"
          onClick={() => {
            setSheet(null);
            setError(null);
          }}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
        >
          Upload different file
        </button>
      </div>

      {/* Scrollable table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-border w-max border-collapse text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr>
              <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right text-xs font-medium tracking-wide whitespace-nowrap uppercase select-none">
                No.
              </th>
              <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase">
                Alert
              </th>
              <th className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase">
                Note
              </th>
              {sheet.headers.map((h, i) => (
                <th
                  key={i}
                  className="border-border text-muted-foreground border-r border-b px-4 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap uppercase"
                >
                  {h || <span className="text-muted-foreground/40">—</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const hoursIdx = sheet.headers.findIndex((h) => h.trim().toLowerCase() === "hours");
              return sheet.rows.map((row, ri) => {
                const hoursVal = hoursIdx >= 0 ? parseFloat(row[hoursIdx] ?? "") : NaN;
                const exceeded = !isNaN(hoursVal) && hoursVal > 8;
                return (
                  <tr key={ri} className="hover:bg-background">
                    <td className="border-border text-muted-foreground border-r border-b px-4 py-2 text-right whitespace-nowrap tabular-nums select-none">
                      {ri + 1}
                    </td>
                    <td className="border-border text-status-critical border-r border-b px-4 py-2 font-medium whitespace-nowrap">
                      {exceeded ? "1" : ""}
                    </td>
                    <td className="border-border text-muted-foreground border-r border-b px-4 py-2 whitespace-nowrap">
                      {exceeded ? ">8" : ""}
                    </td>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border-border text-foreground border-r border-b px-4 py-2 whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
