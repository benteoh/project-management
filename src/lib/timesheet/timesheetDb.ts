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
  normalise,
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

type TimesheetImportEngineerPoolRow = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
};

type TimesheetImportResolutionContext = {
  engineerPool: TimesheetImportEngineerPoolRow[];
  projects: { id: string; name: string; project_code: string | null }[];
  programmeNodes: ProgrammeNodeImportRow[];
  importScopeMapping: Map<string, string>;
  scopesByProject: Map<string, { id: string; name: string }[]>;
};

type TimesheetImportColumnIndices = {
  dateIdx: number;
  hoursIdx: number;
  employeeIdx: number;
  projIdx: number;
  taskIdx: number;
  activityColIdx: number;
  notesIdx: number;
};

type ResolvedTimesheetRowFields = {
  project_id: string | null;
  engineer_id: string | null;
  entry_date: string | null;
  hours: number | null;
  scope_id: string | null;
  activity_id: string | null;
  notes: string | null;
};

async function loadTimesheetImportResolutionContext(
  client: SupabaseClient,
  projectId: string
): Promise<{ ok: true; ctx: TimesheetImportResolutionContext } | { ok: false; error: string }> {
  const [engRes, projRes, nodeRes, mappingRes] = await Promise.all([
    client.from("engineer_pool").select("id, code, first_name, last_name"),
    client.from("projects").select("id, name, project_code"),
    client.from("programme_nodes").select("id, project_id, parent_id, type, name, activity_id"),
    client
      .from("timesheet_scope_mappings")
      .select("raw_text, scope_id")
      .eq("project_id", projectId),
  ]);
  if (engRes.error) return { ok: false, error: `engineer_pool: ${engRes.error.message}` };
  if (projRes.error) return { ok: false, error: `projects: ${projRes.error.message}` };
  if (nodeRes.error) return { ok: false, error: `programme_nodes: ${nodeRes.error.message}` };

  const engineerPool = engRes.data as TimesheetImportEngineerPoolRow[];
  const projects = projRes.data as { id: string; name: string; project_code: string | null }[];
  const programmeNodes = nodeRes.data as ProgrammeNodeImportRow[];

  const importScopeMapping = new Map<string, string>();
  if (!mappingRes.error) {
    for (const row of mappingRes.data as { raw_text: string; scope_id: string }[]) {
      importScopeMapping.set(normalise(row.raw_text), row.scope_id);
    }
  }

  const scopesByProject = new Map<string, { id: string; name: string }[]>();
  for (const n of programmeNodes) {
    if (n.type !== "scope") continue;
    if (!scopesByProject.has(n.project_id)) scopesByProject.set(n.project_id, []);
    scopesByProject.get(n.project_id)!.push({ id: n.id, name: n.name });
  }

  return {
    ok: true,
    ctx: { engineerPool, projects, programmeNodes, importScopeMapping, scopesByProject },
  };
}

function getTimesheetImportColumnIndices(headers: string[]): TimesheetImportColumnIndices {
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
  return {
    dateIdx,
    hoursIdx,
    employeeIdx,
    projIdx,
    taskIdx,
    activityColIdx,
    notesIdx,
  };
}

function makeActivitiesForScopeLookup(programmeNodes: ProgrammeNodeImportRow[]) {
  const activitiesUnderScopeCache = new Map<string, ProgrammeNodeImportRow[]>();
  return function activitiesForScope(scopeId: string): ProgrammeNodeImportRow[] {
    if (!activitiesUnderScopeCache.has(scopeId)) {
      activitiesUnderScopeCache.set(scopeId, collectActivitiesUnderScope(scopeId, programmeNodes));
    }
    return activitiesUnderScopeCache.get(scopeId)!;
  };
}

