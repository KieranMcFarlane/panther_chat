-- RFP Table Migration Script
-- Migrates data from rfps and rfp_opportunities tables to rfp_opportunities_unified
-- 
-- This script:
-- 1. Creates backups of existing tables
-- 2. Migrates data from rfps table (AI-detected RFPs)
-- 3. Migrates data from rfp_opportunities table (comprehensive opportunities)
-- 4. Validates data integrity
-- 5. Updates priorities and scores

BEGIN;

-- Step 0: Create backups (safety first)
CREATE TABLE IF NOT EXISTS rfps_backup_YYYYMMDD AS 
SELECT * FROM rfps WHERE 1=0;

CREATE TABLE IF NOT EXISTS rfp_opportunities_backup_YYYYMMDD AS 
SELECT * FROM rfp_opportunities WHERE 1=0;

-- Insert current data into backups
INSERT INTO rfps_backup_YYYYMMDD SELECT * FROM rfps;
INSERT INTO rfp_opportunities_backup_YYYYMMDD SELECT * FROM rfp_opportunities;

-- Log migration start
DO $$
BEGIN
    RAISE NOTICE 'Starting RFP table migration at %', NOW();
    RAISE NOTICE 'Backups created: rfps_backup_YYYYMMDD, rfp_opportunities_backup_YYYYMMDD';
END $$;

-- Step 1: Migrate data from rfps table (AI-detected RFPs)
INSERT INTO rfp_opportunities_unified (
    title,
    organization,
    description,
    location,
    estimated_value,
    currency,
    value_numeric,
    deadline,
    detected_at,
    source,
    source_url,
    category,
    status,
    priority,
    priority_score,
    confidence_score,
    yellow_panther_fit,
    entity_id,
    entity_name,
    entity_type,
    neo4j_id,
    batch_id,
    agent_notes,
    contact_info,
    competition_info,
    requirements,
    metadata,
    tags,
    keywords,
    link_status,
    link_verified_at,
    link_error,
    link_redirect_url,
    created_at,
    updated_at,
    notes
)
SELECT 
    r.title,
    r.organization,
    r.description,
    COALESCE(r.location, 'Unknown'), -- rfps table may not have location
    r.estimated_value,
    COALESCE(r.currency, 'GBP'),
    r.value_numeric,
    r.deadline,
    r.detected_at,
    'ai-detected' as source, -- Mark as AI-detected
    NULL as source_url, -- rfps table doesn't have source_url
    COALESCE(r.category, 'general'),
    r.status,
    r.priority,
    -- Calculate priority score from existing data
    CASE 
        WHEN r.priority = 'critical' THEN 10
        WHEN r.priority = 'high' THEN 8
        WHEN r.priority = 'medium' THEN 5
        WHEN r.priority = 'low' THEN 3
        ELSE 5
    END as priority_score,
    r.confidence_score,
    -- Calculate yellow_panther_fit from confidence if not present
    COALESCE(ROUND(r.confidence_score * 100), 50) as yellow_panther_fit,
    r.entity_id,
    NULL as entity_name, -- Will need to be populated from entity table
    NULL as entity_type, -- Will need to be populated from entity table
    r.neo4j_id,
    r.batch_id,
    r.agent_notes,
    r.contact_info,
    r.competition_info,
    NULL as requirements, -- rfps table doesn't have this
    COALESCE(r.agent_notes, '{}') as metadata,
    ARRAY[]::text[] as tags, -- Empty tags for now
    ARRAY[]::text[] as keywords, -- Empty keywords for now
    'unverified' as link_status, -- Default for AI-detected
    NULL as link_verified_at,
    NULL as link_error,
    NULL as link_redirect_url,
    r.created_at,
    r.updated_at,
    NULL as notes
FROM rfps r;

-- Log rfps migration
DO $$
DECLARE
    rfps_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rfps_count FROM rfps;
    RAISE NOTICE 'Migrated % rows from rfps table at %', rfps_count, NOW();
