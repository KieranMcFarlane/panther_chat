-- Migration: Add Temporal Intelligence Tables
-- Run this in your Supabase SQL Editor
-- https://app.supabase.com/project/itlcuazbybqlkicsaola/sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create temporal_episodes table for tracking events over time
CREATE TABLE IF NOT EXISTS temporal_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    episode_type TEXT NOT NULL, -- RFP_DETECTED, PARTNERSHIP_FORMED, PARTNERSHIP_ENDED, etc.
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT,
    source TEXT,
    url TEXT,
    category TEXT,
    estimated_value NUMERIC,
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_entity_id ON temporal_episodes(entity_id);
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_entity_name ON temporal_episodes(entity_name);
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_timestamp ON temporal_episodes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_type ON temporal_episodes(episode_type);
CREATE INDEX IF NOT EXISTS idx_temporal_episodes_category ON temporal_episodes(category);

-- Create table for temporal fit analysis cache
CREATE TABLE IF NOT EXISTS temporal_fit_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id TEXT NOT NULL,
    rfp_id TEXT NOT NULL,
    rfp_category TEXT,
    fit_score NUMERIC NOT NULL CHECK (fit_score >= 0 AND fit_score <= 1),
    confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    trend_data JSONB DEFAULT '{}'::jsonb,
    key_factors JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    time_horizon_days INTEGER DEFAULT 90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(entity_id, rfp_id)
);

CREATE INDEX IF NOT EXISTS idx_temporal_fit_entity_rfp ON temporal_fit_cache(entity_id, rfp_id);
CREATE INDEX IF NOT EXISTS idx_temporal_fit_score ON temporal_fit_cache(fit_score);

-- Create RFP tracking table
CREATE TABLE IF NOT EXISTS rfp_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfp_id TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    organization TEXT NOT NULL,
    status TEXT DEFAULT 'detected', -- detected, analyzing, contacted, won, lost
    source TEXT,
    url TEXT,
    category TEXT,
    estimated_value NUMERIC,
    detection_confidence NUMERIC,
    temporal_fit_score NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfp_tracking_org ON rfp_tracking(organization);
CREATE INDEX IF NOT EXISTS idx_rfp_tracking_status ON rfp_tracking(status);
CREATE INDEX IF NOT EXISTS idx_rfp_tracking_category ON rfp_tracking(category);

-- Helper function to get entity timeline
CREATE OR REPLACE FUNCTION get_entity_timeline(
    p_entity_id TEXT,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    timestamp TIMESTAMPTZ,
    episode_type TEXT,
    description TEXT,
    source TEXT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.timestamp,
        te.episode_type,
        te.description,
        te.source,
        te.metadata
    FROM temporal_episodes te
    WHERE te.entity_id = p_entity_id
       OR te.entity_name = p_entity_id
    ORDER BY te.timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Helper function to calculate temporal fit score
CREATE OR REPLACE FUNCTION calculate_temporal_fit(
    p_entity_id TEXT,
    p_rfp_category TEXT DEFAULT NULL,
    p_time_horizon INTEGER DEFAULT 90
) RETURNS TABLE (
    fit_score NUMERIC,
    confidence NUMERIC,
    rfp_count BIGINT,
    last_activity TIMESTAMPTZ
) AS $$
DECLARE
    v_rfp_count BIGINT;
    v_last_activity TIMESTAMPTZ;
    v_score NUMERIC;
    v_confidence NUMERIC;
BEGIN
    -- Count recent RFP activity for this entity
    SELECT
        COUNT(*),
        MAX(timestamp)
    INTO v_rfp_count, v_last_activity
    FROM temporal_episodes
    WHERE entity_id = p_entity_id
       OR entity_name = p_entity_id
       AND episode_type = 'RFP_DETECTED'
       AND timestamp > NOW() - (p_time_horizon || ' days')::INTERVAL;

    -- Calculate base score
    v_score := 0.5;

    IF v_rfp_count > 0 THEN
        v_score := v_score + LEAST(0.3, v_rfp_count * 0.1);
    END IF;

    -- Confidence based on data availability
    IF v_rfp_count >= 3 THEN
        v_confidence := 0.8;
    ELSIF v_rfp_count > 0 THEN
        v_confidence := 0.6;
    ELSE
        v_confidence := 0.4;
    END IF;

    RETURN QUERY
    SELECT v_score, v_confidence, v_rfp_count, v_last_activity;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to temporal_episodes
DROP TRIGGER IF EXISTS update_temporal_episodes_updated_at ON temporal_episodes;
CREATE TRIGGER update_temporal_episodes_updated_at
    BEFORE UPDATE ON temporal_episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Apply the trigger to temporal_fit_cache
DROP TRIGGER IF EXISTS update_temporal_fit_cache_updated_at ON temporal_fit_cache;
CREATE TRIGGER update_temporal_fit_cache_updated_at
    BEFORE UPDATE ON temporal_fit_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Apply the trigger to rfp_tracking
DROP TRIGGER IF EXISTS update_rfp_tracking_updated_at ON rfp_tracking;
CREATE TRIGGER update_rfp_tracking_updated_at
    BEFORE UPDATE ON rfp_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
