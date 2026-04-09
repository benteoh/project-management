-- Forecast hours for programme display come from `forecast_entries` (aggregated in the app).
-- Remove redundant stored fields from programme_nodes and scope_engineers.

ALTER TABLE programme_nodes DROP COLUMN IF EXISTS forecast_total_hours;
ALTER TABLE scope_engineers DROP COLUMN IF EXISTS forecast_hrs;
