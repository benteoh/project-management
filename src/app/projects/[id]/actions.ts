"use server";

import type { ProgrammeNode } from "@/components/programme/types";
import { upsertEngineerPoolCodeInDb } from "@/lib/programme/programmeDb";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function saveProgrammeAction(projectId: string, tree: ProgrammeNode[]) {
  const repo = createSupabaseProgrammeRepository(createServerSupabaseClient(), projectId);
  return repo.save(tree);
}

export async function addEngineerToPoolAction(code: string) {
  const err = await upsertEngineerPoolCodeInDb(createServerSupabaseClient(), code.trim());
  if (err) return { ok: false as const, error: err };
  return { ok: true as const };
}
