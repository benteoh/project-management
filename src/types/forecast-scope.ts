/** One engineer's total forecast hours on a scope (from `forecast_entries`). */
export type ForecastHoursPerEngineer = {
  engineerId: string;
  hours: number;
};

/** `scope_id` → per-engineer totals — JSON-safe for server → client props. */
export type ForecastHoursByScopeRecord = Record<string, ForecastHoursPerEngineer[]>;
