/** Office — first-class entity stored in `public.offices`. */
export interface Office {
  id: string;
  name: string;
  location: string;
}

/** Raw row shape for `public.offices` (snake_case from Supabase). */
export interface OfficeDbRow {
  id: string;
  name: string;
  location: string;
}

/** Insert/upsert payload for `public.offices`. */
export interface OfficeUpsertRow {
  id?: string;
  name: string;
  location: string;
}
