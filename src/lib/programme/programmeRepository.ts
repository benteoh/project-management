import type { ProgrammeNode } from "@/components/programme/types";
import type { Engineer, EngineerPoolEntry } from "@/types/engineer-pool";

export type ProgrammeLoadResult =
  | { ok: true; tree: ProgrammeNode[]; engineerPool: EngineerPoolEntry[] }
  | { ok: false; error: string };

export type MutationResult = { ok: true } | { ok: false; error: string };

export type AddEngineerToPoolResult =
  | { ok: true; engineer: Engineer }
  | { ok: false; error: string };

export interface ProgrammeRepository {
  load(): Promise<ProgrammeLoadResult>;
  save(tree: ProgrammeNode[]): Promise<MutationResult>;
  addEngineerToPool(code: string): Promise<AddEngineerToPoolResult>;
}