END $$;

-- Step 2: Migrate data from rfp_opportunities table (comprehensive opportunities)
INSERT INTO rfp_opportunities_unified (
    title,
    organization,
    description,
    location,
    estimated_value,
    currency,
    value_numeric,
    deadline,
    published,
    detected_at,
    source,
    source_url,
    category,
    subcategory,
    status,
    priority,
    priority_score,
    confidence_score,
    confidence,
    yellow_panther_fit,
    entity_id,
    entity_name,
    entity_type,
    requirements,
    metadata,
    tags,
    keywords,
    link_status,
    link_verified_at,
    link_error,
    link_redirect_url,
    created_at,
    updated_at,
    notes
)
SELECT 
    ro.title,
    ro.organization,
    ro.description,
    ro.location,
    ro.value as estimated_value,
    'GBP' as currency, -- Default to GBP for comprehensive opportunities
    -- Parse numeric value from the value field
    CASE 
        WHEN ro.value ~ 'M' THEN (REGEXP_REPLACE(ro.value, '[^0-9.]', '', 'g')::DECIMAL) * 1000000
        WHEN ro.value ~ 'K' THEN (REGEXP_REPLACE(ro.value, '[^0-9.]', '', 'g')::DECIMAL) * 1000
        ELSE COALESCE(REGEXP_REPLACE(ro.value, '[^0-9.]', '', 'g')::DECIMAL, 0)
    END as value_numeric,
    ro.deadline,
    ro.published,
    ro.detected_at,
    'comprehensive' as source, -- Mark as comprehensive
    ro.source_url,
    ro.category,
    NULL as subcategory, -- rfp_opportunities doesn't have subcategory
    ro.status,
    -- Calculate priority from yellow_panther_fit
    CASE 
        WHEN ro.yellow_panther_fit >= 90 THEN 'critical'
        WHEN ro.yellow_panther_fit >= 75 THEN 'high'
        WHEN ro.yellow_panther_fit >= 60 THEN 'medium'
        ELSE 'low'
    END as priority,
    -- Calculate priority score from fit score
    COALESCE(ROUND(ro.yellow_panther_fit / 10), 5) as priority_score,
    NULL as confidence_score, -- Not applicable for comprehensive opportunities
    ro.confidence,
    ro.yellow_panther_fit,
    ro.entity_id,
    ro.entity_name,
    'Unknown' as entity_type, -- Will need to be populated
    ro.requirements,
    ro.metadata,
    ARRAY[]::text[] as tags, -- Will need to be populated from metadata
    ARRAY[]::text[] as keywords, -- Will need to be populated from metadata
    ro.link_status,
    ro.link_verified_at,
    ro.link_error,
    ro.link_redirect_url,
    ro.created_at,
    ro.updated_at,
    NULL as notes
FROM rfp_opportunities ro;

-- Log rfp_opportunities migration
DO $$
DECLARE
    rfp_opps_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rfp_opps_count FROM rfp_opportunities;
    RAISE NOTICE 'Migrated % rows from rfp_opportunities table at %', rfp_opps_count, NOW();
END $$;

-- Step 3: Update entity names and types from cached_entities table
UPDATE rfp_opportunities_unified 
SET 
    entity_name = ce.properties->>'name',
    entity_type = CASE 
        WHEN 'Entity' = ANY(ce.labels) THEN 
            CASE 
                WHEN ce.properties->>'type' IS NOT NULL THEN ce.properties->>'type'
                WHEN ce.properties->>'entityType' IS NOT NULL THEN ce.properties->>'entityType'
                ELSE 'Unknown'
            END
        ELSE 'Unknown'
    END
FROM cached_entities ce 
WHERE rfp_opportunities_unified.entity_id = ce.neo4j_id;

