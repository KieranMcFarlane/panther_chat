CREATE TABLE IF NOT EXISTS pipeline_control_state (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pipeline_control_state IS 'Singleton pipeline control and cursor state persisted for restart-safe worker claims';
COMMENT ON COLUMN pipeline_control_state.id IS 'Singleton key for the pipeline control record';
COMMENT ON COLUMN pipeline_control_state.state IS 'Serialized control state including pause flags, cursor fields, and live batch metadata';

CREATE INDEX IF NOT EXISTS idx_pipeline_control_state_updated_at
  ON pipeline_control_state(updated_at DESC);
