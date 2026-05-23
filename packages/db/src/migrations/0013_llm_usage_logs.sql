CREATE TABLE llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES processing_jobs(id) ON DELETE SET NULL,
  task_type VARCHAR(40) NOT NULL,
  model VARCHAR(120) NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cached_tokens INTEGER,
  finish_reason VARCHAR(20),
  response_time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX llm_usage_logs_created_at_idx ON llm_usage_logs (created_at);
CREATE INDEX llm_usage_logs_article_id_idx ON llm_usage_logs (article_id);
CREATE INDEX llm_usage_logs_task_type_idx ON llm_usage_logs (task_type);
