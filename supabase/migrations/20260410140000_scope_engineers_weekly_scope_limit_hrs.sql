-- Clarify naming: per-scope weekly cap (distinct from engineer_pool.max_weekly_hours).
ALTER TABLE scope_engineers
  RENAME COLUMN weekly_limit_hrs TO weekly_scope_limit_hrs;
