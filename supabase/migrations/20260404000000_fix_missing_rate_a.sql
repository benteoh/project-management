-- Fix missing rate_a for Alex Petit (APe), K Ola (KOl), Thomas Schwind (TSc).
--
-- Alex Petit had no project_engineers row at all (omitted from original seed).
-- K Ola and Thomas Schwind had rows but rate_a was NULL (absent from source sheet).
-- Rates confirmed by DSP: APe=104.375, KOl=131.875, TSc=171.56
--
-- Safe to re-run: INSERT … ON CONFLICT DO UPDATE only patches rate_a.

INSERT INTO project_engineers (project_id, engineer_id, rate_a, rate_b, rate_c, rate_d, rate_e)
SELECT
  proj.project_id,
  pool.id  AS engineer_id,
  rates.rate_a,
  rates.rate_b,
  NULL::numeric,
  NULL::numeric,
  NULL::numeric
FROM (
  VALUES
    ('APe', 104.375::numeric, 91.89::numeric ),
    ('KOl', 131.875::numeric, 147.22::numeric),
    ('TSc', 171.56::numeric,  191.53::numeric)
) AS rates(code, rate_a, rate_b)
JOIN engineer_pool pool ON pool.code = rates.code
CROSS JOIN (SELECT id AS project_id FROM projects LIMIT 1) proj
ON CONFLICT (project_id, engineer_id)
DO UPDATE SET rate_a = EXCLUDED.rate_a;
