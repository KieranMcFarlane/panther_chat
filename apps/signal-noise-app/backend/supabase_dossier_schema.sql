-- Dossier Storage Schema for Entity Dossier Generation System
-- Implements caching and incremental updates for multi-section dossiers

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Dossiers Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS entity_dossiers (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Entity identification
    entity_id TEXT UNIQUE NOT NULL,
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,  -- CLUB, LEAGUE, VENUE, etc.
    priority_score INTEGER NOT NULL CHECK (priority_score >= 0 AND priority_score <= 100),
    tier TEXT NOT NULL CHECK (tier IN ('BASIC', 'STANDARD', 'PREMIUM')),

    -- Complete dossier JSON
    sections JSONB NOT NULL,

    -- Metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.0,
    generation_time_seconds DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
    cache_status TEXT NOT NULL DEFAULT 'FRESH' CHECK (cache_status IN ('FRESH', 'STALE', 'EXPIRED')),

    -- Cache management
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_dossiers_entity_id ON entity_dossiers(entity_id);
CREATE INDEX idx_dossiers_tier ON entity_dossiers(tier);
CREATE INDEX idx_dossiers_cache_status ON entity_dossiers(cache_status);
CREATE INDEX idx_dossiers_expires_at ON entity_dossiers(expires_at);
CREATE INDEX idx_dossiers_priority_score ON entity_dossiers(priority_score);

-- Composite index for cache expiry queries
CREATE INDEX idx_dossiers_cache_expiry ON entity_dossiers(cache_status, expires_at);

-- =============================================================================
-- Section-Level Cache (for incremental updates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dossier_sections_cache (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Entity and section identification
    entity_id TEXT NOT NULL,
    section_id TEXT NOT NULL,

    -- Section content (JSON)
    section_content JSONB NOT NULL,

    -- Generation metadata
    generated_by TEXT NOT NULL CHECK (generated_by IN ('haiku', 'sonnet', 'opus')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- Cache validity
    is_valid BOOLEAN NOT NULL DEFAULT true,
    invalidation_reason TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    UNIQUE(entity_id, section_id)
);

-- Indexes for section cache
CREATE INDEX idx_dossier_sections_entity_id ON dossier_sections_cache(entity_id);
CREATE INDEX idx_dossier_sections_section_id ON dossier_sections_cache(section_id);
CREATE INDEX idx_dossier_sections_generated_by ON dossier_sections_cache(generated_by);
CREATE INDEX idx_dossier_sections_is_valid ON dossier_sections_cache(is_valid);
CREATE INDEX idx_dossier_sections_expires_at ON dossier_sections_cache(expires_at);

-- =============================================================================
-- Dossier Generation Jobs (for async processing)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dossier_generation_jobs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Job identification
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('BASIC', 'STANDARD', 'PREMIUM')),

    -- Job status
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    priority INTEGER NOT NULL DEFAULT 50,

    -- Progress tracking
    sections_completed INTEGER DEFAULT 0,
    sections_total INTEGER NOT NULL,
    current_section TEXT,

    -- Results
    dossier_id UUID REFERENCES entity_dossiers(id),
    error_message TEXT,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job processing
CREATE INDEX idx_dossier_jobs_status ON dossier_generation_jobs(status);
CREATE INDEX idx_dossier_jobs_priority ON dossier_generation_jobs(priority, created_at);
CREATE INDEX idx_dossier_jobs_entity_id ON dossier_generation_jobs(entity_id);

-- =============================================================================
-- Functions and Triggers
-- =============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to entity_dossiers
DROP TRIGGER IF EXISTS update_entity_dossiers_updated_at ON entity_dossiers;
CREATE TRIGGER update_entity_dossiers_updated_at
    BEFORE UPDATE ON entity_dossiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to dossier_sections_cache
DROP TRIGGER IF EXISTS update_dossier_sections_cache_updated_at ON dossier_sections_cache;
CREATE TRIGGER update_dossier_sections_cache_updated_at
    BEFORE UPDATE ON dossier_sections_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Check if dossier is expired
CREATE OR REPLACE FUNCTION is_dossier_expired(dossier_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM entity_dossiers
        WHERE id = dossier_id
        AND expires_at < NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Invalidate section cache
CREATE OR REPLACE FUNCTION invalidate_dossier_section(
    p_entity_id TEXT,
    p_section_id TEXT,
    p_reason TEXT DEFAULT 'Manual invalidation'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE dossier_sections_cache
    SET is_valid = false,
        invalidation_reason = p_reason,
        updated_at = NOW()
    WHERE entity_id = p_entity_id
    AND section_id = p_section_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get valid cached sections for an entity
CREATE OR REPLACE FUNCTION get_valid_cached_sections(p_entity_id TEXT)
RETURNS TABLE (
    section_id TEXT,
    section_content JSONB,
    generated_by TEXT,
    generated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT sc.section_id, sc.section_content, sc.generated_by, sc.generated_at
    FROM dossier_sections_cache sc
    WHERE sc.entity_id = p_entity_id
    AND sc.is_valid = true
    AND sc.expires_at > NOW()
    ORDER BY sc.generated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Mark dossier as stale when entity data changes
CREATE OR REPLACE FUNCTION mark_dossier_stale(p_entity_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE entity_dossiers
    SET cache_status = 'STALE',
        updated_at = NOW()
    WHERE entity_id = p_entity_id
    AND cache_status = 'FRESH';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Views for Common Queries
-- =============================================================================

-- Active dossiers view (non-expired)
CREATE OR REPLACE VIEW active_dossiers AS
SELECT
    id,
    entity_id,
    entity_name,
    entity_type,
    priority_score,
    tier,
    generated_at,
    expires_at,
    total_cost_usd,
    generation_time_seconds,
    cache_status
FROM entity_dossiers
WHERE expires_at > NOW()
AND cache_status IN ('FRESH', 'STALE');

-- Dossiers needing refresh view
CREATE OR REPLACE VIEW dossiers_needing_refresh AS
SELECT
    id,
    entity_id,
    entity_name,
    tier,
    cache_status,
    expires_at,
    last_accessed_at
FROM entity_dossiers
WHERE cache_status IN ('STALE', 'EXPIRED')
OR expires_at < NOW()
ORDER BY
    CASE cache_status
        WHEN 'EXPIRED' THEN 1
        WHEN 'STALE' THEN 2
        ELSE 3
    END,
    last_accessed_at ASC NULLS LAST;

-- =============================================================================
-- Sample Data (for testing)
-- =============================================================================

-- Insert sample dossier (Arsenal FC)
INSERT INTO entity_dossiers (
    entity_id,
    entity_name,
    entity_type,
    priority_score,
    tier,
    sections,
    total_cost_usd,
    generation_time_seconds,
    cache_status
) VALUES (
    'arsenal-fc',
    'Arsenal FC',
    'CLUB',
    99,
    'PREMIUM',
    '[]'::jsonb,
    0.057,
    30.0,
    'FRESH'
) ON CONFLICT (entity_id) DO NOTHING;

-- =============================================================================
-- Maintenance Queries
-- =============================================================================

-- Clean up expired dossiers older than 30 days
-- DELETE FROM entity_dossiers
-- WHERE expires_at < NOW() - INTERVAL '30 days'
-- AND last_accessed_at < NOW() - INTERVAL '30 days';

-- Clean up expired section cache
-- DELETE FROM dossier_sections_cache
-- WHERE expires_at < NOW();

-- Vacuum analyze for performance
-- VACUUM ANALYZE entity_dossiers;
-- VACUUM ANALYZE dossier_sections_cache;
-- VACUUM ANALYZE dossier_generation_jobs;
