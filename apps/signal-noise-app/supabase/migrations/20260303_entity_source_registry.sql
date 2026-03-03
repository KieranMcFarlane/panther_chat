CREATE TABLE IF NOT EXISTS entity_source_registry (
  id BIGSERIAL PRIMARY KEY,
  entity_id TEXT NOT NULL,
  page_class TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  is_canonical BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, page_class, url)
);

CREATE TABLE IF NOT EXISTS entity_source_snapshots (
  id BIGSERIAL PRIMARY KEY,
  entity_id TEXT NOT NULL,
  page_class TEXT NOT NULL,
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS entity_monitoring_candidates (
  id BIGSERIAL PRIMARY KEY,
  entity_id TEXT NOT NULL,
  batch_id TEXT,
  run_id TEXT,
  page_class TEXT NOT NULL,
  url TEXT NOT NULL,
  content_hash TEXT,
  candidate_type TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  evidence_excerpt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_source_registry_entity_id
  ON entity_source_registry(entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_source_registry_page_class
  ON entity_source_registry(page_class);

CREATE INDEX IF NOT EXISTS idx_entity_source_registry_canonical
  ON entity_source_registry(entity_id, page_class, is_canonical);

CREATE INDEX IF NOT EXISTS idx_entity_source_snapshots_entity_page
  ON entity_source_snapshots(entity_id, page_class);

CREATE INDEX IF NOT EXISTS idx_entity_source_snapshots_url_hash
  ON entity_source_snapshots(url, content_hash);

CREATE INDEX IF NOT EXISTS idx_entity_monitoring_candidates_entity_id
  ON entity_monitoring_candidates(entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_monitoring_candidates_batch_run
  ON entity_monitoring_candidates(batch_id, run_id);
