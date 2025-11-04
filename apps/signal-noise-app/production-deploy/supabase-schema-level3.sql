#!/bin/bash

# 🗄️ Supabase Database Schema for Level 3 Autonomous RFP System
# =============================================================

# This file creates the complete database structure needed for autonomous operation
# Apply this to your Supabase project SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types
CREATE TYPE autonomous_status AS ENUM ('active', 'paused', 'learning', 'maintenance');
CREATE TYPE agent_type AS ENUM ('monitor', 'analyzer', 'generator', 'coordinator', 'learning');
CREATE TYPE opportunity_source AS ENUM ('linkedin', 'government', 'website', 'referral', 'autonomous_discovery');
CREATE TYPE analysis_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
CREATE TYPE outreach_status AS ENUM ('pending', 'drafted', 'sent', 'followed_up', 'responded', 'closed');

-- 1. OPPORTUNITIES TABLE
-- Central table for all detected RFP opportunities
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    source opportunity_source NOT NULL,
    source_url TEXT,
    source_reference TEXT, -- Original reference from monitoring
    raw_content JSONB, -- Original scraped content
    
    -- Opportunity metadata
    organization_name TEXT,
    organization_id TEXT,
    contact_person TEXT,
    contact_email TEXT,
    submission_deadline TIMESTAMPTZ,
    budget_range TEXT,
    location TEXT,
    
    -- Autonomous system fields
    detection_confidence DECIMAL(3,2),
    fit_score DECIMAL(3,2),
    priority_level INTEGER DEFAULT 0, -- 0-100 priority scoring
    autonomous_assignment JSONB, -- Agent assignments and workflow
    
    -- Timestamps
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deadline_alert_sent_at TIMESTAMPTZ,
    
    -- Status tracking
    status TEXT DEFAULT 'detected',
    processing_stage TEXT DEFAULT 'initial',
    
    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(organization_name, '')), 'C')
    ) STORED
);

-- 2. AGENT_ACTIVITIES TABLE
-- Tracks all autonomous agent activities
CREATE TABLE agent_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type agent_type NOT NULL,
    agent_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    
    -- Activity details
    description TEXT,
    input_data JSONB,
    output_data JSONB,
    processing_time_ms INTEGER,
    
    -- Autonomous workflow
    trigger_event JSONB,
    agent_chain JSONB, -- Chain of agents involved
    autonomous_decision JSONB, -- AI-driven decisions
    
    -- Status and results
    status TEXT DEFAULT 'started',
    success BOOLEAN,
    error_message TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Relationships
    opportunity_id UUID REFERENCES opportunities(id),
    parent_activity_id UUID REFERENCES agent_activities(id)
);

-- 3. ANALYSES TABLE
-- Stores AI-powered opportunity analysis
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) NOT NULL,
    
    -- Analysis metadata
    analysis_type TEXT NOT NULL DEFAULT 'comprehensive',
    model_used TEXT,
    analysis_version TEXT DEFAULT '3.0',
    
    -- Analysis results
    fit_score DECIMAL(3,2),
    fit_reasoning JSONB,
    strengths JSONB,
    weaknesses JSONB,
    competitive_landscape JSONB,
    recommended_approach JSONB,
    
    -- Resource requirements
    required_resources JSONB,
    estimated_effort TEXT,
    success_probability DECIMAL(3,2),
    
    -- Autonomous analysis
    autonomous_insights JSONB,
    market_research JSONB,
    entity_relationships JSONB, -- Connections from Neo4j
    
    -- Status
    status analysis_status DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analysis_completed_at TIMESTAMPTZ,
    
    -- Analysis metadata
    analysis_time_ms INTEGER,
    confidence_score DECIMAL(3,2),
    
    -- Learning data
    feedback_received BOOLEAN DEFAULT FALSE,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_notes TEXT
);

