import type { SupabaseClient } from "@supabase/supabase-js";

export interface TimesheetActualEntry {
  engineerId: string | null;
  scopeId: string | null;
  hours: number | null;
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

  const { data, error } = await client
    .from("timesheet_entries")
    .select("engineer_id, scope_id, hours")
    .in("upload_id", ids)
    .gte("row_index", 0);
  if (error) return { error: error.message };

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
