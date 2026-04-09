import type { EngineerPoolEntry } from "@/types/engineer-pool";
import type { ActivityStatus, ProgrammeNodeType } from "@/types/programme-node";

export type ForecastProgrammeNode = {
  id: string;
  name: string;
  type: ProgrammeNodeType;
  /** ISO start date for the scope. Used to constrain autofill (no hours before start). */
  start?: string;
  /** ISO finish date. Used for deadline-priority sort in autofill. */
  finish?: string;
  status?: ActivityStatus;
  /** Engineer assignments for this scope (scope nodes only). */
  engineers?: { engineerId: string; plannedHrs?: number | null }[];
};

export type ScopeItem = {
  id: string;
  label: string;
};

export type ForecastFilterColumn = "scope" | "person";

export type ForecastGridRow = {
  scope: ScopeItem;
  engineer: EngineerPoolEntry;
  /** Planned hours for this engineer on this scope (from scope_engineers). */
  plannedHrs: number | null;
  /** ISO start date of the scope — autofill skips dates before this. */
  scopeStartDate: string | null;
  /** ISO finish date of the scope — used for deadline-priority sort. */
  scopeEndDate: string | null;
  scopeStatus: ActivityStatus;
  /** Per-engineer daily/weekly caps. Null = use DEFAULT_MAX_*_HOURS. */
  maxDailyHours: number | null;
  maxWeeklyHours: number | null;
};
