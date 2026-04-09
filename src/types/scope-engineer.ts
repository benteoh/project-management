/** Raw row shape returned from `public.scope_engineers`. */
export interface ScopeEngineerDbRow {
  id: string;
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  forecast_hrs: number | null;
  position: number;
  /** Rate slot (A–E) used to cost this engineer's hours on this scope. Defaults to 'A'. */
  rate: string;
}

/** Insert payload shape for `public.scope_engineers`. */
export interface ScopeEngineerInsertRow {
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  forecast_hrs: number | null;
  position: number;
  /** Defaults to 'A' at the DB level when omitted. */
  rate?: string;
}