function resolveTimesheetRowFields(
  headers: string[],
  row: string[],
  indices: TimesheetImportColumnIndices,
  ctx: TimesheetImportResolutionContext,
  activitiesForScope: (scopeId: string) => ProgrammeNodeImportRow[]
): ResolvedTimesheetRowFields {
  const { dateIdx, hoursIdx, employeeIdx, projIdx, taskIdx, activityColIdx, notesIdx } = indices;
  const raw = (col: number) => (col >= 0 ? (row[col] ?? "") : "");

  const { engineerId } =
    employeeIdx >= 0
      ? resolveEngineerFromEmployeeCell(raw(employeeIdx), ctx.engineerPool)
      : { engineerId: null };

  const entryDate = dateIdx >= 0 ? parseDate(raw(dateIdx)) : null;
  const hoursRaw = parseFloat(raw(hoursIdx));
  const hoursParsed = hoursIdx >= 0 && !isNaN(hoursRaw) ? roundHoursOneDp(hoursRaw) : null;

  const notesRaw = notesIdx >= 0 ? raw(notesIdx) : "";
  const notes = optionalTrimmedText(notesRaw);

  const statedProjectId =
    projIdx >= 0
      ? resolveProjectFromProjCell(raw(projIdx), ctx.projects, IMPORT_NAME_MIN_COVERAGE)
      : null;

  const scopesForProject = statedProjectId ? (ctx.scopesByProject.get(statedProjectId) ?? []) : [];

  const taskRaw = taskIdx >= 0 ? raw(taskIdx) : "";
  const mappedScopeId = taskRaw.trim()
    ? (ctx.importScopeMapping.get(normalise(taskRaw.trim())) ?? null)
    : null;
  const scopeId =
    mappedScopeId ??
    (statedProjectId && taskIdx >= 0
      ? findBestScopeId(taskRaw, scopesForProject, IMPORT_NAME_MIN_COVERAGE)
      : null);

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

  return {
    project_id: statedProjectId,
    engineer_id: engineerId,
    entry_date: entryDate,
    hours: hoursParsed,
    scope_id: scopeId,
    activity_id: activityId,
    notes,
  };
}

function buildRawDataRecord(headers: string[], row: string[]): Record<string, string> {
  const rawData: Record<string, string> = {};
  headers.forEach((h, i) => {
    rawData[h] = row[i] ?? "";
  });
  return rawData;
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
  const loaded = await loadTimesheetImportResolutionContext(client, projectId);
  if (!loaded.ok) return loaded;

  const { ctx } = loaded;
  const indices = getTimesheetImportColumnIndices(headers);
  const activitiesForScope = makeActivitiesForScopeLookup(ctx.programmeNodes);

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
    const resolved = resolveTimesheetRowFields(headers, row, indices, ctx, activitiesForScope);
    return {
      upload_id: upload.id,
      project_id: resolved.project_id,
      row_index: rowIndex,
      engineer_id: resolved.engineer_id,
      entry_date: resolved.entry_date,
      hours: resolved.hours,
      scope_id: resolved.scope_id,
      activity_id: resolved.activity_id,
      notes: resolved.notes,
      raw_data: buildRawDataRecord(headers, row),
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

const RELINK_UPDATE_CHUNK = 40;

/**
 * Re-run engineer / project / scope / activity resolution for every data row in an upload,
 * using each row's stored `raw_data` and the current programme tree, engineer pool, and
 * scope mappings. Does not modify `raw_data` or the sentinel row.
 */
export async function relinkTimesheetUpload(
  client: SupabaseClient,
  projectId: string,
  uploadId: string
): Promise<{ ok: true; updatedCount: number } | { ok: false; error: string }> {
  const { data: uploadMeta, error: uploadErr } = await client
    .from("timesheet_uploads")
    .select("project_id")
    .eq("id", uploadId)
    .maybeSingle();
  if (uploadErr) return { ok: false, error: uploadErr.message };
  if (!uploadMeta) return { ok: false, error: "Upload not found" };
  if (uploadMeta.project_id !== projectId) {
    return { ok: false, error: "Upload does not belong to this project" };
  }

  const loaded = await loadTimesheetImportResolutionContext(client, projectId);
  if (!loaded.ok) return loaded;

  const entriesResult = await getTimesheetEntries(client, uploadId);
  if ("error" in entriesResult) return { ok: false, error: entriesResult.error };

  const { entries, headers } = entriesResult;
  if (entries.length === 0 || headers.length === 0) {
    return { ok: true, updatedCount: 0 };
  }

  const indices = getTimesheetImportColumnIndices(headers);
  const activitiesForScope = makeActivitiesForScopeLookup(loaded.ctx.programmeNodes);

  const updates = entries.map((entry) => {
    const cells = headers.map((h) => entry.rawData[h] ?? "");
    const resolved = resolveTimesheetRowFields(
      headers,
      cells,
      indices,
      loaded.ctx,
      activitiesForScope
    );
    return {
      id: entry.id,
      patch: {
        project_id: resolved.project_id,
        engineer_id: resolved.engineer_id,
        entry_date: resolved.entry_date,
        hours: resolved.hours,
        scope_id: resolved.scope_id,
        activity_id: resolved.activity_id,
        notes: resolved.notes,
      },
    };
  });

  for (let i = 0; i < updates.length; i += RELINK_UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + RELINK_UPDATE_CHUNK);
    const results = await Promise.all(
      chunk.map(({ id, patch }) => client.from("timesheet_entries").update(patch).eq("id", id))
    );
    for (const r of results) {
      if (r.error) return { ok: false, error: r.error.message };
    }
  }

  return { ok: true, updatedCount: updates.length };
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
