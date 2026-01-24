-- Graph Intelligence Schema for Supabase
-- Run this in Supabase SQL Editor to create the new schema

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Entities Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('ORG', 'PERSON', 'PRODUCT', 'INITIATIVE', 'VENUE')),
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE entities IS 'Core entities in the graph intelligence system';
COMMENT ON COLUMN entities.id IS 'Unique entity identifier (e.g., ac-milan, manchester-united)';
COMMENT ON COLUMN entities.type IS 'Fixed entity types: ORG, PERSON, PRODUCT, INITIATIVE, VENUE';

-- =============================================================================
-- Signals Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN (
    'RFP_DETECTED',
    'PARTNERSHIP_FORMED',
    'PARTNERSHIP_DISSOLVED',
    'TECHNOLOGY_ADOPTED',
    'TECHNOLOGY_DECOMMISSIONED',
    'EXECUTIVE_CHANGE',
    'FUNDING_RECEIVED',
    'PRODUCT_LAUNCH',
    'ACQUISITION',
    'REBRAND',
    'OTHER'
  )),
  subtype TEXT,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  first_seen TIMESTAMPTZ NOT NULL,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  validated BOOLEAN DEFAULT FALSE,
  validation_pass INTEGER DEFAULT 0 CHECK (validation_pass >= 0 AND validation_pass <= 3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE signals IS 'Signals representing events, opportunities, or changes';
COMMENT ON COLUMN signals.type IS 'Fixed signal types (extensible via approval workflow)';
COMMENT ON COLUMN signals.subtype IS 'Extensible signal subtype (requires approval)';
COMMENT ON COLUMN signals.validated IS 'Whether signal passed Ralph Loop validation';
COMMENT ON COLUMN signals.validation_pass IS 'Which validation pass the signal passed (1-3)';

-- =============================================================================
-- Evidence Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  url TEXT,
  extracted_text TEXT,
  credibility_score FLOAT DEFAULT 0.5 CHECK (credibility_score >= 0 AND credibility_score <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE evidence IS 'Evidence supporting signals (sources, documents, URLs)';
COMMENT ON COLUMN evidence.source IS 'Source of evidence (LinkedIn, News, Official, etc.)';
COMMENT ON COLUMN evidence.credibility_score IS 'Source credibility (0.0-1.0)';

-- =============================================================================
-- Relationships Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN (
    'PARTNER_OF',
    'SPONSOR_OF',
    'EMPLOYEE_OF',
    'OWNED_BY',
    'LOCATED_AT',
    'COMPETITOR_OF',
    'SUPPLIER_TO',
    'CUSTOMER_OF'
  )),
  from_entity TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE relationships IS 'Relationships between entities (graph edges)';
COMMENT ON COLUMN relationships.type IS 'Fixed relationship types';
COMMENT ON COLUMN relationships.valid_until IS 'NULL means relationship is still active';

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Entity indexes
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);

-- Signal indexes
CREATE INDEX IF NOT EXISTS idx_signals_entity_id ON signals(entity_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);
CREATE INDEX IF NOT EXISTS idx_signals_first_seen ON signals(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_signals_validated ON signals(validated);
CREATE INDEX IF NOT EXISTS idx_signals_confidence ON signals(confidence);

-- Evidence indexes
CREATE INDEX IF NOT EXISTS idx_evidence_signal_id ON evidence(signal_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence(source);
CREATE INDEX IF NOT EXISTS idx_evidence_date ON evidence(date DESC);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

-- Enable RLS
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
-- For now, allow all operations (can be restricted later)
CREATE POLICY "Enable all access on entities" ON entities FOR ALL USING (true);
CREATE POLICY "Enable all access on signals" ON signals FOR ALL USING (true);
CREATE POLICY "Enable all access on evidence" ON evidence FOR ALL USING (true);
CREATE POLICY "Enable all access on relationships" ON relationships FOR ALL USING (true);

-- =============================================================================
-- Trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Sample Data Verification
-- =============================================================================

-- After migration, you can verify with these queries:

-- Count entities
-- SELECT type, COUNT(*) FROM entities GROUP BY type;

-- Count signals by type
-- SELECT type, COUNT(*) FROM signals GROUP BY type;

-- Count evidence per signal
-- SELECT signal_id, COUNT(*) FROM evidence GROUP BY signal_id;

-- Find entities with most signals
-- SELECT e.name, COUNT(s.id) as signal_count
-- FROM entities e
-- LEFT JOIN signals s ON e.id = s.entity_id
-- GROUP BY e.id, e.name
-- ORDER BY signal_count DESC
-- LIMIT 10;

-- =============================================================================
-- Migration Completion
-- =============================================================================

-- After running this schema, execute:
-- python3 backend/migrate_episodes_to_signals.py

-- The migration script will:
-- 1. Read 7 episodes from temporal_episodes
-- 2. Create 5 entities
-- 3. Create 7 signals
-- 4. Create 7 evidence records
-- 5. Link everything properly via foreign keys
