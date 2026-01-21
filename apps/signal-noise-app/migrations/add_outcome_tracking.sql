-- =============================================================================
-- Close the Loop: Outcome Tracking for RFP Feedback
-- -----------------------------------------------------------------------------
-- This migration adds tables and triggers to track RFP outcomes and close
-- the feedback loop. Won RFPs increase entity scores, lost RFPs decrease them.
--
-- Part of: Close the Loop - Temporal Intelligence for RFP Detection
-- =============================================================================

-- =============================================================================
-- Table: rfp_outcomes
-- Tracks the lifecycle and outcome of RFP opportunities
-- =============================================================================
CREATE TABLE IF NOT EXISTS rfp_outcomes (
  -- Primary identification
  id BIGSERIAL PRIMARY KEY,
  rfp_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN (
    'detected',      -- Initial detection
    'analyzing',     -- Under analysis
    'contacted',     -- Made contact
    'quoting',       -- Preparing quote/proposal
    'submitted',     -- Proposal submitted
    'shortlisted',   -- Made it to shortlist
    'won',           -- WON! 🎉
    'lost',          # Lost to competitor
    'withdrew',      -- Withdrew from process
    'on_hold'        -- Process paused
  )),

  stage TEXT,               -- Current stage (e.g., "technical_round", "final_pitch")
  probability NUMERIC CHECK (probability BETWEEN 0 AND 100),  -- Win probability %

  -- Value tracking
  value_estimated NUMERIC,
  value_actual NUMERIC,
  currency TEXT DEFAULT 'USD',

  -- Outcome details
  outcome_date TIMESTAMPTZ,
  outcome_notes TEXT,
  competitor TEXT,          -- Who we lost to (if applicable)
  loss_reason TEXT,         -- Why we lost (price, scope, timing, etc.)

  -- Feedback for learning
  lessons_learned TEXT,     -- Free text feedback
  tags TEXT[],              -- Tags for categorization

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  -- Prevent duplicate outcomes for same RFP
  CONSTRAINT unique_rfp_outcome UNIQUE (rfp_id)
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_rfp_outcomes_rfp ON rfp_outcomes(rfp_id);
CREATE INDEX IF NOT EXISTS idx_rfp_outcomes_entity ON rfp_outcomes(entity_id);
CREATE INDEX IF NOT EXISTS idx_rfp_outcomes_status ON rfp_outcomes(status);
CREATE INDEX IF NOT EXISTS idx_rfp_outcomes_outcome_date ON rfp_outcomes(outcome_date);
CREATE INDEX IF NOT EXISTS idx_rfp_outcomes_entity_status ON rfp_outcomes(entity_id, status);

-- Full-text search on notes
CREATE INDEX IF NOT EXISTS idx_rfp_outcomes_notes_fts ON rfp_outcomes USING gin(to_tsvector('english', outcome_notes));

-- =============================================================================
-- Function: update_entity_intelligence_from_outcome()
-- Updates entity intelligence scores based on RFP outcomes
-- This closes the feedback loop!
-- =============================================================================
CREATE OR REPLACE FUNCTION update_entity_intelligence_from_outcome()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act on final outcomes (won, lost, withdrew)
  IF NEW.status NOT IN ('won', 'lost', 'withdrew') THEN
    RETURN NEW;
  END IF;

  -- Update cached_entities based on outcome
  IF NEW.status = 'won' THEN
    -- WON: Increase intelligence score significantly
    UPDATE cached_entities
    SET
      intelligence_score = LEAST(100, intelligence_score + 10),
      updated_at = NOW()
    WHERE neo4j_id = NEW.entity_id;

    -- Also increment a wins counter if it exists
    UPDATE cached_entities
    SET
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{rfp_wins}',
        COALESCE((metadata->>'rfp_wins')::int, 0) + 1
      )
    WHERE neo4j_id = NEW.entity_id;

  ELSIF NEW.status = 'lost' THEN
    -- LOST: Small decrease (we're learning)
    UPDATE cached_entities
    SET
      intelligence_score = GREATEST(0, intelligence_score - 5),
      updated_at = NOW()
    WHERE neo4j_id = NEW.entity_id;

    -- Track loss reasons
    IF NEW.loss_reason IS NOT NULL THEN
      UPDATE cached_entities
      SET
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{last_loss_reason}',
          to_jsonb(NEW.loss_reason)
        )
      WHERE neo4j_id = NEW.entity_id;
    END IF;

  ELSIF NEW.status = 'withdrew' THEN
    -- WITHDREW: Neutral - just track the activity
    UPDATE cached_entities
    SET updated_at = NOW()
    WHERE neo4j_id = NEW.entity_id;
  END IF;

  -- Record temporal episode for outcome
  INSERT INTO temporal_episodes (
    entity_id,
    entity_name,
    entity_type,
    episode_type,
    timestamp,
    description,
    source,
    metadata,
    created_at
  ) VALUES (
    NEW.entity_id,
    NEW.entity_name,
    'Entity',
    CASE
      WHEN NEW.status = 'won' THEN 'RFP_WON'
      WHEN NEW.status = 'lost' THEN 'RFP_LOST'
      WHEN NEW.status = 'withdrew' THEN 'RFP_WITHDREW'
    END,
    COALESCE(NEW.outcome_date, NOW()),
    format('RFP %s: %s (Value: $%s)',
      UPPER(NEW.status),
      NEW.rfp_id,
      COALESCE(NEW.value_actual, NEW.value_estimated, 0)
    ),
    'outcome_tracking',
    jsonb_build_object(
      'rfp_id', NEW.rfp_id,
      'status', NEW.status,
      'value', COALESCE(NEW.value_actual, NEW.value_estimated),
      'loss_reason', NEW.loss_reason,
      'competitor', NEW.competitor
    ),
    NOW()
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Trigger: outcome_feedback_loop
-- Fires on INSERT or UPDATE of rfp_outcomes
-- =============================================================================
DROP TRIGGER IF EXISTS outcome_feedback_loop ON rfp_outcomes;
CREATE TRIGGER outcome_feedback_loop
  AFTER INSERT OR UPDATE OF status ON rfp_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_entity_intelligence_from_outcome();

-- =============================================================================
-- View: rfp_outcome_summary
-- Aggregated view of outcome performance by entity
-- =============================================================================
CREATE OR REPLACE VIEW rfp_outcome_summary AS
SELECT
  entity_id,
  entity_name,
  COUNT(*) as total_opportunities,
  COUNT(*) FILTER (WHERE status = 'won') as wins,
  COUNT(*) FILTER (WHERE status = 'lost') as losses,
  COUNT(*) FILTER (WHERE status IN ('won', 'lost', 'withdrew')) as completed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'won')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('won', 'lost')), 0),
    2
  ) as win_rate_percent,
  COALESCE(SUM(value_actual) FILTER (WHERE status = 'won'), 0) as total_won_value,
  COALESCE(SUM(value_estimated) FILTER (WHERE status IN ('analyzing', 'contacted', 'quoting', 'submitted')), 0) as pipeline_value,
  MAX(outcome_date) FILTER (WHERE status = 'won') as last_win_date
