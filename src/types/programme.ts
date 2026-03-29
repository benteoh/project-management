import type { NodeType } from "@/components/programme/types";

/** Row shape for `public.programme_nodes`. */
export interface ProgrammeNodeDbRow {
  id: string;
  project_id: string;
  activity_id: string | null;
  name: string;
  type: NodeType;
  total_hours: number | null;
  start_date: string | null;
  finish_date: string | null;
  forecast_total_hours: number | null;
  status: string;
  parent_id: string | null;
  position: number;
  updated_at?: string;
}

/** Row shape for `public.scope_engineers`. */
export interface ScopeEngineerDbRow {
  id?: string;
  scope_id: string;
  engineer_code: string;
  is_lead: boolean;
  planned_hrs: number | null;
  forecast_hrs: number | null;
  position: number;
}

/** Row shape for `public.engineer_pool`. */
export interface EngineerPoolDbRow {
  code: string;
  is_active?: boolean;
}
