-- Per-row project (from file), optional WBS links, notes. Inconsistent references
-- are allowed — no FKs on project_id / scope_id / activity_id.
ALTER TABLE timesheet_entries
  DROP CONSTRAINT IF EXISTS timesheet_entries_project_id_fkey;

ALTER TABLE timesheet_entries
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS scope_id text,
  ADD COLUMN IF NOT EXISTS activity_id text,
  ADD COLUMN IF NOT EXISTS notes text;
