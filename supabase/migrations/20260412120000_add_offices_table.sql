-- supabase/migrations/20260412120000_add_offices_table.sql

-- 1. Create offices table
CREATE TABLE offices (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL UNIQUE,
  location text NOT NULL
);

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offices_auth_select" ON offices FOR SELECT TO authenticated USING (true);
CREATE POLICY "offices_auth_all"    ON offices FOR ALL    TO authenticated USING (true);

-- 2. Backfill from existing projects.office strings (location = name as placeholder)
INSERT INTO offices (id, name, location)
SELECT gen_random_uuid(), office, office
FROM projects
WHERE office IS NOT NULL AND office <> ''
GROUP BY office
ON CONFLICT (name) DO NOTHING;

-- 3. Add office_id FK (nullable first so backfill can run)
ALTER TABLE projects
  ADD COLUMN office_id uuid REFERENCES offices(id) ON DELETE RESTRICT;

-- 4. Backfill office_id
UPDATE projects p
SET office_id = o.id
FROM offices o
WHERE p.office = o.name;

-- 5. Enforce NOT NULL
ALTER TABLE projects ALTER COLUMN office_id SET NOT NULL;

-- 6. Drop old text column
ALTER TABLE projects DROP COLUMN office;
