CREATE TABLE IF NOT EXISTS entity_import_batches (
  id TEXT PRIMARY KEY,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS entity_pipeline_runs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES entity_import_batches(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT NOT NULL DEFAULT 'entity_registration',
  error_message TEXT,
  dossier_id TEXT,
  sales_readiness TEXT,
  rfp_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_entity_pipeline_runs_batch_id
  ON entity_pipeline_runs(batch_id);

CREATE INDEX IF NOT EXISTS idx_entity_pipeline_runs_entity_id
  ON entity_pipeline_runs(entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_pipeline_runs_status
  ON entity_pipeline_runs(status);
