-- PostgREST and the app use `weekly_limit_hrs` (added in 20260410130000).
-- If 20260410140000 was applied, rename back so the canonical column name matches inserts/selects.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scope_engineers'
      AND column_name = 'weekly_scope_limit_hrs'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scope_engineers'
      AND column_name = 'weekly_limit_hrs'
  ) THEN
    ALTER TABLE scope_engineers RENAME COLUMN weekly_scope_limit_hrs TO weekly_limit_hrs;
  END IF;
END $$;
