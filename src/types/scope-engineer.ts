/** Raw row shape returned from `public.scope_engineers`. */
export interface ScopeEngineerDbRow {
  id: string;
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  /**
   * Max hours per week on this scope for this engineer; null = use engineer_pool.max_weekly_hours.
   * Column name is `weekly_limit_hrs` (per-scope cap; distinct from engineer_pool.max_weekly_hours).
   */
  weekly_limit_hrs?: number | null;
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
  weekly_limit_hrs?: number | null;
  position: number;
  /** Defaults to 'A' at the DB level when omitted. */
  rate?: string;
}