-- Step 4: Populate tags and keywords from metadata and descriptions
UPDATE rfp_opportunities_unified 
SET 
    tags = CASE 
        WHEN metadata->>'tags' IS NOT NULL THEN 
            CASE 
                WHEN jsonb_typeof(metadata->>'tags') = 'array' THEN 
                    (SELECT ARRAY_AGG(trim(value)) FROM jsonb_array_elements_text(metadata->'tags'))
                ELSE 
                    ARRAY[trim(metadata->>'tags')]
            END
        WHEN metadata->>'keywords' IS NOT NULL THEN 
            CASE 
                WHEN jsonb_typeof(metadata->>'keywords') = 'array' THEN 
                    (SELECT ARRAY_AGG(trim(value)) FROM jsonb_array_elements_text(metadata->'keywords'))
                ELSE 
                    ARRAY[trim(metadata->>'keywords')]
            END
        ELSE ARRAY[]::text[]
    END,
    keywords = CASE 
        WHEN description IS NOT NULL THEN 
            regexp_split_to_array(lower(regexp_replace(description, '[^\w\s]', ' ', 'g')), '\s+')
        ELSE ARRAY[]::text[]
    END
WHERE 
    (metadata->>'tags' IS NOT NULL OR metadata->>'keywords' IS NOT NULL OR description IS NOT NULL)
    AND (tags = '{}' OR keywords = '{}' OR tags IS NULL OR keywords IS NULL);

-- Step 5: Update calculated priorities and scores
SELECT update_rfp_priorities();

-- Step 6: Populate conversion_stage based on status
UPDATE rfp_opportunities_unified 
SET conversion_stage = CASE 
    WHEN status IN ('new', 'detected', 'analyzing') THEN 'opportunity'
    WHEN status = 'qualified' THEN 'qualified'
    WHEN status = 'pursuing' THEN 'pursued'
    WHEN status = 'won' THEN 'won'
    WHEN status = 'lost' THEN 'lost'
    ELSE 'opportunity'
END;

-- Step 7: Update view counts and tracking (initialize to 0)
UPDATE rfp_opportunities_unified 
SET 
    view_count = COALESCE(view_count, 0),
    last_viewed_at = NULL
WHERE view_count IS NULL OR last_viewed_at IS NULL;

-- Step 8: Create migration log entry
INSERT INTO system_logs (timestamp, level, category, source, message, data)
VALUES (
    NOW(),
    'info',
    'database',
    'rfp-migration',
    'Completed RFP table migration to unified structure',
    jsonb_build_object(
        'rfps_migrated', (SELECT COUNT(*) FROM rfps),
        'rfp_opportunities_migrated', (SELECT COUNT(*) FROM rfp_opportunities),
        'total_unified', (SELECT COUNT(*) FROM rfp_opportunities_unified),
        'ai_detected_count', (SELECT COUNT(*) FROM rfp_opportunities_unified WHERE source = 'ai-detected'),
        'comprehensive_count', (SELECT COUNT(*) FROM rfp_opportunities_unified WHERE source = 'comprehensive'),
        'migration_completed_at', NOW()
    )
);

-- Commit the transaction
COMMIT;

-- Log completion
DO $$
DECLARE
    total_unified INTEGER;
    ai_detected INTEGER;
    comprehensive INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_unified FROM rfp_opportunities_unified;
    SELECT COUNT(*) INTO ai_detected FROM rfp_opportunities_unified WHERE source = 'ai-detected';
    SELECT COUNT(*) INTO comprehensive FROM rfp_opportunities_unified WHERE source = 'comprehensive';
    
    RAISE NOTICE 'RFP Migration completed successfully at %', NOW();
    RAISE NOTICE 'Total unified records: %', total_unified;
    RAISE NOTICE 'AI-detected records: %', ai_detected;
    RAISE NOTICE 'Comprehensive records: %', comprehensive;
    RAISE NOTICE 'Migration finished. You can now test the unified table.';
END $$;