-- 4. RESPONSES TABLE
-- AI-generated responses and proposals
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) NOT NULL,
    analysis_id UUID REFERENCES analyses(id),
    
    -- Response content
    response_type TEXT DEFAULT 'proposal',
    title TEXT NOT NULL,
    content TEXT,
    structured_content JSONB, -- Structured proposal data
    
    -- Generation metadata
    model_used TEXT,
    template_used TEXT,
    generation_prompt JSONB,
    
    -- Customization
    customization_level INTEGER DEFAULT 0, -- 0-100 how customized
    personalization_data JSONB,
    
    -- Autonomous generation
    autonomous_optimizations JSONB,
    ab_test_variants JSONB,
    
    -- Status
    status outreach_status DEFAULT 'draft',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    
    -- Performance tracking
    open_rate DECIMAL(3,2),
    response_rate DECIMAL(3,2),
    success_rate DECIMAL(3,2),
    
    -- Content analysis
    readability_score DECIMAL(3,2),
    sentiment_score DECIMAL(3,2),
    key_themes JSONB
);

-- 5. OUTREACH TABLE
-- Tracks all outreach activities
CREATE TABLE outreach (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) NOT NULL,
    response_id UUID REFERENCES responses(id),
    
    -- Outreach details
    outreach_type TEXT NOT NULL, -- email, call, linkedin, etc.
    target_contact TEXT,
    target_email TEXT,
    target_phone TEXT,
    
    -- Content
    subject TEXT,
    content TEXT,
    personalization_tokens JSONB,
    
    -- Autonomous coordination
    coordination_agent_id TEXT,
    scheduling_decision JSONB,
    followup_plan JSONB,
    
    -- Status tracking
    status outreach_status DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    last_followup_at TIMESTAMPTZ,
    
    -- Performance metrics
    opens INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    
    -- Engagement data
    open_times TIMESTAMPTZ[],
    click_data JSONB[],
    reply_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Learning data
    outcome TEXT,
    lessons_learned JSONB,
    feedback_score INTEGER
);

-- 6. LEARNING TABLE
-- Autonomous learning and improvement data
CREATE TABLE learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Learning metadata
    learning_type TEXT NOT NULL, -- pattern_recognition, outcome_analysis, strategy_optimization
    agent_type agent_type,
    
    -- Learning data
    input_patterns JSONB,
    successful_outcomes JSONB,
    failed_outcomes JSONB,
    
    -- Model improvements
    strategy_adjustments JSONB,
    prompt_optimizations JSONB,
    workflow_improvements JSONB,
    
    -- Performance impact
    improvement_metrics JSONB,
    confidence_boost DECIMAL(3,2),
    
    -- Autonomous learning
    learning_confidence DECIMAL(3,2),
    auto_applied BOOLEAN DEFAULT FALSE,
    human_reviewed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    learned_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    
    -- Relationships
    based_on_opportunities UUID[] REFERENCES opportunities(id),
    based_on_activities UUID[] REFERENCES agent_activities(id)
);

-- 7. SYSTEM_METRICS TABLE
-- System performance and health metrics
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Metric metadata
    metric_category TEXT NOT NULL, -- performance, health, autonomous_operations, business_impact
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(10,4),
    metric_unit TEXT,
    
    -- Context
    time_period TEXT, -- hourly, daily, weekly, monthly
    context_data JSONB,
    
    -- Autonomous system metrics
    agent_performance JSONB,
    workflow_efficiency JSONB,
    autonomous_decisions JSONB,
    
    -- Timestamps
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Trend analysis
    trend_direction TEXT, -- improving, declining, stable
    significance_level INTEGER CHECK (significance_level >= 1 AND significance_level <= 5)
);

