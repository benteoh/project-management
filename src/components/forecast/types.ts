import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { ProgrammeNodeType } from "@/types/programme-node";

export type ForecastProgrammeNode = {
  id: string;
  name: string;
  type: ProgrammeNodeType;
};

export type ScopeItem = {
  id: string;
  label: string;
};

export type ForecastFilterColumn = "scope" | "person";

export type ForecastGridRow = {
  scope: ScopeItem;
  engineer: EngineerPoolEntry;
};
