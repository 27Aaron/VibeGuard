-- PERF-02: GIN indexes for article search and tag filtering
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_articles_title_en_trgm
  ON articles USING gin (title_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_articles_title_zh_trgm
  ON articles USING gin (title_zh gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_articles_summary_en_trgm
  ON articles USING gin (summary_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_articles_summary_zh_trgm
  ON articles USING gin (summary_zh gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_articles_tags_gin
  ON articles USING gin (tags jsonb_path_ops);

-- GIN indexes for security advisory jsonb lookups (CVE alias matching)
CREATE INDEX IF NOT EXISTS idx_security_advisories_aliases_gin
  ON security_advisories USING gin (aliases jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_security_advisories_upstream_ids_gin
  ON security_advisories USING gin (upstream_ids jsonb_path_ops);
