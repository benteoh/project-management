-- Add a human-readable project code to each project (e.g. "DSP-EU-001").
-- Nullable: existing rows keep null until updated.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code text;
