-- Fix missing/null rate_a for Alex Petit (APe), K Ola (KOl), Thomas Schwind (TSc).
-- This supersedes 20260404000000 which failed due to a column reference bug (ep.project_id).
-- Safe to re-run: only patches rate_a; never overwrites other rate slots.

DO $$
DECLARE
  v_project_id text;
  v_engineer_id uuid;
BEGIN
  -- All three engineers belong to the single seed project
  SELECT id INTO v_project_id FROM projects LIMIT 1;

  -- Alex Petit (APe) — insert row if missing, set rate_a
  SELECT id INTO v_engineer_id FROM engineer_pool WHERE code = 'APe';
  IF v_engineer_id IS NOT NULL THEN
    INSERT INTO project_engineers (project_id, engineer_id, rate_a, rate_b, rate_c, rate_d, rate_e)
    VALUES (v_project_id, v_engineer_id, 104.375, 91.89, NULL, NULL, NULL)
    ON CONFLICT (project_id, engineer_id) DO UPDATE SET rate_a = 104.375;
  END IF;

  -- K Ola (KOl) — update rate_a from NULL
  SELECT id INTO v_engineer_id FROM engineer_pool WHERE code = 'KOl';
  IF v_engineer_id IS NOT NULL THEN
    INSERT INTO project_engineers (project_id, engineer_id, rate_a, rate_b, rate_c, rate_d, rate_e)
    VALUES (v_project_id, v_engineer_id, 131.875, 147.22, NULL, NULL, NULL)
    ON CONFLICT (project_id, engineer_id) DO UPDATE SET rate_a = 131.875;
  END IF;

  -- Thomas Schwind (TSc) — update rate_a from NULL
  SELECT id INTO v_engineer_id FROM engineer_pool WHERE code = 'TSc';
  IF v_engineer_id IS NOT NULL THEN
    INSERT INTO project_engineers (project_id, engineer_id, rate_a, rate_b, rate_c, rate_d, rate_e)
    VALUES (v_project_id, v_engineer_id, 171.56, 191.53, NULL, NULL, NULL)
    ON CONFLICT (project_id, engineer_id) DO UPDATE SET rate_a = 171.56;
  END IF;
END $$;
