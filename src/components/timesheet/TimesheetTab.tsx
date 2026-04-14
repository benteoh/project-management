"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Upload } from "lucide-react";

import {
  getTimesheetEntriesAction,
  getScopeMappingsAction,
  listTimesheetUploadsAction,
  relinkTimesheetUploadAction,
  saveTimesheetUploadAction,
  upsertScopeMappingAction,
} from "@/app/[office]/project/[id]/actions";
import { normalise } from "@/lib/timesheet/timesheetImportResolve";
import { cn } from "@/lib/utils";
import type { TimesheetUpload } from "@/types/timesheet";

import { ActualsVsPlanned } from "./ActualsVsPlanned";
import { SavedUploadsList } from "./SavedUploadsList";
import { TimesheetTable } from "./TimesheetTable";
import type { SaveState, SheetData, TimesheetTabProps, ViewingUpload } from "./types";
import { parseTimesheetWorkbook } from "./timesheetWorkbook";
import { stripExcludedColumns } from "./timesheetSheetNormalize";

type Subtab = "entries" | "actuals";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function TimesheetTab({
  projectId,
  initialUploads,
  engineerPool,
  scopeNames,
  project,
  programmeTree,
}: TimesheetTabProps) {
  const [subtab, setSubtab] = useState<Subtab>("entries");
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [viewingUpload, setViewingUpload] = useState<ViewingUpload>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<TimesheetUpload[]>(initialUploads);
  const [scopeMappings, setScopeMappings] = useState<Map<string, string>>(new Map());
  const [relinkState, setRelinkState] = useState<"idle" | "working" | "error">("idle");
  const [relinkError, setRelinkError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getScopeMappingsAction(projectId).then((res) => {
      if ("mappings" in res) {
        setScopeMappings(new Map(res.mappings.map((m) => [normalise(m.rawText), m.scopeId])));
      }
    });
  }, [projectId]);

  async function handleAddMapping(rawText: string, scopeId: string) {
    const res = await upsertScopeMappingAction(projectId, rawText, scopeId);
    if (res.ok) {
      setScopeMappings((prev) => new Map([...prev, [normalise(rawText), scopeId]]));
    }
  }

  // On mount: if there are saved uploads, restore the most recent one automatically
  // so a page refresh doesn't lose the view.
  useEffect(() => {
    if (initialUploads.length > 0) {
      handleViewSaved(initialUploads[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setParseError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setParseError(null);
    setSaveState("idle");
    setSaveError(null);
    setViewingUpload(null);
    setRelinkState("idle");
    setRelinkError(null);
    setLoading(true);
    try {
      const parsed = await parseTimesheetWorkbook(file);
      setSheet(stripExcludedColumns(parsed));
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

  async function handleRelinkFromRaw() {
    if (!viewingUpload) return;
    setRelinkState("working");
    setRelinkError(null);
    const res = await relinkTimesheetUploadAction(projectId, viewingUpload.id);
    if (res.ok) {
      setRelinkState("idle");
      await handleViewSaved(viewingUpload);
    } else {
      setRelinkState("error");
      setRelinkError(res.error);
    }
  }

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
    setSheet(stripExcludedColumns({ headers, rows, fileName: upload.fileName }));
    setViewingUpload(upload);
    setSaveState("saved");
  }

  async function handleDeleteUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
    const res = await listTimesheetUploadsAction(projectId);
    if ("uploads" in res) setUploads(res.uploads);
  }

  function handleClose() {
    setSheet(null);
    setViewingUpload(null);
    setParseError(null);
    setSaveState("idle");
    setSaveError(null);
    setLoadError(null);
    setRelinkState("idle");
    setRelinkError(null);
  }

  const isSaved = saveState === "saved" || viewingUpload !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Persistent subtab bar — Actuals vs Planned: re-enable with `true &&` where `false &&` appears below */}
      <div className="border-border flex shrink-0 items-center gap-1 border-b px-4 py-2">
        <button
          type="button"
          onClick={() => setSubtab("entries")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            subtab === "entries"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Entries
        </button>
        {false && (
          <button
            type="button"
            onClick={() => setSubtab("actuals")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              subtab === "actuals"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Actuals vs Planned
          </button>
        )}
      </div>

      {false && subtab === "actuals" ? (
        <div className="flex-1 overflow-auto">
          <ActualsVsPlanned
            projectId={projectId}
            programmeTree={programmeTree}
            engineerPool={engineerPool}
          />
        </div>
      ) : !sheet ? (
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
      ) : (
        <>
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
              {relinkState === "error" && relinkError && (
                <p className="text-status-critical text-xs">{relinkError}</p>
              )}
              {saveState === "error" && saveError && (
                <p className="text-status-critical text-xs">{saveError}</p>
              )}
              {isSaved && viewingUpload && sheet.rows.length > 0 && (
                <button
                  type="button"
                  onClick={handleRelinkFromRaw}
                  disabled={relinkState === "working"}
                  title="Re-resolve engineers, scopes, and activities from raw columns using the current programme and mappings"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 shrink-0 ${relinkState === "working" ? "animate-spin" : ""}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {relinkState === "working" ? "Relinking…" : "Relink from raw data"}
                </button>
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TimesheetTable
              sheet={sheet}
              engineerPool={engineerPool}
              scopeNames={scopeNames}
              project={project}
              programmeTree={programmeTree}
              scopeMappings={scopeMappings}
              onAddMapping={handleAddMapping}
            />
          </div>
        </>
      )}
    </div>
  );
}
