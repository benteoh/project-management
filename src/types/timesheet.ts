import type { RateSlot } from "./project-engineer";
export type { RateSlot };

// ---------------------------------------------------------------------------
// Domain / app types (camelCase)
// ---------------------------------------------------------------------------

/**
 * Metadata for a single timesheet file upload associated with a project.
 * One upload → many {@link TimesheetEntry} rows.
 */
export interface TimesheetUpload {
  id: string;
  projectId: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
}

/**
 * One row from an uploaded timesheet file.
 *
 * Key fields are extracted and validated against the engineer pool and project
 * rates when the upload is saved. `rawData` preserves the entire original row
 * (header → value) so nothing is lost.
 *
 * Rate linking: `rateSlot` (A–E) + `engineerId` + `projectId` → JOIN
 * `project_engineers` to derive the £/hr rate from the project settings.
 */
export interface TimesheetEntry {
  id: string;
  uploadId: string;
  projectId: string;
  rowIndex: number;
  /** UUID from `engineer_pool`. Null when the engineer code could not be matched. */
  engineerId: string | null;
  /** Raw engineer identifier from the CSV/Excel (e.g. "MWo"). */
  engineerCode: string | null;
  /** ISO date string (YYYY-MM-DD), or null if the date column was missing / unparseable. */
  entryDate: string | null;
  hours: number | null;
  /** Rate band from the timesheet file. Links to project_engineers.rate_X. */
  rateSlot: RateSlot | null;
  amount: number | null;
  description: string | null;
  /** Full row as header→value map — the raw source of truth for display and re-processing. */
  rawData: Record<string, string>;
}

// ---------------------------------------------------------------------------
// DB row types (snake_case, mirrors Supabase schema)
// ---------------------------------------------------------------------------

export interface TimesheetUploadDbRow {
  id: string;
  project_id: string;
  file_name: string;
  uploaded_at: string;
  row_count: number;
}

export interface TimesheetEntryDbRow {
  id: string;
  upload_id: string;
  project_id: string;
  row_index: number;
  engineer_id: string | null;
  engineer_code: string | null;
  entry_date: string | null;
  hours: number | null;
  rate_slot: string | null;
  amount: number | null;
  description: string | null;
  raw_data: Record<string, string>;
}
