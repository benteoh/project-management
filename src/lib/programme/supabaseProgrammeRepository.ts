import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProgrammeNode } from "@/components/programme/types";

import { loadProgrammeFromDb, saveProgrammeToDb, upsertEngineerPoolCodeInDb } from "./programmeDb";
import type {
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

    async addEngineerToPool(code: string): Promise<MutationResult> {
      const err = await upsertEngineerPoolCodeInDb(client, code.trim());
      if (err) return { ok: false, error: err };
      return { ok: true };
    },
  };
}
