import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProgrammeNode } from "@/components/programme/types";

import { getEngineerByCodeFromDb } from "@/lib/engineers/engineerDb";

import { loadProgrammeFromDb, saveProgrammeToDb, upsertEngineerPoolCodeInDb } from "./programmeDb";
import type {
  AddEngineerToPoolResult,
  MutationResult,
  ProgrammeLoadResult,
  ProgrammeRepository,
} from "./programmeRepository";

export function createSupabaseProgrammeRepository(
  client: SupabaseClient,
  projectId: string
): ProgrammeRepository {
  return {
    async load(): Promise<ProgrammeLoadResult> {
      const r = await loadProgrammeFromDb(client, projectId);
      if ("error" in r) return { ok: false, error: r.error };
      return { ok: true, tree: r.tree, engineerPool: r.engineerPool };
    },

    async save(tree: ProgrammeNode[]): Promise<MutationResult> {
      const err = await saveProgrammeToDb(client, projectId, tree);
      if (err) return { ok: false, error: err };
      return { ok: true };
    },

    async addEngineerToPool(code: string): Promise<AddEngineerToPoolResult> {
      const err = await upsertEngineerPoolCodeInDb(client, code.trim());
      if (err) return { ok: false, error: err };
      const eng = await getEngineerByCodeFromDb(client, code.trim());
      if ("error" in eng) return { ok: false, error: eng.error };
      return { ok: true, engineer: eng.engineer };
    },
  };
}
