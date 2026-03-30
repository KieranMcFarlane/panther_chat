/**
 * 🗄️ Supabase Schema for Level 3 Autonomous RFP System
 * Complete database structure for autonomous operation
 */

-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Opportunities Table - Core RFP data
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    organization TEXT NOT NULL,
    description TEXT,
    value TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    category TEXT,
    source TEXT,
    status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'analyzing', 'analyzed', 'responding', 'responded', 'won', 'lost', 'rejected')),
    fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
    confidence_level INTEGER CHECK (confidence_level >= 0 AND confidence_level <= 100),
    discovery_agent_id TEXT,
    neo4j_node_id TEXT,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agent Activities Table - Complete agent logging
CREATE TABLE IF NOT EXISTS agent_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('task', 'result', 'error', 'learning', 'communication')),
    message JSONB NOT NULL,
    context_id TEXT,
    related_opportunity_id UUID REFERENCES opportunities(id),
    duration_ms INTEGER,
    success BOOLEAN,
    mcp_tools_used TEXT[],
    learning_insights JSONB,
    error_details JSONB,
    performance_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Analyses Table - RFP analysis results
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    analysis_agent_id TEXT NOT NULL,
    fit_score INTEGER NOT NULL CHECK (fit_score >= 0 AND fit_score <= 100),
    confidence_level INTEGER NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 100),
    strategic_value INTEGER CHECK (strategic_value >= 0 AND strategic_value <= 100),
    risk_assessment JSONB,
    competitive_analysis JSONB,
    technical_requirements JSONB,
    recommended_actions TEXT[],
    market_analysis JSONB,
    full_analysis JSONB NOT NULL,
    learning_applied JSONB,
    analysis_version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Responses Table - Generated proposals and communications
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES analyses(id),
    response_agent_id TEXT NOT NULL,
    response_type TEXT NOT NULL CHECK (response_type IN ('proposal', 'email', 'timeline', 'follow_up')),
    title TEXT,
    content TEXT NOT NULL,
    structure JSONB,
    personalization_factors JSONB,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    auto_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    response_status TEXT DEFAULT 'draft' CHECK (response_status IN ('draft', 'approved', 'sent', 'replied', 'rejected')),
    human_review_required BOOLEAN DEFAULT TRUE,
    human_reviewed_by TEXT,
    human_review_notes TEXT,
    a_b_test_group TEXT,
    performance_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Outreach Table - Communication tracking and coordination
CREATE TABLE IF NOT EXISTS outreach (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    response_id UUID REFERENCES responses(id),
    coordinator_agent_id TEXT NOT NULL,
    stakeholder_info JSONB NOT NULL,
    outreach_method TEXT NOT NULL CHECK (outreach_method IN ('email', 'linkedin', 'phone', 'video_call', 'in_person')),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'delivered', 'opened', 'replied', 'meeting_set', 'converted', 'rejected')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    follow_up_count INTEGER DEFAULT 0,
    next_action_date TIMESTAMP WITH TIME ZONE,
    conversation_context JSONB,
    response_content TEXT,
    learning_outcomes JSONB,
    success_probability INTEGER CHECK (success_probability >= 0 AND success_probability <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Learning Table - Agent improvement and pattern recognition
CREATE TABLE IF NOT EXISTS learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL,
    learning_type TEXT NOT NULL CHECK (learning_type IN ('success_pattern', 'failure_insight', 'optimization', 'strategy_adjustment', 'pattern_recognition')),
    trigger_event TEXT NOT NULL CHECK (trigger_event IN ('opportunity_won', 'proposal_rejected', 'meeting_scheduled', 'feedback_received', 'performance_threshold_met')),
    opportunity_id UUID REFERENCES opportunities(id),
    before_state JSONB NOT NULL,
    after_state JSONB NOT NULL,
    confidence_improvement NUMERIC,
    pattern_recognition JSONB,
    success_factors TEXT[],
    failure_factors TEXT[],
    optimization_suggestions JSONB,
    applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP WITH TIME ZONE,
    effectiveness_score INTEGER CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. System Metrics Table - Performance and efficiency tracking
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type TEXT NOT NULL CHECK (metric_type IN ('performance', 'efficiency', 'quality', 'cost', 'learning', 'autonomy')),
    metric_name TEXT NOT NULL,
    value NUMERIC NOT NULL,
    baseline NUMERIC,
    improvement_percentage NUMERIC,
    time_period TEXT NOT NULL CHECK (time_period IN ('hourly', 'daily', 'weekly', 'monthly', 'quarterly')),
    agent_id TEXT,
    context_data JSONB,
    target_value NUMERIC,
    achieved_target BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Autonomous Operations Log - Complete autonomy tracking
CREATE TABLE IF NOT EXISTS autonomous_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('discovery', 'analysis', 'response_generation', 'outreach', 'learning', 'optimization')),
    initiating_agent_id TEXT NOT NULL,
    operation_data JSONB NOT NULL,
    decision_process JSONB,
    human_intervention BOOLEAN DEFAULT FALSE,
    human_intervention_reason TEXT,
    human_intervention_agent TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'partial_success', 'failure', 'human_corrected')),
    autonomous_confidence INTEGER CHECK (autonomous_confidence >= 0 AND autonomous_confidence <= 100),
    learning_gained JSONB,
    cost_impact NUMERIC,
    time_impact_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_organization ON opportunities(organization);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_fit_score ON opportunities(fit_score);

