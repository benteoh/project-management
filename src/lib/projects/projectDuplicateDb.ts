import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { cloneProgrammeTreeWithFreshIds } from "@/lib/programme/cloneProgrammeTreeIds";
import { loadProgrammeFromDb, saveProgrammeToDb } from "@/lib/programme/programmeDb";

import { createProjectInDb, loadProjectById } from "./projectDb";

export async function duplicateProjectInDb(
  client: SupabaseClient,
  sourceProjectId: string
): Promise<{ projectId: string } | { error: string }> {
  const src = await loadProjectById(client, sourceProjectId);
  if ("error" in src) return { error: src.error };

  const prog = await loadProgrammeFromDb(client, sourceProjectId);
  if ("error" in prog) return { error: prog.error };

  const newId = randomUUID();
  const copyName = `${src.project.name} (Copy)`;

  const created = await createProjectInDb(client, {
    id: newId,
    name: copyName,
    client: src.project.client,
    office_id: src.project.officeId,
    project_code: src.project.projectCode ?? null,
    status: src.project.status,
    fixed_fee: src.project.fixedFee,
    start_date: src.project.startDate,
    end_date: src.project.endDate,
  });
  if ("error" in created) return { error: created.error };

  if (prog.tree.length > 0) {
    const clonedTree = cloneProgrammeTreeWithFreshIds(prog.tree);
    const saveErr = await saveProgrammeToDb(client, newId, clonedTree);
    if (saveErr) {
      await client.from("projects").delete().eq("id", newId);
      return { error: saveErr };
    }
  }

  const { data: peRows, error: peErr } = await client
    .from("project_engineers")
    .select("engineer_id, rate_a, rate_b, rate_c, rate_d, rate_e")
    .eq("project_id", sourceProjectId);

  if (peErr) {
    await client.from("projects").delete().eq("id", newId);
    return { error: peErr.message };
  }

  if (peRows && peRows.length > 0) {
    const inserts = peRows.map(
      (r: {
        engineer_id: string;
        rate_a: number | null;
        rate_b: number | null;
        rate_c: number | null;
        rate_d: number | null;
        rate_e: number | null;
      }) => ({
        project_id: newId,
        engineer_id: r.engineer_id,
        rate_a: r.rate_a,
        rate_b: r.rate_b,
        rate_c: r.rate_c,
        rate_d: r.rate_d,
        rate_e: r.rate_e,
      })
    );
    const { error: insErr } = await client.from("project_engineers").insert(inserts);
    if (insErr) {
      await client.from("projects").delete().eq("id", newId);
      return { error: insErr.message };
    }
  }

  return { projectId: newId };
}
