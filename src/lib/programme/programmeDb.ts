import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import type { ProgrammeNode } from "@/components/programme/types";
import {
  DEFAULT_CAPACITY_PER_WEEK,
  DEFAULT_ENGINEER_CAPACITY_DAYS,
  type EngineerPoolEntry,
} from "@/types/engineer-pool";
import type { ProgrammeNodeDbRow } from "@/types/programme-node";
import type { ScopeEngineerDbRow } from "@/types/scope-engineer";

import { buildTreeFromRows, collectScopeIds, flattenTree } from "./programmeTree";

export async function loadProgrammeFromDb(
  client: SupabaseClient,
  projectId: string
): Promise<{ tree: ProgrammeNode[]; engineerPool: EngineerPoolEntry[] } | { error: string }> {
  const [nodesRes, poolRes] = await Promise.all([
    client.from("programme_nodes").select("*").eq("project_id", projectId),
    client.from("engineer_pool").select("id, code, capacity_per_week").eq("is_active", true),
  ]);

  if (nodesRes.error) return { error: nodesRes.error.message };
  if (poolRes.error) return { error: poolRes.error.message };

  const rows = (nodesRes.data ?? []) as ProgrammeNodeDbRow[];
  const scopeIds = rows.filter((r) => r.type === "scope").map((r) => r.id);

  const engRes =
    scopeIds.length === 0
      ? { data: [] as ScopeEngineerDbRow[], error: null }
      : await client.from("scope_engineers").select("*").in("scope_id", scopeIds);

  if (engRes.error) return { error: engRes.error.message };

  const engineerRows = (engRes.data ?? []) as ScopeEngineerDbRow[];
  const tree = buildTreeFromRows(rows, engineerRows);
  const engineerPool = (poolRes.data ?? [])
    .map((r) => {
      const row = r as { id: string; code: string; capacity_per_week: number | null };
      return {
        id: row.id,
        code: row.code,
        capacityPerWeek: (() => {
          if (row.capacity_per_week === null || row.capacity_per_week === undefined) return null;
          const n = Number(row.capacity_per_week);
          return Number.isFinite(n) ? n : null;
        })(),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return { tree, engineerPool };
}

export async function saveProgrammeToDb(
  client: SupabaseClient,
  projectId: string,
  tree: ProgrammeNode[]
): Promise<string | null> {
  const { nodeRows, engineerRows } = flattenTree(tree, projectId);
  const newIds = new Set(nodeRows.map((r) => r.id));
  const scopeIds = collectScopeIds(tree);

  const { error: upsertErr } = await client
    .from("programme_nodes")
    .upsert(nodeRows, { onConflict: "id" });
  if (upsertErr) return upsertErr.message;

  if (scopeIds.length > 0) {
    const { error: delEngErr } = await client
      .from("scope_engineers")
      .delete()
      .in("scope_id", scopeIds);
    if (delEngErr) return delEngErr.message;
  }

  if (engineerRows.length > 0) {
    const { error: insEngErr } = await client.from("scope_engineers").insert(engineerRows);
    if (insEngErr) return insEngErr.message;
  }

  const { data: existing, error: selErr } = await client
    .from("programme_nodes")
    .select("id")
    .eq("project_id", projectId);
  if (selErr) return selErr.message;

  const toDelete = (existing ?? []).map((r) => r.id as string).filter((id) => !newIds.has(id));

  if (toDelete.length > 0) {
    const { error: delErr } = await client.from("programme_nodes").delete().in("id", toDelete);
    if (delErr) return delErr.message;
  }

  return null;
}

export async function upsertEngineerPoolCodeInDb(
  client: SupabaseClient,
  code: string
): Promise<string | null> {
  const normalizedCode = code.trim();
  if (!normalizedCode) return "Engineer code is required.";

  const { error } = await client.from("engineer_pool").upsert(
    {
      id: randomUUID(),
      code: normalizedCode,
      first_name: normalizedCode,
      last_name: "",
      is_active: true,
      capacity_per_week: DEFAULT_CAPACITY_PER_WEEK,
      capacity_days: [...DEFAULT_ENGINEER_CAPACITY_DAYS],
    },
    { onConflict: "code", ignoreDuplicates: true }
  );
  return error?.message ?? null;
}
