-- Cache table for UK bank holidays fetched from gov.uk API (7-day TTL)
CREATE TABLE bank_holidays_cache (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  dates JSONB NOT NULL,         -- string[] of ISO 8601 dates (YYYY-MM-DD)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE bank_holidays_cache ENABLE ROW LEVEL SECURITY;

-- Server-side only reads via service role; no public access needed
