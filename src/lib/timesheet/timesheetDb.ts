import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TimesheetEntry,
  TimesheetEntryDbRow,
  TimesheetUpload,
  TimesheetUploadDbRow,
} from "@/types/timesheet";
import { findCol, parseDate } from "@/lib/xlsx/xlsxUtils";

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
  return {
    id: r.id,
    uploadId: r.upload_id,
    projectId: r.project_id,
    rowIndex: r.row_index,
    engineerId: r.engineer_id,
    engineerCode: r.engineer_code,
    entryDate: r.entry_date,
    hours: r.hours !== null ? Number(r.hours) : null,
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
 * Extracts and validates key fields (engineer_id, entry_date, hours) from
 * the provided headers/rows. Unrecognised engineers are stored with
 * engineer_id = null so the PM can review them later.
 */
export async function saveTimesheetUpload(
  client: SupabaseClient,
  projectId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
): Promise<{ ok: true; upload: TimesheetUpload } | { ok: false; error: string }> {
  // ---- Build engineer code → UUID map for validation --------------------
  const { data: engData, error: engErr } = await client.from("engineer_pool").select("id, code");
  if (engErr) return { ok: false, error: `engineer_pool: ${engErr.message}` };
  const codeToId = new Map<string, string>(
    (engData as { id: string; code: string }[]).map((e) => [e.code, e.id])
  );

  // ---- Detect key columns (case-insensitive) ----------------------------
  const codeIdx = findCol(headers, [
    "code",
    "engineer code",
    "employee code",
    "emp code",
    "engineer",
    "employee",
  ]);
  const dateIdx = findCol(headers, ["date", "work date", "entry date", "timesheet date"]);
  const hoursIdx = findCol(headers, ["hours", "hrs", "hours worked"]);

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
    project_id: projectId,
    row_index: -1,
    engineer_id: null,
    engineer_code: null,
    entry_date: null,
    hours: null,
    raw_data: { __dsp_column_order__: JSON.stringify(headers) },
  };

  // ---- Build entry rows -------------------------------------------------
  const entryRows = rows.map((row, rowIndex) => {
    const raw = (col: number) => (col >= 0 ? (row[col] ?? "") : "");

    const engineerCode = raw(codeIdx) || null;
    const engineerId = engineerCode ? (codeToId.get(engineerCode) ?? null) : null;
    const entryDate = dateIdx >= 0 ? parseDate(raw(dateIdx)) : null;
    const hoursRaw = parseFloat(raw(hoursIdx));
    const hours = hoursIdx >= 0 && !isNaN(hoursRaw) ? hoursRaw : null;

    const rawData: Record<string, string> = {};
    headers.forEach((h, i) => {
      rawData[h] = row[i] ?? "";
    });

    return {
      upload_id: upload.id,
      project_id: projectId,
      row_index: rowIndex,
      engineer_id: engineerId,
      engineer_code: engineerCode,
      entry_date: entryDate,
      hours: hours ?? null,
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
