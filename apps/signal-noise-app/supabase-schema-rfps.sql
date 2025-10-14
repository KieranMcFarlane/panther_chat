-- Supabase RFP Table Schema for A2A Automation System
-- This schema stores detected RFP opportunities for display in /tenders

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create rfps table
CREATE TABLE IF NOT EXISTS rfps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- Core RFP Information
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  entity_id TEXT, -- Link to entities table for relationship mapping
  description TEXT,
  
  -- Financial Information
  estimated_value TEXT,
  currency TEXT DEFAULT 'GBP',
  value_numeric DECIMAL(12,2), -- Parsed numeric value for sorting/filtering
  
  -- Timing Information
  deadline DATE,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Classification
  source TEXT DEFAULT 'a2a-automation', -- a2a-automation, linkedin, manual, etc.
  category TEXT DEFAULT 'general', -- digital-transformation, analytics, partnership, etc.
  status TEXT DEFAULT 'detected', -- detected, analyzing, pursued, won, lost, archived
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  
  -- AI Analysis
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  agent_notes JSONB, -- AI-generated insights and analysis
  contact_info JSONB, -- Extracted contact details
  
  -- System Information
  batch_id TEXT, -- For tracking batch processing runs
  neo4j_id TEXT, -- Link to Neo4j node for relationship queries
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfps_status ON rfps(status);
CREATE INDEX IF NOT EXISTS idx_rfps_confidence ON rfps(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_rfps_deadline ON rfps(deadline);
CREATE INDEX IF NOT EXISTS idx_rfps_detected_at ON rfps(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfps_priority ON rfps(priority);
CREATE INDEX IF NOT EXISTS idx_rfps_entity_id ON rfps(entity_id);
CREATE INDEX IF NOT EXISTS idx_rfps_source ON rfps(source);
CREATE INDEX IF NOT EXISTS idx_rfps_value_numeric ON rfps(value_numeric DESC);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_rfts_search ON rfps USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || organization));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rfps_updated_at 
    BEFORE UPDATE ON rfps 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE rfps ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (read all, insert)
CREATE POLICY "Users can view all RFPs" ON rfps
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert RFPs" ON rfps
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update RFPs" ON rfps
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create a view for active RFPs (not archived or lost)
CREATE OR REPLACE VIEW active_rfps AS
SELECT 
    id,
    title,
    organization,
    entity_id,
    description,
    estimated_value,
    currency,
    value_numeric,
    deadline,
    source,
    category,
    status,
    priority,
    confidence_score,
    agent_notes,
    contact_info,
    batch_id,
    detected_at,
    created_at,
    updated_at
FROM rfps 
WHERE status NOT IN ('archived', 'lost')
ORDER BY 
    CASE priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END,
    confidence_score DESC,
    detected_at DESC;

-- Create a function to calculate RFP priority automatically
CREATE OR REPLACE FUNCTION calculate_rfp_priority(
    p_confidence DECIMAL,
    p_value DECIMAL,
    p_deadline DATE
) RETURNS TEXT AS $$
BEGIN
    -- Critical: High confidence (>0.8), high value (>£1M), urgent deadline (<30 days)
    IF p_confidence > 0.8 AND p_value > 1000000 AND (p_deadline - CURRENT_DATE) < 30 THEN
        RETURN 'critical';
    END IF;
    
    -- High: Good confidence (>0.7), decent value (>£500k), reasonable deadline (<60 days)
    IF p_confidence > 0.7 AND p_value > 500000 AND (p_deadline - CURRENT_DATE) < 60 THEN
        RETURN 'high';
    END IF;
    
    -- Medium: Moderate confidence (>0.6), any value
    IF p_confidence > 0.6 THEN
        RETURN 'medium';
    END IF;
    
    -- Low: Everything else
    RETURN 'low';
END;
$$ LANGUAGE plpgsql;

-- Create a function to parse numeric value from estimated value string
CREATE OR REPLACE FUNCTION parse_numeric_value(p_value_string TEXT) 
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

-- Create a function to extract currency from value string
CREATE OR REPLACE FUNCTION extract_currency(p_value_string TEXT) 
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

-- Sample data for testing (optional)
-- INSERT INTO rfps (title, organization, description, estimated_value, deadline, confidence_score, category) VALUES
-- ('Digital Transformation Platform', 'Premier League', 'Comprehensive digital platform for fan engagement and analytics', '£2.5M', '2025-03-15', 0.92, 'digital-transformation'),
-- ('Analytics Partnership', 'Formula 1', 'Advanced data analytics and performance monitoring system', '£1.8M', '2025-04-30', 0.87, 'analytics');

-- Grant permissions
-- GRANT ALL ON rfps TO authenticated;
-- GRANT SELECT ON rfps TO anon;
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT USAGE ON SCHEMA public TO anon;