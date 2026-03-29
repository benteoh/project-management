"use server";

import type { ProgrammeNode } from "@/components/programme/types";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function saveProgrammeAction(tree: ProgrammeNode[]) {
  const repo = createSupabaseProgrammeRepository(createServerSupabaseClient());
  return repo.save(tree);
}

export async function addEngineerToPoolAction(code: string) {
  const repo = createSupabaseProgrammeRepository(createServerSupabaseClient());
  return repo.addEngineerToPool(code);
}
