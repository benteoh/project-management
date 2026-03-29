import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProgrammeNode } from "@/components/programme/types";
import {
  buildTreeFromRows,
  collectScopeIds,
  flattenTree,
  type ProgrammeNodeRow,
  type ScopeEngineerRow,
} from "./programmeTree";

export async function fetchProgrammeFromSupabase(
  client: SupabaseClient
): Promise<{ tree: ProgrammeNode[]; engineerPool: string[] } | { error: string }> {
  const [nodesRes, poolRes, engRes] = await Promise.all([
    client.from("programme_nodes").select("*"),
    client.from("engineer_pool").select("code").eq("is_active", true),
    client.from("scope_engineers").select("*"),
  ]);

  if (nodesRes.error) return { error: nodesRes.error.message };
  if (poolRes.error) return { error: poolRes.error.message };
  if (engRes.error) return { error: engRes.error.message };

  const rows = (nodesRes.data ?? []) as ProgrammeNodeRow[];
  const engineerRows = (engRes.data ?? []) as ScopeEngineerRow[];
  const tree = buildTreeFromRows(rows, engineerRows);
  const engineerPool = (poolRes.data ?? []).map((r) => r.code as string).sort();

  return { tree, engineerPool };
}

export async function syncProgrammeToSupabase(
  client: SupabaseClient,
  tree: ProgrammeNode[]
): Promise<string | null> {
  const { nodeRows, engineerRows } = flattenTree(tree);
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

  const { data: existing, error: selErr } = await client.from("programme_nodes").select("id");
  if (selErr) return selErr.message;

  const toDelete = (existing ?? []).map((r) => r.id as string).filter((id) => !newIds.has(id));

  if (toDelete.length > 0) {
    const { error: delErr } = await client.from("programme_nodes").delete().in("id", toDelete);
    if (delErr) return delErr.message;
  }

  return null;
}

export async function upsertEngineerPoolCode(
  client: SupabaseClient,
  code: string
): Promise<string | null> {
  const { error } = await client
    .from("engineer_pool")
    .upsert({ code, is_active: true }, { onConflict: "code" });
  return error?.message ?? null;
}
