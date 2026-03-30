-- Migration: Create homepage_graphiti_insights
-- Description: Materialized feed of homepage-ready Graphiti insights written by the entity pipeline

CREATE TABLE IF NOT EXISTS homepage_graphiti_insights (
  insight_id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'unknown',
  league TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  freshness TEXT NOT NULL DEFAULT 'recent' CHECK (freshness IN ('new', 'recent', 'stale')),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_action TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  source_run_id TEXT,
  source_signal_id TEXT,
  source_episode_id TEXT,
  source_objective TEXT,
  materialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_homepage_graphiti_insights_materialized_at
  ON homepage_graphiti_insights(materialized_at DESC);

CREATE INDEX IF NOT EXISTS idx_homepage_graphiti_insights_entity_id
  ON homepage_graphiti_insights(entity_id);

CREATE INDEX IF NOT EXISTS idx_homepage_graphiti_insights_confidence
  ON homepage_graphiti_insights(confidence DESC);

ALTER TABLE homepage_graphiti_insights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'homepage_graphiti_insights'
      AND policyname = 'Enable all access on homepage_graphiti_insights'
  ) THEN
    CREATE POLICY "Enable all access on homepage_graphiti_insights"
    ON homepage_graphiti_insights
    FOR ALL
    USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_homepage_graphiti_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_homepage_graphiti_insights_updated_at ON homepage_graphiti_insights;
CREATE TRIGGER update_homepage_graphiti_insights_updated_at
  BEFORE UPDATE ON homepage_graphiti_insights
  FOR EACH ROW EXECUTE FUNCTION update_homepage_graphiti_insights_updated_at();
