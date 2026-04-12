export type ProjectStatus = "active" | "complete" | "bid" | "on_hold";

/** App/domain shape used by pages and components (camelCase). */
export interface Project {
  id: string;
  projectCode: string | null;
  name: string;
  client: string;
  officeId: string;
  officeName: string;
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
  office_id: string;
  status: ProjectStatus;
  fixed_fee: number;
  start_date: string;
  end_date: string;
  updated_at?: string;
  offices?: { name: string; location: string } | null;
}

/** Insert/upsert payload shape for `public.projects`. */
export interface ProjectUpsertRow {
  id: string;
  project_code?: string | null;
  name: string;
  client: string;
  office_id: string;
  status: ProjectStatus;
  fixed_fee: number;
  start_date: string;
  end_date: string;
}
