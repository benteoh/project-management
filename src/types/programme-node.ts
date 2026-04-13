/**
 * Shared programme primitives + DB row contracts.
 * App/UI tree model lives in `src/components/programme/types.ts` (`ProgrammeNode`).
 */
export type ProgrammeNodeType = "scope" | "task" | "subtask" | "activity";
export type ActivityStatus = "Not Started" | "In Progress" | "Completed" | "";

/** Raw row shape for `public.programme_nodes` (snake_case from Supabase). */
export interface ProgrammeNodeDbRow {
  id: string;
  project_id: string;
  activity_id: string | null;
  name: string;
  type: ProgrammeNodeType;
  total_hours: number | null;
  start_date: string | null;
  finish_date: string | null;
  status: ActivityStatus;
  parent_id: string | null;
  position: number;
  /** PM-entered agreed / issued quote for this scope (GBP). Scope rows only; null when unset. */
  quoted_amount?: number | null;
  /** PM-entered expected additional client quotation (GBP). Scope rows only. */
  quotation_warning_amount?: number | null;
  updated_at?: string;
}