CREATE INDEX IF NOT EXISTS idx_agent_activities_agent_id ON agent_activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_context_id ON agent_activities(context_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_created_at ON agent_activities(created_at);

CREATE INDEX IF NOT EXISTS idx_analyses_opportunity_id ON analyses(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_analyses_fit_score ON analyses(fit_score);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);

CREATE INDEX IF NOT EXISTS idx_responses_opportunity_id ON responses(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(response_status);
CREATE INDEX IF NOT EXISTS idx_responses_sent_at ON responses(sent_at);

CREATE INDEX IF NOT EXISTS idx_outreach_opportunity_id ON outreach(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status);
CREATE INDEX IF NOT EXISTS idx_outreach_scheduled_at ON outreach(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_learning_agent_id ON learning(agent_id);
CREATE INDEX IF NOT EXISTS idx_learning_applied ON learning(applied);
CREATE INDEX IF NOT EXISTS idx_learning_created_at ON learning(created_at);

CREATE INDEX IF NOT EXISTS idx_system_metrics_type_period ON system_metrics(metric_type, time_period);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON system_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_autonomous_operations_type ON autonomous_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_autonomous_operations_outcome ON autonomous_operations(outcome);
CREATE INDEX IF NOT EXISTS idx_autonomous_operations_created_at ON autonomous_operations(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_operations ENABLE ROW LEVEL SECURITY;

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_outreach_updated_at BEFORE UPDATE ON outreach FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate agent performance metrics
CREATE OR REPLACE FUNCTION calculate_agent_performance(agent_id_param TEXT)
RETURNS TABLE (
    total_tasks INTEGER,
    success_rate NUMERIC,
    avg_duration_ms INTEGER,
    learning_events INTEGER,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_tasks,
        (COUNT(*) FILTER (WHERE success = true)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 as success_rate,
        AVG(duration_ms)::INTEGER as avg_duration_ms,
        COUNT(*) FILTER (WHERE activity_type = 'learning')::INTEGER as learning_events,
        MAX(created_at) as last_activity
    FROM agent_activities 
    WHERE agent_id = agent_id_param
    AND created_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get opportunity pipeline metrics
CREATE OR REPLACE FUNCTION get_opportunity_pipeline_metrics()
RETURNS TABLE (
    stage TEXT,
    count INTEGER,
    total_value NUMERIC,
    avg_fit_score NUMERIC,
    conversion_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        status as stage,
        COUNT(*)::INTEGER as count,
        COALESCE(SUM(
            CASE 
                WHEN value ~ '^[£$€0-9,.-]+$' THEN 
                    CAST(REPLACE(REPLACE(REPLACE(REPLACE(value, '£', ''), '$', ''), '€', ''), ',', '') AS NUMERIC)
                ELSE 0 
            END
        ), 0) as total_value,
        AVG(fit_score) as avg_fit_score,
        CASE 
            WHEN status = 'responded' THEN 
                (COUNT(*) FILTER (WHERE status = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100
            ELSE NULL
        END as conversion_rate
    FROM opportunities 
    WHERE created_at >= NOW() - INTERVAL '90 days'
    GROUP BY status
    ORDER BY 
        CASE status 
            WHEN 'discovered' THEN 1
            WHEN 'analyzing' THEN 2
            WHEN 'analyzed' THEN 3
            WHEN 'responding' THEN 4
            WHEN 'responded' THEN 5
            WHEN 'won' THEN 6
            WHEN 'lost' THEN 7
            WHEN 'rejected' THEN 8
        END;
END;
$$ LANGUAGE plpgsql;