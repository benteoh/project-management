/** App/domain shape for engineer records (camelCase). */
export interface Engineer {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
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
  updated_at?: string;
}

/** Insert payload shape for `public.engineer_pool`. */
export interface EngineerInsertRow {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

/** Update payload shape for `public.engineer_pool`. */
export interface EngineerUpdateRow {
  code?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}
