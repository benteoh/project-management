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
  engineers?: {
    engineerId: string;
    plannedHrs?: number | null;
    weeklyScopeLimitHrs?: number | null;
    rate?: string;
  }[];
};

export type ScopeItem = {
  id: string;
  label: string;
};

export type ForecastFilterColumn = "scope" | "person";

export type ForecastGridRow = {
  scope: ScopeItem;
  engineer: EngineerPoolEntry;
  /** £/hr from project_engineers for the scope’s rate band (A–E). */
  hourRate: number | null;
  /** Planned hours for this engineer on this scope (from scope_engineers). */
  plannedHrs: number | null;
  /** ISO start date of the scope — autofill skips dates before this. */
  scopeStartDate: string | null;
  /** ISO finish date of the scope — used for deadline-priority sort. */
  scopeEndDate: string | null;
  scopeStatus: ActivityStatus;
  /** Per-engineer daily cap (global). Null = use DEFAULT_MAX_DAILY_HOURS. */
  maxDailyHours: number | null;
  /**
   * Max hours per week on this scope for this engineer (from `scope_engineers`, else pool default).
   * Autofill applies this together with {@link maxWeeklyHours} (total across scopes per week).
   */
  weeklyScopeLimit: number;
  /** Engineer pool weekly cap — autofill also limits total hours per week across all scopes. */
  maxWeeklyHours: number | null;
};
