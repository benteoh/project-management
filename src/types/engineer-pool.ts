/** Mon–Fri daily capacity hours (index 0 = Monday … 4 = Friday). */
export type EngineerCapacityDays = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

/** Default Mon–Fri capacity (hours per day). */
export const DEFAULT_ENGINEER_CAPACITY_DAYS: EngineerCapacityDays = [8, 8, 8, 8, 8];

/** Default total hours per week (aligned with {@link DEFAULT_ENGINEER_CAPACITY_DAYS}). */
export const DEFAULT_CAPACITY_PER_WEEK = 40;

/** App/domain shape for engineer records (camelCase). */
export interface Engineer {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  capacityPerWeek: number | null;
  capacityDays: EngineerCapacityDays;
}

/** Minimal entry for programme pickers (stable id + short code label). */
export interface EngineerPoolEntry {
  id: string;
  code: string;
}

/** Raw row shape for `public.engineer_pool` (snake_case from Supabase). */
export interface EngineerDbRow {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  capacity_per_week: number | null;
  capacity_days: number[] | null;
  updated_at?: string;
}

/** Insert payload shape for `public.engineer_pool`. */
export interface EngineerInsertRow {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  capacity_per_week?: number | null;
  capacity_days?: (number | null)[] | null;
}

/** Update payload shape for `public.engineer_pool`. */
export interface EngineerUpdateRow {
  code?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  capacity_per_week?: number | null;
  capacity_days?: (number | null)[] | null;
}