-- 8. AUTONOMOUS_OPERATIONS TABLE
-- High-level autonomous operation tracking
CREATE TABLE autonomous_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Operation metadata
    operation_type TEXT NOT NULL, -- discovery_cycle, analysis_batch, outreach_campaign, learning_session
    operation_name TEXT NOT NULL,
    
    -- Autonomous configuration
    autonomous_config JSONB,
    agent_orchestration JSONB,
    
    -- Operation details
    objectives JSONB,
    constraints JSONB,
    success_criteria JSONB,
    
    -- Results
    outcomes JSONB,
    success BOOLEAN,
    lessons_learned JSONB,
    
    -- Status tracking
    status autonomous_status DEFAULT 'active',
    
    -- Timestamps
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Performance
    duration_ms INTEGER,
    efficiency_score DECIMAL(3,2),
    
    -- Relationships
    related_opportunities UUID[] REFERENCES opportunities(id),
    related_activities UUID[] REFERENCES agent_activities(id)
);

-- INDEXES FOR PERFORMANCE

-- Opportunities table indexes
CREATE INDEX idx_opportunities_source ON opportunities(source);
CREATE INDEX idx_opportunities_detected_at ON opportunities(detected_at DESC);
CREATE INDEX idx_opportunities_deadline ON opportunities(submission_deadline);
CREATE INDEX idx_opportunities_fit_score ON opportunities(fit_score DESC);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_search_vector ON opportunities USING GIN(search_vector);
CREATE INDEX idx_opportunities_autonomous_assignment ON opportunities USING GIN(autonomous_assignment);

-- Agent activities indexes
CREATE INDEX idx_agent_activities_agent_type ON agent_activities(agent_type);
CREATE INDEX idx_agent_activities_started_at ON agent_activities(started_at DESC);
CREATE INDEX idx_agent_activities_status ON agent_activities(status);
CREATE INDEX idx_agent_activities_opportunity_id ON agent_activities(opportunity_id);
CREATE INDEX idx_agent_activities_trigger_event ON agent_activities USING GIN(trigger_event);

-- Analyses indexes
CREATE INDEX idx_analyses_opportunity_id ON analyses(opportunity_id);
CREATE INDEX idx_analyses_fit_score ON analyses(fit_score DESC);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_analyses_completed_at ON analyses(analysis_completed_at DESC);
CREATE INDEX idx_analyses_entity_relationships ON analyses USING GIN(entity_relationships);

-- Responses indexes
CREATE INDEX idx_responses_opportunity_id ON responses(opportunity_id);
CREATE INDEX idx_responses_status ON responses(status);
CREATE INDEX idx_responses_created_at ON responses(created_at DESC);
CREATE INDEX idx_responses_ab_test_variants ON responses USING GIN(ab_test_variants);

-- Outreach indexes
CREATE INDEX idx_outreach_opportunity_id ON outreach(opportunity_id);
CREATE INDEX idx_outreach_status ON outreach(status);
CREATE INDEX idx_outreach_sent_at ON outreach(sent_at DESC);
CREATE INDEX idx_outreach_outcome ON outreach(outcome);

-- Learning indexes
CREATE INDEX idx_learning_learning_type ON learning(learning_type);
CREATE INDEX idx_learning_agent_type ON learning(agent_type);
CREATE INDEX idx_learning_learned_at ON learning(learned_at DESC);
CREATE INDEX idx_learning_auto_applied ON learning(auto_applied);

-- System metrics indexes
CREATE INDEX idx_system_metrics_category ON system_metrics(metric_category);
CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);
CREATE INDEX idx_system_metrics_agent_performance ON system_metrics USING GIN(agent_performance);

-- Autonomous operations indexes
CREATE INDEX idx_autonomous_operations_type ON autonomous_operations(operation_type);
CREATE INDEX idx_autonomous_operations_status ON autonomous_operations(status);
CREATE INDEX idx_autonomous_operations_initiated_at ON autonomous_operations(initiated_at DESC);

