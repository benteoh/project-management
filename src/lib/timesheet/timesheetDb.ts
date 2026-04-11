import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TimesheetEntry,
  TimesheetEntryDbRow,
  TimesheetUpload,
  TimesheetUploadDbRow,
} from "@/types/timesheet";
import { findCol, findColRegex, parseDate } from "@/lib/xlsx/xlsxUtils";
import { resolveEngineerFromEmployeeCell } from "@/lib/timesheet/employeeCellMatch";
import {
  collectActivitiesUnderScope,
  findBestScopeId,
  matchActivityFromSpecifier,
  matchActivityIdInNotes,
  type ProgrammeNodeImportRow,
  resolveProjectFromProjCell,
} from "@/lib/timesheet/timesheetImportResolve";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMPORT_NAME_MIN_COVERAGE = 0.8;

function roundHoursOneDp(n: number): number {
  return Math.round(n * 10) / 10;
}

function optionalTrimmedText(raw: string): string | null {
  const t = raw.trim();
  return t || null;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToUpload(r: TimesheetUploadDbRow): TimesheetUpload {
  return {
    id: r.id,
    projectId: r.project_id,
    fileName: r.file_name,
    uploadedAt: r.uploaded_at,
    rowCount: r.row_count,
  };
}

function rowToEntry(r: TimesheetEntryDbRow): TimesheetEntry {
  const h = r.hours !== null ? Number(r.hours) : null;
  return {
    id: r.id,
    uploadId: r.upload_id,
    projectId: r.project_id,
    rowIndex: r.row_index,
    engineerId: r.engineer_id,
    entryDate: r.entry_date,
    hours: h !== null && !isNaN(h) ? roundHoursOneDp(h) : null,
    scopeId: r.scope_id ?? null,
    activityId: r.activity_id ?? null,
    notes: r.notes ?? null,
    rawData: r.raw_data ?? {},
  };
}

// ---------------------------------------------------------------------------
// Public DB functions
// ---------------------------------------------------------------------------

/** List all uploads for a project, newest first. */
export async function listTimesheetUploads(
  client: SupabaseClient,
  projectId: string
): Promise<{ uploads: TimesheetUpload[] } | { error: string }> {
  const { data, error } = await client
    .from("timesheet_uploads")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });
  if (error) return { error: error.message };
  return { uploads: (data as TimesheetUploadDbRow[]).map(rowToUpload) };
}

/**
 * Load all entries for a specific upload.
 *
 * Returns the ordered column headers separately from the data entries.
 * The sentinel row (row_index = -1) carries the original column order in
 * raw_data.__column_order__ and is excluded from the returned entries array.
 */
export async function getTimesheetEntries(
  client: SupabaseClient,
  uploadId: string
): Promise<{ entries: TimesheetEntry[]; headers: string[] } | { error: string }> {
  const { data, error } = await client
    .from("timesheet_entries")
    .select("*")
    .eq("upload_id", uploadId)
    .order("row_index", { ascending: true });
  if (error) return { error: error.message };

  const rows = data as TimesheetEntryDbRow[];
  const sentinel = rows.find((r) => r.row_index === -1);
  const dataRows = rows.filter((r) => r.row_index >= 0);

  let headers: string[] = [];
  if (sentinel?.raw_data.__dsp_column_order__) {
    try {
      headers = JSON.parse(sentinel.raw_data.__dsp_column_order__) as string[];
    } catch {
      // fall through to Object.keys fallback below
    }
  }
  if (headers.length === 0 && dataRows.length > 0) {
    headers = Object.keys(dataRows[0].raw_data);
  }

  return { entries: dataRows.map(rowToEntry), headers };
}

/**
 * Save a timesheet upload + all its rows.
 *
 * Import columns: Date, Hours, Employee (**display name**, not primary code), Proj. #, Task ID,
 * Activity, Notes. Scope requires resolved project; activity requires resolved scope.
 */
