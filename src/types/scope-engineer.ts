/** Raw row shape returned from `public.scope_engineers`. */
export interface ScopeEngineerDbRow {
  id: string;
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  forecast_hrs: number | null;
  position: number;
}

/** Insert payload shape for `public.scope_engineers`. */
export interface ScopeEngineerInsertRow {
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  forecast_hrs: number | null;
  position: number;
}
