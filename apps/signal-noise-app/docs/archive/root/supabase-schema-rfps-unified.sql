-- Unified RFP Table Schema for Signal Noise App
-- Consolidates rfps + rfp_opportunities + comprehensive data into single table
-- 
-- Migration from:
-- 1. rfps table (AI-detected RFPs from A2A system)
-- 2. rfp_opportunities table (325 comprehensive opportunities)
-- 3. comprehensiveRfpOpportunities.ts (static fallback data)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create unified rfp_opportunities table
CREATE TABLE IF NOT EXISTS rfp_opportunities_unified (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- Core RFP Information (from both tables)
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT,
  location TEXT,
  
  -- Financial Information (unified from both tables)
  estimated_value TEXT,
  currency TEXT DEFAULT 'GBP',
  value_numeric DECIMAL(12,2), -- Parsed numeric value for sorting/filtering
  
  -- Timing Information
  deadline DATE,
  published DATE, -- When opportunity was published
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Classification and Source
  source TEXT DEFAULT 'manual', -- ai-detected, comprehensive, manual, static
  source_url TEXT, -- Original URL for verification
  category TEXT DEFAULT 'general', -- digital-transformation, analytics, partnership, etc.
  subcategory TEXT, -- More specific classification
  
  -- Status and Priority (unified system)
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'detected', 'analyzing', 'qualified', 'pursuing', 'won', 'lost', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  priority_score INTEGER DEFAULT 5 CHECK (priority_score >= 1 AND priority_score <= 10),
  
  -- AI Analysis and Scoring (from rfps table)
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100), -- From rfp_opportunities
  yellow_panther_fit INTEGER CHECK (yellow_panther_fit >= 0 AND yellow_panther_fit <= 100),
  
  -- Entity and Relationship Mapping
  entity_id TEXT, -- Link to entities table for relationship mapping
  entity_name TEXT, -- Denormalized for performance
  entity_type TEXT, -- club, league, venue, etc.
  
  -- System Integration Fields
  neo4j_id TEXT, -- Link to Neo4j node for relationship queries
  batch_id TEXT, -- For tracking batch processing runs
  requirements JSONB, -- Detailed requirements and specifications
  
  -- AI and Agent Fields (from rfps table)
  agent_notes JSONB, -- AI-generated insights and analysis
  contact_info JSONB, -- Extracted contact details
  competition_info JSONB, -- Competitive landscape analysis
  
  -- Link Verification (from rfp_opportunities)
  link_status TEXT DEFAULT 'unverified' CHECK (link_status IN ('verified', 'unverified', 'broken', 'redirect')),
  link_verified_at TIMESTAMP WITH TIME ZONE,
  link_error TEXT,
  link_redirect_url TEXT,
  
  -- Metadata and Analytics
  metadata JSONB DEFAULT '{}', -- Flexible metadata storage
  tags TEXT[], -- Searchable tags array
  keywords TEXT[], -- Extracted keywords for search
  
  -- Workflow and Process
  assigned_to TEXT, -- User or team responsible for pursuing
  follow_up_date DATE, -- Next action date
  next_steps TEXT, -- Recommended next actions
  notes TEXT, -- Manual notes and updates
  
  -- Historical Data
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  conversion_stage TEXT DEFAULT 'opportunity' CHECK (conversion_stage IN ('opportunity', 'qualified', 'pursued', 'proposal', 'won', 'lost'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfp_unified_status ON rfp_opportunities_unified(status);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_source ON rfp_opportunities_unified(source);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_confidence ON rfp_opportunities_unified(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_fit ON rfp_opportunities_unified(yellow_panther_fit DESC);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_deadline ON rfp_opportunities_unified(deadline);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_detected_at ON rfp_opportunities_unified(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_priority ON rfp_opportunities_unified(priority);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_priority_score ON rfp_opportunities_unified(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_entity_id ON rfp_opportunities_unified(entity_id);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_value_numeric ON rfp_opportunities_unified(value_numeric DESC);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_category ON rfp_opportunities_unified(category);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_conversion_stage ON rfp_opportunities_unified(conversion_stage);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_link_status ON rfp_opportunities_unified(link_status);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_rfp_unified_search ON rfp_opportunities_unified USING gin(
  to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(organization, '') || ' ' || 
    COALESCE(location, '') || ' ' ||
    COALESCE(array_to_string(tags, ' '), '')
  )
);

-- Create indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_rfp_unified_agent_notes ON rfp_opportunities_unified USING gin(agent_notes);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_metadata ON rfp_opportunities_unified USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_requirements ON rfp_opportunities_unified USING gin(requirements);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rfp_unified_status_priority ON rfp_opportunities_unified(status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_source_status ON rfp_opportunities_unified(source, status);
CREATE INDEX IF NOT EXISTS idx_rfp_unified_entity_status ON rfp_opportunities_unified(entity_id, status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_rfp_unified_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rfp_unified_updated_at 
    BEFORE UPDATE ON rfp_opportunities_unified 
    FOR EACH ROW 
    EXECUTE FUNCTION update_rfp_unified_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE rfp_opportunities_unified ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (read all, insert, update)
CREATE POLICY "Users can view all unified RFPs" ON rfp_opportunities_unified
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert unified RFPs" ON rfp_opportunities_unified
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update unified RFPs" ON rfp_opportunities_unified
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create views for common use cases

-- Active RFPs (not archived or lost)
CREATE OR REPLACE VIEW active_rfp_opportunities AS
SELECT 
    id, title, organization, description, location, estimated_value, currency, value_numeric,
    deadline, published, detected_at, source, source_url, category, subcategory,
    status, priority, priority_score, confidence_score, confidence, yellow_panther_fit,
    entity_id, entity_name, entity_type, batch_id, link_status, link_verified_at,
    tags, keywords, assigned_to, follow_up_date, next_steps, conversion_stage,
    created_at, updated_at
FROM rfp_opportunities_unified 
WHERE status NOT IN ('archived', 'lost')
ORDER BY 
    CASE priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END,
    priority_score DESC,
    confidence_score DESC,
    detected_at DESC;

-- AI-Detected RFPs
CREATE OR REPLACE VIEW ai_detected_rfps AS
SELECT 
    id, title, organization, description, location, estimated_value, currency,
    deadline, detected_at, category, status, priority, priority_score,
    confidence_score, yellow_panther_fit, entity_id, entity_name, entity_type,
    agent_notes, contact_info, batch_id, neo4j_id
FROM rfp_opportunities_unified 
WHERE source = 'ai-detected'
ORDER BY detected_at DESC;

-- Comprehensive Market Opportunities
CREATE OR REPLACE VIEW comprehensive_rfp_opportunities AS
SELECT 
    id, title, organization, description, location, estimated_value, currency,
    deadline, published, source_url, category, subcategory, status, priority,
    priority_score, confidence, yellow_panther_fit, entity_id, entity_name,
    entity_type, link_status, link_verified_at, requirements, metadata, tags
FROM rfp_opportunities_unified 
WHERE source IN ('comprehensive', 'manual', 'static')
ORDER BY 
    yellow_panther_fit DESC,
    value_numeric DESC,
    deadline ASC NULLS LAST;

-- High-Priority Opportunities (fit score ≥ 80% or critical priority)
CREATE OR REPLACE VIEW high_priority_opportunities AS
SELECT 
    id, title, organization, description, location, estimated_value, currency,
    deadline, detected_at, source, category, status, priority, priority_score,
    confidence_score, yellow_panther_fit, entity_id, entity_name, entity_type,
    follow_up_date, next_steps, assigned_to
FROM rfp_opportunities_unified 
WHERE 
    (yellow_panther_fit >= 80 OR priority = 'critical' OR priority_score >= 8)
    AND status NOT IN ('archived', 'lost')
ORDER BY 
    yellow_panther_fit DESC,
    priority_score DESC,
    deadline ASC NULLS LAST;

-- Create functions for automatic priority calculation
CREATE OR REPLACE FUNCTION calculate_unified_rfp_priority(
    p_confidence DECIMAL,
    p_value DECIMAL,
    p_fit_score INTEGER,
    p_deadline DATE
) RETURNS TEXT AS $$
BEGIN
    -- Critical: High confidence (>0.8), high fit (>80%), high value (>£1M), urgent deadline (<30 days)
    IF p_confidence > 0.8 AND p_fit_score > 80 AND p_value > 1000000 AND (p_deadline - CURRENT_DATE) < 30 THEN
        RETURN 'critical';
    END IF;
    
    -- High: Good confidence (>0.7), good fit (>70%), decent value (>£500k), reasonable deadline (<60 days)
    IF p_confidence > 0.7 AND p_fit_score > 70 AND p_value > 500000 AND (p_deadline - CURRENT_DATE) < 60 THEN
        RETURN 'high';
    END IF;
    
    -- Medium: Moderate confidence (>0.6) or moderate fit (>60%)
    IF p_confidence > 0.6 OR p_fit_score > 60 THEN
        RETURN 'medium';
    END IF;
    
    -- Low: Everything else
    RETURN 'low';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate priority score (1-10)
CREATE OR REPLACE FUNCTION calculate_priority_score(
    p_confidence DECIMAL,
    p_value DECIMAL,
    p_fit_score INTEGER,
    p_deadline DATE
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 5; -- Base score
BEGIN
    -- Adjust based on confidence (0-40% impact)
    score := score + ROUND(p_confidence * 40);
    
    -- Adjust based on value (0-30% impact)
    IF p_value > 10000000 THEN  -- >£10M
        score := score + 30;
    ELSIF p_value > 1000000 THEN  -- >£1M
        score := score + 20;
    ELSIF p_value > 100000 THEN  -- >£100k
        score := score + 10;
    END IF;
    
    -- Adjust based on fit score (0-20% impact)
    score := score + ROUND(p_fit_score * 0.2);
    
    -- Urgency bonus (0-10% impact)
    IF p_deadline IS NOT NULL THEN
        IF (p_deadline - CURRENT_DATE) < 7 THEN  -- Less than 1 week
            score := score + 10;
        ELSIF (p_deadline - CURRENT_DATE) < 30 THEN  -- Less than 1 month
            score := score + 5;
        END IF;
    END IF;
    
    -- Ensure score is within bounds
    RETURN GREATEST(1, LEAST(10, score));
END;
$$ LANGUAGE plpgsql;

-- Function to parse numeric value from estimated value string
CREATE OR REPLACE FUNCTION parse_unified_numeric_value(p_value_string TEXT) 
RETURNS DECIMAL AS $$
BEGIN
    IF p_value_string IS NULL THEN
        RETURN 0;
    END IF;
    
    RETURN COALESCE(
        REGEXP_REPLACE(p_value_string, '[^0-9.]', '', 'g')::DECIMAL,
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to extract currency from value string
CREATE OR REPLACE FUNCTION extract_unified_currency(p_value_string TEXT) 
RETURNS TEXT AS $$
BEGIN
    IF p_value_string IS NULL THEN
        RETURN 'GBP';
    END IF;
    
    IF p_value_string ~ '£' THEN
        RETURN 'GBP';
    ELSIF p_value_string ~ '\$' THEN
        RETURN 'USD';
    ELSIF p_value_string ~ '€' THEN
        RETURN 'EUR';
    ELSE
        RETURN 'GBP';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically update priority based on scores
CREATE OR REPLACE FUNCTION update_rfp_priorities()
RETURNS void AS $$
BEGIN
    UPDATE rfp_opportunities_unified 
    SET 
        priority = calculate_unified_rfp_priority(confidence_score, value_numeric, yellow_panther_fit, deadline),
        priority_score = calculate_priority_score(confidence_score, value_numeric, yellow_panther_fit, deadline)
    WHERE 
        confidence_score IS NOT NULL 
        AND value_numeric IS NOT NULL
        AND yellow_panther_fit IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
-- GRANT ALL ON rfp_opportunities_unified TO authenticated;
-- GRANT SELECT ON rfp_opportunities_unified TO anon;
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT USAGE ON SCHEMA public TO anon;

-- Add comment describing the table
COMMENT ON TABLE rfp_opportunities_unified IS 'Unified RFP opportunities table consolidating AI-detected, comprehensive, and static RFP data';
COMMENT ON COLUMN rfp_opportunities_unified.source IS 'Data source: ai-detected (from A2A), comprehensive (from batch analysis), manual (user-entered), static (fallback)';
COMMENT ON COLUMN rfp_opportunities_unified.yellow_panther_fit IS 'Yellow Panther fit score (0-100%) - how well this opportunity matches our capabilities';
COMMENT ON COLUMN rfp_opportunities_unified.confidence_score IS 'AI confidence score (0-1) for AI-detected opportunities';
COMMENT ON COLUMN rfp_opportunities_unified.priority_score IS 'Priority score (1-10) calculated from multiple factors';