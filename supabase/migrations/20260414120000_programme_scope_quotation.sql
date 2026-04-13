-- Scope-level commercial fields (GBP amounts; display assumes £ until per-office currency exists).

alter table programme_nodes
  add column if not exists quoted_amount numeric,
  add column if not exists quotation_warning_amount numeric;
