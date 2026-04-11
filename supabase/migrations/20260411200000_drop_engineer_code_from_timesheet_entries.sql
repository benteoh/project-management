-- Engineer identity is engineer_id → engineer_pool; labels come from the join / raw_data.
ALTER TABLE timesheet_entries
  DROP COLUMN IF EXISTS engineer_code;
