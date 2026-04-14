import type { SupabaseClient } from "@supabase/supabase-js";

import type { TimesheetAllocationRow } from "@/types/allocations";

import { TIMESHEET_ENTRIES_LOAD_PAGE_SIZE } from "./timesheetDb";

export interface TimesheetActualEntry {
  engineerId: string | null;
  scopeId: string | null;
  hours: number | null;
}

/** Timesheet row fields needed for CVR £ roll-up by month (includes {@link TimesheetActualEntry}). */
export interface TimesheetCvrEntry extends TimesheetActualEntry {
  /** ISO `YYYY-MM-DD` from `timesheet_entries.entry_date`, or null when missing. */
  entryDate: string | null;
}

/**
 * All saved rows for the given uploads (`row_index >= 0`), ordered by `id` for stable paging.
 */
async function fetchAllTimesheetEntriesForUploads(
  client: SupabaseClient,
  uploadIds: string[],
  selectColumns: string
): Promise<{ rows: unknown[] } | { error: string }> {
  if (uploadIds.length === 0) return { rows: [] };

  const rows: unknown[] = [];
  let rangeStart = 0;
  for (;;) {
    const rangeEnd = rangeStart + TIMESHEET_ENTRIES_LOAD_PAGE_SIZE - 1;
    const { data, error } = await client
      .from("timesheet_entries")
      .select(selectColumns)
      .in("upload_id", uploadIds)
      .gte("row_index", 0)
      .order("id", { ascending: true })
      .range(rangeStart, rangeEnd);

    if (error) return { error: error.message };
    const batch = data ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < TIMESHEET_ENTRIES_LOAD_PAGE_SIZE) break;
    rangeStart += TIMESHEET_ENTRIES_LOAD_PAGE_SIZE;
  }
  return { rows };
}

/**
 * Returns all saved timesheet entry rows for a project across every upload,
 * selecting only the fields needed for actuals aggregation.
 * Sentinel rows (row_index = -1) are excluded.
 */
export async function getTimesheetActualsForProject(
  client: SupabaseClient,
  projectId: string
): Promise<{ rows: TimesheetActualEntry[] } | { error: string }> {
  const { data: uploads, error: uploadsErr } = await client
    .from("timesheet_uploads")
    .select("id")
    .eq("project_id", projectId);
  if (uploadsErr) return { error: uploadsErr.message };

  const ids = (uploads as { id: string }[]).map((u) => u.id);
  if (ids.length === 0) return { rows: [] };

  const fetched = await fetchAllTimesheetEntriesForUploads(
    client,
    ids,
    "engineer_id, scope_id, hours"
  );
  if ("error" in fetched) return { error: fetched.error };
  const data = fetched.rows;

  return {
    rows: (
      data as { engineer_id: string | null; scope_id: string | null; hours: number | null }[]
    ).map((r) => ({
      engineerId: r.engineer_id,
      scopeId: r.scope_id,
      hours: r.hours !== null ? Number(r.hours) : null,
    })),
  };
}

function roundHoursOneDp(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * All saved timesheet rows for a project (every upload) with scope, activity, and engineer for the Allocations tab.
 */
export async function getTimesheetAllocationRowsForProject(
  client: SupabaseClient,
  projectId: string
): Promise<{ rows: TimesheetAllocationRow[] } | { error: string }> {
  const { data: uploads, error: uploadsErr } = await client
    .from("timesheet_uploads")
    .select("id")
    .eq("project_id", projectId);
  if (uploadsErr) return { error: uploadsErr.message };

  const ids = (uploads as { id: string }[]).map((u) => u.id);
  if (ids.length === 0) return { rows: [] };

  const fetched = await fetchAllTimesheetEntriesForUploads(
    client,
    ids,
    "engineer_id, scope_id, activity_id, hours"
  );
  if ("error" in fetched) return { error: fetched.error };
  const data = fetched.rows;

  return {
    rows: (
      data as {
        engineer_id: string | null;
        scope_id: string | null;
        activity_id: string | null;
        hours: number | null;
      }[]
    ).map((r) => ({
      engineerId: r.engineer_id,
      scopeId: r.scope_id,
      activityNodeId: r.activity_id,
      hours:
        r.hours !== null && !Number.isNaN(Number(r.hours)) ? roundHoursOneDp(Number(r.hours)) : 0,
    })),
  };
}

/**
 * Same as {@link getTimesheetActualsForProject} but includes `entry_date` for monthly / cumulative £.
 */
export async function getTimesheetCvrEntriesForProject(
  client: SupabaseClient,
  projectId: string
): Promise<{ rows: TimesheetCvrEntry[] } | { error: string }> {
  const { data: uploads, error: uploadsErr } = await client
    .from("timesheet_uploads")
    .select("id")
    .eq("project_id", projectId);
  if (uploadsErr) return { error: uploadsErr.message };

  const ids = (uploads as { id: string }[]).map((u) => u.id);
  if (ids.length === 0) return { rows: [] };

  const fetched = await fetchAllTimesheetEntriesForUploads(
    client,
    ids,
    "engineer_id, scope_id, hours, entry_date"
  );
  if ("error" in fetched) return { error: fetched.error };
  const data = fetched.rows;

  return {
    rows: (
      data as {
        engineer_id: string | null;
        scope_id: string | null;
        hours: number | null;
        entry_date: string | null;
      }[]
    ).map((r) => ({
      engineerId: r.engineer_id,
      scopeId: r.scope_id,
      hours: r.hours !== null ? Number(r.hours) : null,
      entryDate:
        r.entry_date !== null && r.entry_date !== undefined
          ? String(r.entry_date).slice(0, 10)
          : null,
    })),
  };
}
