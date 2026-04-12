-- Link engineers to offices (nullable = unassigned).

ALTER TABLE engineer_pool
  ADD COLUMN office_id uuid REFERENCES offices (id) ON DELETE SET NULL;

CREATE INDEX engineer_pool_office_id_idx ON engineer_pool (office_id);
