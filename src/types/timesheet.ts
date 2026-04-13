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
 * Key fields are extracted when the upload is saved (`engineer_id` pool match, dates,
 * optional project/scope/activity from columns). `rawData` preserves the entire
 * original row. WBS IDs may be inconsistent with each other — validation is a FE concern.
 *
 * Hours are attributed to **scope** for rollups; **activity** records which activity
 * was worked on (same grain as one row).
 */
export interface TimesheetEntry {
  id: string;
  uploadId: string;
  /** Project the employee stated for this row (resolved from id or project_code when possible). */
  projectId: string | null;
  rowIndex: number;
  /** UUID from `engineer_pool`. Null when the Employee cell could not be matched. */
  engineerId: string | null;
  /** ISO date string (YYYY-MM-DD), or null if the date column was missing / unparseable. */
  entryDate: string | null;
  /** Hours worked, one decimal place when set. */
  hours: number | null;
  /** `programme_nodes.id` for type `scope` — hours roll up here. */
  scopeId: string | null;
  /** `programme_nodes.id` for type `activity` — which activity was worked on. */
  activityId: string | null;
  notes: string | null;
  /** Full row as header→value map — the raw source of truth for display and re-processing. */
  rawData: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Scope mapping types
// ---------------------------------------------------------------------------

/**
 * A user-defined mapping from a raw timesheet scope text string to a
 * programme scope node. Stored per-project; checked before fuzzy matching.
 */
export interface TimesheetScopeMapping {
  id: string;
  projectId: string;
  /** Original text as it appeared in the timesheet (trimmed). */
  rawText: string;
  /** `programme_nodes.id` of the scope node the user mapped this text to. */
  scopeId: string;
  createdAt: string;
}

/** DB row shape for `public.timesheet_scope_mappings`. */
export interface TimesheetScopeMappingDbRow {
  id: string;
  project_id: string;
  raw_text: string;
  scope_id: string;
  created_at: string;
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
  project_id: string | null;
  row_index: number;
  engineer_id: string | null;
  entry_date: string | null;
  hours: number | null;
  scope_id: string | null;
  activity_id: string | null;
  notes: string | null;
  raw_data: Record<string, string>;
}
