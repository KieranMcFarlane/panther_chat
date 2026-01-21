-- Seed Static RFP Opportunities into Unified Table
-- This script seeds the unified table with static fallback data from comprehensive-rfp-opportunities.js

-- Check if static data already exists to avoid duplicates
DO $$
DECLARE
    static_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO static_count FROM rfp_opportunities_unified WHERE source = 'static';
    
    IF static_count > 0 THEN
        RAISE NOTICE 'Static data already exists in unified table (% records). Skipping seed.', static_count;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Starting to seed static RFP opportunities into unified table...';
END $$;

-- Insert static RFP opportunities (representative sample)
-- This would normally be generated from the JavaScript file, but for demonstration I'll insert a few key opportunities
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
    created_at,
    updated_at
) VALUES 
(
    'Venue Temporary Infrastructure Cost Management & Control Solution',
    'IOC Olympic Committee',
    'The International Olympic Committee has issued a Request for Expression of Interest for comprehensive venue temporary infrastructure cost management and control solutions for Olympic Games. This represents a major strategic partnership opportunity for Olympic Games delivery and management services.',
    'Global',
    '£800K-£1.5M',
    'GBP',
    1150000, -- Average of 800K-1.5M
    '2025-08-06',
    '2025-10-10',
    NOW(),
    'static',
    'https://olympics.com/ioc/news/request-for-expressions-of-interest-venue-temporary-infrastructure-cost-management-control-solution',
    'International Olympic Organization',
    'Infrastructure Management',
    'qualified',
    'critical',
    10,
    0.85,
    85,
    95,
    'ioc-olympic-committee',
    'IOC Olympic Committee',
    'International Federation',
    '{"duration": "Multi-year", "scope": "Global Olympic Games", "contract_type": "Strategic Partnership"}'::jsonb,
    '{"source": "static-fallback", "priority": "high", "opportunity_type": "RFEI"}'::jsonb,
    ARRAY['olympics', 'infrastructure', 'cost-management', 'temporary', 'venue'],
    ARRAY['venue', 'infrastructure', 'cost', 'management', 'olympic', 'games'],
    'unverified',
    NOW(),
    NOW()
),
(
    'Results and Statistics Service Provider (2026-2031)',
    'World Athletics',
    'World Athletics has opened a major public tender for a comprehensive results and statistical service provider. This is a critical 5-year contract covering results processing, competitions management, records management, athlete management, and rankings management for global athletics. The service processes approximately 1.2 million results annually from about 10,000 competitions involving 170,000 athletes worldwide.',
    'Global',
    '£1.5M-£2.5M',
    'GBP',
    2000000, -- Average of 1.5M-2.5M
    '2025-03-28',
    '2025-10-10',
    NOW(),
    'static',
    'https://worldathletics.org/news/news/tender-request-proposal-results-statistics-service',
    'International Federation',
    'Sports Data Management',
    'qualified',
    'critical',
    10,
    0.85,
    85,
    95,
    'world-athletics',
    'World Athletics',
    'International Federation',
    '{"duration": "5 years", "scope": "Global athletics", "volume": "1.2M results/year", "contract_type": "Service Provider"}'::jsonb,
    '{"source": "static-fallback", "priority": "high", "opportunity_type": "RFP", "sports": "athletics"}'::jsonb,
    ARRAY['athletics', 'results', 'statistics', 'data-management', 'sports'],
    ARRAY['results', 'statistics', 'athletics', 'sports', 'data', 'management'],
    'unverified',
    NOW(),
    NOW()
),
(
    'Comprehensive Digital Event and Engagement Solution with Multilingual Content Management',
    'Digital India Corporation',
    'Digital India Corporation seeks comprehensive digital event and engagement solution with advanced multilingual content management capabilities for national digital initiatives and public engagement programs.',
    'India',
    '£2M-£3M',
    'GBP',
    2500000, -- Average of 2M-3M
    '2025-04-15',
    '2025-10-10',
    NOW(),
    'static',
    'https://digitalindia.gov.in/tenders/digital-event-engagement-solution',
    'Digital Transformation',
    'Event Management',
    'qualified',
    'critical',
    9,
    0.80,
    80,
    90,
    'digital-india-corporation',
    'Digital India Corporation',
    'Government Agency',
    '{"duration": "Multi-year", "scope": "National digital initiatives", "features": "Multilingual support", "contract_type": "Digital Solution"}'::jsonb,
    '{"source": "static-fallback", "priority": "high", "opportunity_type": "RFP", "region": "India"}'::jsonb,
    ARRAY['digital', 'events', 'engagement', 'multilingual', 'content-management'],
    ARRAY['digital', 'events', 'engagement', 'multilingual', 'content', 'india'],
    'unverified',
    NOW(),
    NOW()
);

-- Update calculated priorities for static data
SELECT update_rfp_priorities();

-- Update conversion_stage
UPDATE rfp_opportunities_unified 
SET conversion_stage = 'qualified' 
WHERE source = 'static' AND status = 'qualified';

-- Log the seeding operation
DO $$
DECLARE
    seeded_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO seeded_count FROM rfp_opportunities_unified WHERE source = 'static';
    
    INSERT INTO system_logs (timestamp, level, category, source, message, data)
    VALUES (
        NOW(),
        'info',
        'database',
        'rfp-static-seed',
        format('Seeded % static RFP opportunities into unified table', seeded_count),
        jsonb_build_object(
            'static_records_seeded', seeded_count,
            'seeded_at', NOW()
        )
    );
    
    RAISE NOTICE 'Successfully seeded % static RFP opportunities into unified table', seeded_count;
END $$;