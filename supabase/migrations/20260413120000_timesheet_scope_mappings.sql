-- Stores explicit user-defined mappings from a raw timesheet scope text string
-- to a confirmed programme_nodes scope node. One mapping per (project, raw_text) pair.
CREATE TABLE IF NOT EXISTS timesheet_scope_mappings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  raw_text    text NOT NULL,
  scope_id    text NOT NULL REFERENCES programme_nodes(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timesheet_scope_mappings_project_raw_unique UNIQUE (project_id, raw_text)
);

CREATE INDEX IF NOT EXISTS timesheet_scope_mappings_project_id_idx
  ON timesheet_scope_mappings (project_id);

ALTER TABLE timesheet_scope_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all timesheet_scope_mappings"
  ON timesheet_scope_mappings FOR ALL USING (true) WITH CHECK (true);
