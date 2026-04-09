-- One row per project × scope × engineer × calendar day (demand forecast hours).
CREATE TABLE IF NOT EXISTS forecast_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_id      text NOT NULL REFERENCES programme_nodes(id) ON DELETE CASCADE,
  engineer_id   uuid NOT NULL REFERENCES engineer_pool(id) ON DELETE CASCADE,
  date          text NOT NULL,
  hours         numeric NOT NULL,
  CONSTRAINT forecast_entries_date_iso CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  CONSTRAINT forecast_entries_project_scope_engineer_date UNIQUE (project_id, scope_id, engineer_id, date)
);

CREATE INDEX IF NOT EXISTS forecast_entries_project_id_idx ON forecast_entries (project_id);

ALTER TABLE forecast_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all forecast_entries" ON forecast_entries FOR ALL USING (true) WITH CHECK (true);
