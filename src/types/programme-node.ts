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
  forecast_total_hours: number | null;
  status: ActivityStatus;
  parent_id: string | null;
  position: number;
  updated_at?: string;
}
