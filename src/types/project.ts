export type ProjectStatus = "active" | "complete" | "bid" | "on_hold";

/** Shared project primitives + domain and DB contracts. */

/** App/domain shape used by pages and components (camelCase). */
export interface Project {
  id: string;
  projectCode: string | null;
  name: string;
  client: string;
  office: string;
  status: ProjectStatus;
  fixedFee: number;
  startDate: string;
  endDate: string;
}

/** Raw row shape for `public.projects` (snake_case from Supabase). */
export interface ProjectDbRow {
  id: string;
  project_code: string | null;
  name: string;
  client: string;
  office: string;
  status: ProjectStatus;
  fixed_fee: number;
  start_date: string;
  end_date: string;
  updated_at?: string;
}

/** Insert/upsert payload shape for `public.projects`. */
export interface ProjectUpsertRow {
  id: string;
  project_code?: string | null;
  name: string;
  client: string;
  office: string;
  status: ProjectStatus;
  fixed_fee: number;
  start_date: string;
  end_date: string;
}
