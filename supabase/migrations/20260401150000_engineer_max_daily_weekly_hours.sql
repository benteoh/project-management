-- Replace Mon–Fri capacity_days with max hours per day and per week.

ALTER TABLE engineer_pool
  ADD COLUMN max_daily_hours numeric,
  ADD COLUMN max_weekly_hours numeric;

UPDATE engineer_pool e
SET
  max_daily_hours = (
    SELECT round(max(x::numeric) * 2) / 2
    FROM unnest(e.capacity_days) AS x
  ),
  max_weekly_hours = (
    SELECT coalesce(sum(x::numeric), 0)
    FROM unnest(e.capacity_days) AS x
  )
WHERE e.capacity_days IS NOT NULL AND array_length(e.capacity_days, 1) >= 1;

UPDATE engineer_pool
SET max_daily_hours = 8, max_weekly_hours = 40
WHERE max_daily_hours IS NULL OR max_weekly_hours IS NULL;

ALTER TABLE engineer_pool DROP COLUMN capacity_days;
