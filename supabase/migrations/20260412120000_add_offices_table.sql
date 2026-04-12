-- supabase/migrations/20260412120000_add_offices_table.sql

-- 1. Create offices table
CREATE TABLE offices (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name     text NOT NULL UNIQUE,
  -- NOTE: location is set equal to name as a placeholder during backfill.
  -- Update via Settings > Offices once real locations are known.
  location text NOT NULL
);

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offices_allow_all" ON offices FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON offices TO anon, authenticated, service_role;

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
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM projects WHERE office_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot set office_id NOT NULL: % project(s) have no matching office row.',
      (SELECT count(*) FROM projects WHERE office_id IS NULL);
  END IF;
END $$;
ALTER TABLE projects ALTER COLUMN office_id SET NOT NULL;

-- 6. Add index on FK column
CREATE INDEX projects_office_id_idx ON projects (office_id);

-- 7. Drop old text column
ALTER TABLE projects DROP COLUMN office;
