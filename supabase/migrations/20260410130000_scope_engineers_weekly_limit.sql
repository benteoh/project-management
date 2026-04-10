-- Per-scope weekly hour cap for an engineer (demand forecast autofill / display).
-- Null = inherit engineer_pool.max_weekly_hours at read time in the app.
ALTER TABLE scope_engineers
  ADD COLUMN IF NOT EXISTS weekly_limit_hrs numeric;
