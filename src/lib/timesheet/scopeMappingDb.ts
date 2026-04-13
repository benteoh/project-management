import type { SupabaseClient } from "@supabase/supabase-js";

import type { TimesheetScopeMapping, TimesheetScopeMappingDbRow } from "@/types/timesheet";

function rowToMapping(r: TimesheetScopeMappingDbRow): TimesheetScopeMapping {
  return {
    id: r.id,
    projectId: r.project_id,
    rawText: r.raw_text,
    scopeId: r.scope_id,
    createdAt: r.created_at,
  };
}

/** All scope mappings for a project. */
export async function getScopeMappings(
  client: SupabaseClient,
  projectId: string
): Promise<{ mappings: TimesheetScopeMapping[] } | { error: string }> {
  const { data, error } = await client
    .from("timesheet_scope_mappings")
    .select("*")
    .eq("project_id", projectId);
  if (error) return { error: error.message };
  return { mappings: (data as TimesheetScopeMappingDbRow[]).map(rowToMapping) };
}

/**
 * Insert or update the mapping for (project_id, raw_text).
 * Uses ON CONFLICT to update the scope_id if the raw_text already has a mapping.
 */
export async function upsertScopeMapping(
  client: SupabaseClient,
  projectId: string,
  rawText: string,
  scopeId: string
): Promise<{ ok: true; mapping: TimesheetScopeMapping } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("timesheet_scope_mappings")
    .upsert(
      { project_id: projectId, raw_text: rawText.trim(), scope_id: scopeId },
      { onConflict: "project_id,raw_text" }
    )
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, mapping: rowToMapping(data as TimesheetScopeMappingDbRow) };
}
