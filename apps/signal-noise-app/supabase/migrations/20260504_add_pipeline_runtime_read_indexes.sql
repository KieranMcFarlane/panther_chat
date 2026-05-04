CREATE INDEX IF NOT EXISTS idx_entity_pipeline_runs_started_at_desc
  ON entity_pipeline_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_pipeline_runs_status_started_at_desc
  ON entity_pipeline_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_dossiers_canonical_entity_id
  ON entity_dossiers(canonical_entity_id);
