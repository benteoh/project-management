import type { SupabaseClient } from "@supabase/supabase-js";

import type { EngineerDbRow } from "@/types/engineer-pool";
import type {
  ProjectEngineerAssignment,
  ProjectEngineerDbRow,
  ProjectEngineerRates,
} from "@/types/project-engineer";

const RATE_DB_KEYS = ["rate_a", "rate_b", "rate_c", "rate_d", "rate_e"] as const;

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToRates(r: ProjectEngineerDbRow): ProjectEngineerRates {
  return [
    numOrNull(r.rate_a),
    numOrNull(r.rate_b),
    numOrNull(r.rate_c),
    numOrNull(r.rate_d),
    numOrNull(r.rate_e),
  ];
}

function mergeRow(
  pe: ProjectEngineerDbRow,
  pool: Map<string, EngineerDbRow>
): ProjectEngineerAssignment | null {
  const ep = pool.get(pe.engineer_id);
  if (!ep) return null;
  return {
    id: pe.id,
    projectId: pe.project_id,
    engineerId: pe.engineer_id,
    code: ep.code,
    firstName: ep.first_name,
    lastName: ep.last_name,
    rates: rowToRates(pe),
  };
}

export async function listProjectEngineersForProjectFromDb(
  client: SupabaseClient,
  projectId: string
): Promise<{ rows: ProjectEngineerAssignment[] } | { error: string }> {
  const { data: peRows, error } = await client
    .from("project_engineers")
    .select("id, project_id, engineer_id, rate_a, rate_b, rate_c, rate_d, rate_e")
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  const assignments = (peRows ?? []) as ProjectEngineerDbRow[];
  if (assignments.length === 0) return { rows: [] };

  const ids = [...new Set(assignments.map((r) => r.engineer_id))];
  const { data: poolRows, error: poolErr } = await client
    .from("engineer_pool")
    .select("id, code, first_name, last_name")
    .in("id", ids);

  if (poolErr) return { error: poolErr.message };

  const pool = new Map((poolRows as EngineerDbRow[] | null)?.map((r) => [r.id, r]) ?? []);

  const rows: ProjectEngineerAssignment[] = [];
  for (const pe of assignments) {
    const m = mergeRow(pe, pool);
    if (m) rows.push(m);
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));
  return { rows };
}

export async function insertProjectEngineerInDb(
  client: SupabaseClient,
  projectId: string,
  engineerId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await client.from("project_engineers").insert({
    project_id: projectId,
    engineer_id: engineerId,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteProjectEngineerInDb(
  client: SupabaseClient,
  projectId: string,
  assignmentId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await client
    .from("project_engineers")
    .delete()
    .eq("id", assignmentId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateProjectEngineerRateSlotInDb(
  client: SupabaseClient,
  projectId: string,
  assignmentId: string,
  slotIndex: number,
  rate: number | null
): Promise<{ ok: true } | { error: string }> {
  if (slotIndex < 0 || slotIndex >= RATE_DB_KEYS.length) {
    return { error: "Rate slot must be between A and E." };
  }

  const key = RATE_DB_KEYS[slotIndex];
  const patch: Record<string, number | null> = { [key]: rate };

  const { error } = await client
    .from("project_engineers")
    .update(patch)
    .eq("id", assignmentId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function addAllActiveEngineersToProjectInDb(
  client: SupabaseClient,
  projectId: string
): Promise<{ ok: true; added: number } | { error: string }> {
  const { data: pool, error: poolErr } = await client
    .from("engineer_pool")
    .select("id")
    .eq("is_active", true);

  if (poolErr) return { error: poolErr.message };

  const { data: existing, error: exErr } = await client
    .from("project_engineers")
    .select("engineer_id")
    .eq("project_id", projectId);

  if (exErr) return { error: exErr.message };

  const have = new Set((existing ?? []).map((r: { engineer_id: string }) => r.engineer_id));
  const toAdd = (pool ?? []).map((r: { id: string }) => r.id).filter((id: string) => !have.has(id));

  if (toAdd.length === 0) return { ok: true, added: 0 };

  const rows = toAdd.map((engineer_id: string) => ({ project_id: projectId, engineer_id }));
  const { error } = await client.from("project_engineers").insert(rows);
  if (error) return { error: error.message };
  return { ok: true, added: toAdd.length };
}
