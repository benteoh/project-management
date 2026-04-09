ALTER TABLE timesheet_entries
  DROP COLUMN IF EXISTS rate_slot,
  DROP COLUMN IF EXISTS amount,
  DROP COLUMN IF EXISTS description;
