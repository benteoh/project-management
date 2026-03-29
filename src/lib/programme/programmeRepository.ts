import type { ProgrammeNode } from "@/components/programme/types";

export type ProgrammeLoadResult =
  | { ok: true; tree: ProgrammeNode[]; engineerPool: string[] }
  | { ok: false; error: string };

export type MutationResult = { ok: true } | { ok: false; error: string };

export interface ProgrammeRepository {
  load(): Promise<ProgrammeLoadResult>;
  save(tree: ProgrammeNode[]): Promise<MutationResult>;
  addEngineerToPool(code: string): Promise<MutationResult>;
}
