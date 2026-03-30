"use server";

import type { ProgrammeNode } from "@/components/programme/types";
import { getEngineerByCodeFromDb } from "@/lib/engineers/engineerDb";
import { upsertEngineerPoolCodeInDb } from "@/lib/programme/programmeDb";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function saveProgrammeAction(projectId: string, tree: ProgrammeNode[]) {
  const repo = createSupabaseProgrammeRepository(createServerSupabaseClient(), projectId);
  return repo.save(tree);
}

export async function addEngineerToPoolAction(code: string) {
  const client = createServerSupabaseClient();
  const err = await upsertEngineerPoolCodeInDb(client, code.trim());
  if (err) return { ok: false as const, error: err };
  const eng = await getEngineerByCodeFromDb(client, code.trim());
  if ("error" in eng) return { ok: false as const, error: eng.error };
  return { ok: true as const, engineer: eng.engineer };
}
