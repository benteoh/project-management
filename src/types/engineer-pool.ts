/** Default caps: max hours per day / per week (Mon–Fri working week). */
export const DEFAULT_MAX_DAILY_HOURS = 8;
export const DEFAULT_MAX_WEEKLY_HOURS = 40;

/** App/domain shape for engineer records (camelCase). */
export interface Engineer {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  maxDailyHours: number | null;
  maxWeeklyHours: number | null;
}

/** Programme / grid: pool row (identity + labels for pickers). */
export interface EngineerPoolEntry {
  id: string;
  code: string;
  firstName?: string;
  lastName?: string;
}

/** Raw row shape for `public.engineer_pool` (snake_case from Supabase). */
export interface EngineerDbRow {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  max_daily_hours: number | null;
  max_weekly_hours: number | null;
  updated_at?: string;
}

/** Insert payload shape for `public.engineer_pool`. */
export interface EngineerInsertRow {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  max_daily_hours?: number | null;
  max_weekly_hours?: number | null;
}

/** Update payload shape for `public.engineer_pool`. */
export interface EngineerUpdateRow {
  code?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  max_daily_hours?: number | null;
  max_weekly_hours?: number | null;
}
