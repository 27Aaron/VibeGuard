-- PERF-01: Trigram GIN indexes for security advisory text search (ILIKE optimization)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_security_advisories_external_id_trgm
  ON security_advisories USING gin (external_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_security_advisories_summary_trgm
  ON security_advisories USING gin (summary gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_security_advisories_details_trgm
  ON security_advisories USING gin (details gin_trgm_ops);
