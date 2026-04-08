-- Add rate slot column to scope_engineers.
-- NOT NULL DEFAULT 'A' backfills all existing rows with 'A' in a single statement.

ALTER TABLE scope_engineers
  ADD COLUMN rate text NOT NULL DEFAULT 'A' CHECK (rate IN ('A', 'B', 'C', 'D', 'E'));
