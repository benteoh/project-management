"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Trash2, Upload } from "lucide-react";

import {
  deleteTimesheetUploadAction,
  getTimesheetEntriesAction,
  listTimesheetUploadsAction,
  saveTimesheetUploadAction,
} from "@/app/projects/[id]/actions";
import type { TimesheetUpload } from "@/types/timesheet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SheetData = {
  headers: string[];
  rows: string[][];
  fileName: string;
};

/** null = new upload not yet saved; TimesheetUpload = viewing a saved upload */
type ViewingUpload = TimesheetUpload | null;

type SaveState = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Excel parsing
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUploadedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Saved uploads list
// ---------------------------------------------------------------------------

function SavedUploadsList({
  uploads,
  onView,
  onDelete,
}: {
  uploads: TimesheetUpload[];
  onView: (upload: TimesheetUpload) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await deleteTimesheetUploadAction(id);
    if (res.ok) onDelete(id);
    setDeletingId(null);
  }

  async function handleView(upload: TimesheetUpload) {
    setLoadingId(upload.id);
    await onView(upload);
    setLoadingId(null);
  }

  if (uploads.length === 0) return null;

  return (
    <div className="mt-6 w-full max-w-lg">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Saved timesheets
      </p>
      <ul className="border-border divide-border divide-y rounded-lg border">
        {uploads.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">{u.fileName}</p>
              <p className="text-muted-foreground text-xs">
                {u.rowCount} rows · {formatUploadedAt(u.uploadedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleView(u)}
                disabled={loadingId === u.id}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline disabled:opacity-40"
              >
                {loadingId === u.id ? "Loading…" : "View"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(u.id)}
                disabled={deletingId === u.id}
                className="text-muted-foreground hover:text-status-critical shrink-0 transition-colors disabled:opacity-40"
                aria-label="Delete upload"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data table (shared by new upload and saved view)
// ---------------------------------------------------------------------------

function TimesheetTable({ sheet }: { sheet: SheetData }) {
  const hoursIdx = sheet.headers.findIndex((h) => h.trim().toLowerCase() === "hours");
  return (
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
            Details
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
        {sheet.rows.map((row, ri) => {
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
                {exceeded ? "Hours exceed 8" : ""}
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
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TimesheetTab({
  projectId,
  initialUploads,
}: {
  projectId: string;
  initialUploads: TimesheetUpload[];
}) {
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [viewingUpload, setViewingUpload] = useState<ViewingUpload>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<TimesheetUpload[]>(initialUploads);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- File upload --------------------------------------------------------

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setParseError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setParseError(null);
    setSaveState("idle");
    setSaveError(null);
    setViewingUpload(null);
    setLoading(true);
    try {
      const parsed = await parseWorkbook(file);
      // Strip columns only if the CSV itself has headers matching the UI-generated
      // display columns (No., Alert, Details/Note). These are prepended by
      // TimesheetTable and must never be stored in the DB. Real CSVs won't have
      // these names, so nothing is stripped for a normal upload.
      const DISPLAY_ONLY = new Set(["no.", "no", "alert", "note", "details"]);
      const keepIdx = parsed.headers
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => !DISPLAY_ONLY.has(h.trim().toLowerCase()))
        .map(({ i }) => i);
      setSheet({
        ...parsed,
        headers: keepIdx.map((i) => parsed.headers[i]),
        rows: parsed.rows.map((row) => keepIdx.map((i) => row[i] ?? "")),
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  }

  // ---- Save ---------------------------------------------------------------

  async function handleSave() {
    if (!sheet) return;
    setSaveState("saving");
    setSaveError(null);
    const res = await saveTimesheetUploadAction(
      projectId,
      sheet.fileName,
      sheet.headers,
      sheet.rows
    );
    if (res.ok) {
      setSaveState("saved");
      setViewingUpload(res.upload);
      setUploads((prev) => [res.upload, ...prev]);
    } else {
      setSaveState("error");
      setSaveError(res.error);
    }
  }

  // ---- View saved ---------------------------------------------------------

  async function handleViewSaved(upload: TimesheetUpload) {
    setLoadError(null);
    const res = await getTimesheetEntriesAction(upload.id);
    if ("error" in res) {
      setLoadError(res.error);
      return;
    }
    const { entries, headers } = res;
    if (entries.length === 0) {
      setSheet({ headers: [], rows: [], fileName: upload.fileName });
      setViewingUpload(upload);
      return;
    }
    // headers come from the sentinel row (row_index = -1) which stores the
    // original column sequence; this survives jsonb key-order normalisation.
    const rows = entries.map((e) => headers.map((h) => e.rawData[h] ?? ""));
    setSheet({ headers, rows, fileName: upload.fileName });
    setViewingUpload(upload);
    setSaveState("saved");
  }

  // ---- Delete -------------------------------------------------------------

  async function handleDeleteUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
    const res = await listTimesheetUploadsAction(projectId);
    if ("uploads" in res) setUploads(res.uploads);
  }

  // ---- Close table view ---------------------------------------------------

  function handleClose() {
    setSheet(null);
    setViewingUpload(null);
    setParseError(null);
    setSaveState("idle");
    setSaveError(null);
    setLoadError(null);
  }

  // ---- Render: empty state ------------------------------------------------

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
        {parseError && <p className="text-status-critical text-sm">{parseError}</p>}
        {loadError && <p className="text-status-critical text-sm">{loadError}</p>}
        <SavedUploadsList
          uploads={uploads}
          onView={handleViewSaved}
          onDelete={handleDeleteUpload}
        />
      </div>
    );
  }

  // ---- Render: table view (new upload or saved) ---------------------------

  const isSaved = saveState === "saved" || viewingUpload !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-muted-foreground truncate text-xs">
            {sheet.fileName} — {sheet.rows.length} rows
          </p>
          {isSaved && (
            <span className="text-status-healthy shrink-0 text-xs font-medium">· Saved</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {saveState === "error" && saveError && (
            <p className="text-status-critical text-xs">{saveError}</p>
          )}
          {!isSaved && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="bg-gold text-foreground rounded-md px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save to project"}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
          >
            {isSaved ? "Back to list" : "Upload different file"}
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <TimesheetTable sheet={sheet} />
      </div>
    </div>
  );
}