-- RLS (Row Level Security) Policies
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_operations ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (customize based on your auth requirements)
CREATE POLICY "Allow full access to authenticated users" ON opportunities
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to authenticated users" ON agent_activities
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to authenticated users" ON analyses
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to authenticated users" ON responses
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to authenticated users" ON outreach
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to authenticated users" ON learning
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to authenticated users" ON system_metrics
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to authenticated users" ON autonomous_operations
    FOR ALL USING (auth.role() = 'authenticated');

-- FUNCTIONS FOR AUTONOMOUS OPERATIONS

-- Function to update search vector when opportunity changes
CREATE OR REPLACE FUNCTION update_opportunity_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.organization_name, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_opportunity_search_vector
    BEFORE INSERT OR UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION update_opportunity_search_vector();

-- Function to record system metrics automatically
CREATE OR REPLACE FUNCTION record_system_metric(
    p_category TEXT,
    p_name TEXT,
    p_value DECIMAL,
    p_unit TEXT DEFAULT NULL,
    p_context JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    metric_id UUID;
BEGIN
    INSERT INTO system_metrics (
        metric_category,
        metric_name,
        metric_value,
        metric_unit,
        context_data
    ) VALUES (
        p_category,
        p_name,
        p_value,
        p_unit,
        p_context
    ) RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get autonomous system status
CREATE OR REPLACE FUNCTION get_autonomous_system_status()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_opportunities', (SELECT COUNT(*) FROM opportunities),
        'active_opportunities', (SELECT COUNT(*) FROM opportunities WHERE status NOT IN ('closed', 'rejected')),
        'agents_active', (SELECT COUNT(DISTINCT agent_id) FROM agent_activities WHERE status = 'started'),
        'pending_analyses', (SELECT COUNT(*) FROM analyses WHERE status = 'pending'),
        'ready_outreach', (SELECT COUNT(*) FROM responses WHERE status = 'draft'),
        'learning_insights', (SELECT COUNT(*) FROM learning WHERE learned_at > NOW() - INTERVAL '24 hours'),
        'system_health', (SELECT AVG(metric_value) FROM system_metrics WHERE metric_category = 'health' AND recorded_at > NOW() - INTERVAL '1 hour')
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to initiate autonomous discovery cycle
CREATE OR REPLACE FUNCTION initiate_autonomous_discovery()
RETURNS UUID AS $$
DECLARE
    operation_id UUID;
BEGIN
    INSERT INTO autonomous_operations (
        operation_type,
        operation_name,
        autonomous_config,
        objectives,
        status
    ) VALUES (
        'discovery_cycle',
        'Autonomous RFP Discovery Cycle',
        '{"agents": ["linkedin_monitor", "government_monitor"], "duration": "1h"}'::jsonb,
        '["Discover new RFP opportunities", "Analyze fit scores", "Prioritize for action"]'::jsonb,
        'active'
    ) RETURNING id INTO operation_id;
    
    -- Trigger agent activities (this would be handled by your application code)
    -- You would call your agent orchestration system here
    
    RETURN operation_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE opportunities IS 'Central repository for all detected RFP opportunities and procurement leads';
COMMENT ON TABLE agent_activities IS 'Tracks all autonomous agent activities and their interactions';
COMMENT ON TABLE analyses IS 'AI-powered analysis of opportunities with fit scoring and recommendations';
COMMENT ON TABLE responses IS 'AI-generated responses, proposals, and outreach content';
COMMENT ON TABLE outreach IS 'Tracks all outreach activities and their performance metrics';
COMMENT ON TABLE learning IS 'Autonomous learning data for continuous system improvement';
COMMENT ON TABLE system_metrics IS 'System performance metrics and health monitoring data';
COMMENT ON TABLE autonomous_operations IS 'High-level autonomous operation tracking and orchestration';

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Level 3 Autonomous RFP System database schema created successfully!';
    RAISE NOTICE 'Tables: opportunities, agent_activities, analyses, responses, outreach, learning, system_metrics, autonomous_operations';
    RAISE NOTICE 'Ready for autonomous agent operations!';
END $$;