export async function saveTimesheetUpload(
  client: SupabaseClient,
  projectId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
): Promise<{ ok: true; upload: TimesheetUpload } | { ok: false; error: string }> {
  const [engRes, projRes, nodeRes] = await Promise.all([
    client.from("engineer_pool").select("id, code, first_name, last_name"),
    client.from("projects").select("id, name, project_code"),
    client.from("programme_nodes").select("id, project_id, parent_id, type, name, activity_id"),
  ]);
  if (engRes.error) return { ok: false, error: `engineer_pool: ${engRes.error.message}` };
  if (projRes.error) return { ok: false, error: `projects: ${projRes.error.message}` };
  if (nodeRes.error) return { ok: false, error: `programme_nodes: ${nodeRes.error.message}` };

  const engineerPool = engRes.data as {
    id: string;
    code: string;
    first_name: string;
    last_name: string;
  }[];
  const projects = projRes.data as { id: string; name: string; project_code: string | null }[];
  const programmeNodes = nodeRes.data as ProgrammeNodeImportRow[];

  const scopesByProject = new Map<string, { id: string; name: string }[]>();
  for (const n of programmeNodes) {
    if (n.type !== "scope") continue;
    if (!scopesByProject.has(n.project_id)) scopesByProject.set(n.project_id, []);
    scopesByProject.get(n.project_id)!.push({ id: n.id, name: n.name });
  }

  const activitiesUnderScopeCache = new Map<string, ProgrammeNodeImportRow[]>();
  function activitiesForScope(scopeId: string): ProgrammeNodeImportRow[] {
    if (!activitiesUnderScopeCache.has(scopeId)) {
      activitiesUnderScopeCache.set(scopeId, collectActivitiesUnderScope(scopeId, programmeNodes));
    }
    return activitiesUnderScopeCache.get(scopeId)!;
  }

  // ---- Detect key columns (case-insensitive) ----------------------------
  const dateIdx = findCol(headers, ["date", "work date", "entry date", "timesheet date"]);
  const hoursIdx = findCol(headers, ["hours", "hrs", "hours worked"]);
  const employeeIdx = findCol(headers, [
    "employee",
    "engineer",
    "employee code",
    "emp code",
    "engineer code",
    "code",
  ]);
  let projIdx = findCol(headers, [
    "proj. #",
    "proj #",
    "proj.#",
    "proj#",
    "project #",
    "project#",
    "project no",
    "project no.",
    "proj no",
    "proj no.",
    "project code",
    "project_code",
  ]);
  if (projIdx < 0) {
    projIdx = findColRegex(headers, [
      /^proj(ect)?\.?\s*#\s*$/,
      /^proj(ect)?\s+#\s*$/,
      /^project\s+#\s*$/,
    ]);
  }
  const taskIdx = findCol(headers, ["task id", "task_id", "taskid", "scope id", "scope"]);
  const activityColIdx = findCol(headers, [
    "activity",
    "activity code",
    "activity id",
    "activity_id",
    "activity no",
    "activity no.",
  ]);
  const notesIdx = findCol(headers, ["notes", "note", "description", "comments", "comment"]);

  // ---- Insert upload row ------------------------------------------------
  const { data: uploadData, error: uploadErr } = await client
    .from("timesheet_uploads")
    .insert({ project_id: projectId, file_name: fileName, row_count: rows.length })
    .select()
    .single();
  if (uploadErr) return { ok: false, error: `timesheet_uploads: ${uploadErr.message}` };
  const upload = rowToUpload(uploadData as TimesheetUploadDbRow);

  if (rows.length === 0) return { ok: true, upload };

  // ---- Sentinel row: preserves original column order across jsonb round-trips
  // jsonb normalises key order; storing headers as an ordered JSON string in a
  // dedicated sentinel row (row_index = -1) is the only reliable way to restore
  // the exact column sequence without a schema change.
  const sentinelRow = {
    upload_id: upload.id,
    project_id: null as string | null,
    row_index: -1,
    engineer_id: null,
    entry_date: null,
    hours: null,
    scope_id: null,
    activity_id: null,
    notes: null,
    raw_data: { __dsp_column_order__: JSON.stringify(headers) },
  };

  // ---- Build entry rows -------------------------------------------------
  const entryRows = rows.map((row, rowIndex) => {
    const raw = (col: number) => (col >= 0 ? (row[col] ?? "") : "");

    const { engineerId } =
      employeeIdx >= 0
        ? resolveEngineerFromEmployeeCell(raw(employeeIdx), engineerPool)
        : { engineerId: null };

    const entryDate = dateIdx >= 0 ? parseDate(raw(dateIdx)) : null;
    const hoursRaw = parseFloat(raw(hoursIdx));
    const hoursParsed = hoursIdx >= 0 && !isNaN(hoursRaw) ? roundHoursOneDp(hoursRaw) : null;

    const notesRaw = notesIdx >= 0 ? raw(notesIdx) : "";
    const notes = optionalTrimmedText(notesRaw);

    const statedProjectId =
      projIdx >= 0
        ? resolveProjectFromProjCell(raw(projIdx), projects, IMPORT_NAME_MIN_COVERAGE)
        : null;

    const scopesForProject = statedProjectId ? (scopesByProject.get(statedProjectId) ?? []) : [];

    const taskRaw = taskIdx >= 0 ? raw(taskIdx) : "";
    const scopeId =
      statedProjectId && taskIdx >= 0
        ? findBestScopeId(taskRaw, scopesForProject, IMPORT_NAME_MIN_COVERAGE)
        : null;

    let activityId: string | null = null;
    const actRaw = activityColIdx >= 0 ? raw(activityColIdx) : "";
    if (scopeId) {
      const acts = activitiesForScope(scopeId);
      if (activityColIdx >= 0) {
        const actCell = optionalTrimmedText(actRaw);
        if (actCell) {
          activityId = matchActivityFromSpecifier(actCell, acts, IMPORT_NAME_MIN_COVERAGE);
        }
      }
      if (!activityId && notesRaw.trim()) {
        activityId = matchActivityIdInNotes(notesRaw, acts);
      }
    }

    const rawData: Record<string, string> = {};
    headers.forEach((h, i) => {
      rawData[h] = row[i] ?? "";
    });

    return {
      upload_id: upload.id,
      project_id: statedProjectId,
      row_index: rowIndex,
      engineer_id: engineerId,
      entry_date: entryDate,
      hours: hoursParsed,
      scope_id: scopeId,
      activity_id: activityId,
      notes,
      raw_data: rawData,
    };
  });

  const { error: entriesErr } = await client
    .from("timesheet_entries")
    .insert([sentinelRow, ...entryRows]);
  if (entriesErr) {
    // Roll back the upload row to keep data consistent. Log if the rollback
    // itself fails so the orphaned row is at least visible in server logs.
    const { error: rollbackErr } = await client
      .from("timesheet_uploads")
      .delete()
      .eq("id", upload.id);
    if (rollbackErr) {
      console.error(`timesheet rollback failed for upload ${upload.id}: ${rollbackErr.message}`);
    }
    return { ok: false, error: `timesheet_entries: ${entriesErr.message}` };
  }

  return { ok: true, upload };
}

/** Delete an upload and all its entries (CASCADE handles entries). */
export async function deleteTimesheetUpload(
  client: SupabaseClient,
  uploadId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client.from("timesheet_uploads").delete().eq("id", uploadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