FROM rfp_outcomes
GROUP BY entity_id, entity_name;

-- =============================================================================
-- Table: outcome_feedback_queue
-- Queue for batch processing of outcome feedback
-- =============================================================================
CREATE TABLE IF NOT EXISTS outcome_feedback_queue (
  id BIGSERIAL PRIMARY KEY,
  rfp_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,  -- 'positive', 'negative', 'neutral'
  feedback_data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outcome_feedback_queue_unprocessed
  ON outcome_feedback_queue(id) WHERE processed = FALSE;

-- =============================================================================
-- Function: record_outcome_feedback()
-- Helper function to record outcome feedback with auto-scoring update
-- =============================================================================
CREATE OR REPLACE FUNCTION record_outcome_feedback(
  p_rfp_id TEXT,
  p_entity_id TEXT,
  p_entity_name TEXT,
  p_status TEXT,
  p_value_estimated NUMERIC DEFAULT NULL,
  p_value_actual NUMERIC DEFAULT NULL,
  p_outcome_notes TEXT DEFAULT NULL,
  p_loss_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  outcome_id BIGINT;
  result JSONB;
BEGIN
  -- Insert or update the outcome
  INSERT INTO rfp_outcomes (
    rfp_id, entity_id, entity_name, status,
    value_estimated, value_actual,
    outcome_notes, loss_reason, outcome_date
  ) VALUES (
    p_rfp_id, p_entity_id, p_entity_name, p_status,
    p_value_estimated, p_value_actual,
    p_outcome_notes, p_loss_reason, NOW()
  )
  ON CONFLICT (rfp_id) DO UPDATE SET
    status = EXCLUDED.status,
    value_actual = COALESCE(EXCLUDED.value_actual, rfp_outcomes.value_actual),
    outcome_notes = COALESCE(EXCLUDED.outcome_notes, rfp_outcomes.outcome_notes),
    loss_reason = COALESCE(EXCLUDED.loss_reason, rfp_outcomes.loss_reason),
    outcome_date = COALESCE(EXCLUDED.outcome_date, rfp_outcomes.outcome_date),
    updated_at = NOW()
  RETURNING id INTO outcome_id;

  -- Build result
  result = jsonb_build_object(
    'success', TRUE,
    'outcome_id', outcome_id,
    'rfp_id', p_rfp_id,
    'entity_id', p_entity_id,
    'status', p_status,
    'message', 'Outcome recorded and intelligence scores updated'
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Grant permissions (if using Supabase)
-- =============================================================================
-- GRANT SELECT, INSERT, UPDATE ON rfp_outcomes TO authenticated;
-- GRANT SELECT, UPDATE ON rfp_outcomes_id_seq TO authenticated;
-- GRANT SELECT ON rfp_outcome_summary TO authenticated;
-- GRANT EXECUTE ON FUNCTION record_outcome_feedback TO authenticated;

-- =============================================================================
-- Success message
-- =============================================================================
SELECT '✅ Outcome tracking system installed. Feedback loop closed!' as status;
