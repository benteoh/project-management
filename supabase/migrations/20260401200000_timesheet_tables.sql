-- ---------------------------------------------------------------------------
-- timesheet_uploads: one row per file upload (CSV / Excel) per project.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timesheet_uploads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  row_count   integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS timesheet_uploads_project_id_idx
  ON timesheet_uploads (project_id);

ALTER TABLE timesheet_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all timesheet_uploads" ON timesheet_uploads FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- timesheet_entries: one row per spreadsheet row within an upload.
--
-- Key fields (engineer_id, entry_date, hours, rate_slot, amount) are extracted
-- and validated at save time. raw_data preserves the entire original row so
-- nothing is lost and rows can be re-processed later.
--
-- Rate linking: rate_slot (A–E) + engineer_id + project_id → JOIN
-- project_engineers to get the £/hr rate from project settings.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id     uuid NOT NULL REFERENCES timesheet_uploads(id) ON DELETE CASCADE,
  project_id    text NOT NULL REFERENCES projects(id),
  row_index     integer NOT NULL,
  engineer_id   uuid REFERENCES engineer_pool(id),
  engineer_code text,
  entry_date    date,
  hours         numeric(6, 2),
  rate_slot     text CHECK (rate_slot IN ('A', 'B', 'C', 'D', 'E')),
  amount        numeric(10, 2),
  description   text,
  raw_data      jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS timesheet_entries_upload_id_idx
  ON timesheet_entries (upload_id);

CREATE INDEX IF NOT EXISTS timesheet_entries_project_id_idx
  ON timesheet_entries (project_id);

ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all timesheet_entries" ON timesheet_entries FOR ALL USING (true) WITH CHECK (true);
