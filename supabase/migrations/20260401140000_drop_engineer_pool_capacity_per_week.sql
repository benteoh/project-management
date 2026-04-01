-- Weekly capacity is derived from Mon–Fri capacity_days; drop redundant column.

-- Backfill missing capacity_days from legacy weekly total (equal split, 0.5h steps) before drop.
UPDATE engineer_pool
SET capacity_days = ARRAY[
  (round((capacity_per_week::numeric / 5.0) / 0.5) * 0.5)::numeric,
  (round((capacity_per_week::numeric / 5.0) / 0.5) * 0.5)::numeric,
  (round((capacity_per_week::numeric / 5.0) / 0.5) * 0.5)::numeric,
  (round((capacity_per_week::numeric / 5.0) / 0.5) * 0.5)::numeric,
  (round((capacity_per_week::numeric / 5.0) / 0.5) * 0.5)::numeric
]
WHERE capacity_days IS NULL AND capacity_per_week IS NOT NULL;

UPDATE engineer_pool
SET capacity_days = ARRAY[8, 8, 8, 8, 8]::numeric[]
WHERE capacity_days IS NULL;

ALTER TABLE engineer_pool DROP COLUMN capacity_per_week;
