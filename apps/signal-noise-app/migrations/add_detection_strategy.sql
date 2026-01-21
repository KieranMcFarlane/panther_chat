-- Migration: Add detection_strategy column for A/B/C testing
-- Created: 2025-11-09
-- Purpose: Track which search strategy (perplexity/linkedin/brightdata) found each RFP

-- Add detection_strategy column
ALTER TABLE rfp_opportunities 
ADD COLUMN IF NOT EXISTS detection_strategy TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_detection_strategy 
ON rfp_opportunities(detection_strategy);

-- Add comment for documentation
COMMENT ON COLUMN rfp_opportunities.detection_strategy IS 
'Search strategy that discovered this RFP: perplexity, linkedin, or brightdata';

-- Add found_by_strategies column for deduplication tracking
ALTER TABLE rfp_opportunities
ADD COLUMN IF NOT EXISTS found_by_strategies JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN rfp_opportunities.found_by_strategies IS 
'Array of all strategies that found this RFP (for overlap analysis): ["perplexity", "linkedin"]';

-- Create GIN index for JSONB array queries
CREATE INDEX IF NOT EXISTS idx_found_by_strategies 
ON rfp_opportunities USING GIN (found_by_strategies);











