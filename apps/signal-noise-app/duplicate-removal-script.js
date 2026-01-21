#!/usr/bin/env node

/**
 * DUPLICATE REMOVAL AND DATA CLEANUP SCRIPT
 * 
 * This script removes duplicate entities and cleans up inconsistent data
 * to ensure perfect navigation functionality.
 * 
 * Issues Found:
 * 1. 15+ duplicate football teams (Arsenal/Arsenal FC, Brentford/Brentford FC, etc.)
 * 2. Teams appearing in multiple leagues incorrectly
 * 3. Unknown country data for ABL teams
 * 4. Inconsistent team naming conventions
 */

// SQL commands for duplicate removal and cleanup

const DUPLICATE_REMOVAL_SQL = [
  // STEP 1: Remove exact duplicates (same name, sport, league)
  `
  WITH dedup AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY properties->>'name', properties->>'sport', properties->>'league' 
        ORDER BY created_at DESC, id
      ) as row_num
    FROM cached_entities 
    WHERE properties->>'name' IS NOT NULL
  )
  DELETE FROM cached_entities 
  WHERE id IN (SELECT id FROM dedup WHERE row_num > 1);
  `,

  // STEP 2: Fix Arsenal duplicates specifically
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties::jsonb,
    '{name}',
    '"Arsenal"'::jsonb
  )
  WHERE properties->>'name' ILIKE '%Arsenal%' 
    AND properties->>'sport' = 'Football'
    AND properties->>'league' = 'Premier League';
  `,

  // STEP 3: Standardize team names by removing common suffixes
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties::jsonb,
    '{name}',
    CASE 
      WHEN properties->>'name' ~* ' Football Club$' THEN regexp_replace(properties->>'name', ' Football Club$', '', 'i')
      WHEN properties->>'name' ~* ' FC$' AND properties->>'name' != 'AFC Wimbledon' THEN regexp_replace(properties->>'name', ' FC$', '', 'i')
      WHEN properties->>'name' ~* ' AFC$' AND properties->>'name' NOT LIKE '%AFC%' THEN regexp_replace(properties->>'name', ' AFC$', '', 'i')
      WHEN properties->>'name' ~* ' CC$' THEN regexp_replace(properties->>'name', ' CC$', '', 'i')
      ELSE properties->>'name'
    END::jsonb
  )
  WHERE properties->>'sport' = 'Football' 
    AND (
      properties->>'name' ~* ' Football Club$' OR 
      properties->>'name' ~* ' FC$' OR 
      properties->>'name' ~* ' AFC$' OR 
      properties->>'name' ~* ' CC$'
    );
  `,

  // STEP 4: Fix country information for Australian Baseball League
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties::jsonb,
    '{country}',
    CASE
      WHEN properties->>'name' IN ('Auckland Tuatara') THEN '"New Zealand"'::jsonb
      WHEN properties->>'league' = 'Australian Baseball League' OR properties->>'level' = 'ABL' THEN '"Australia"'::jsonb
      ELSE COALESCE((properties->>'country')::jsonb, '"Australia"'::jsonb)
    END
  )
  WHERE (properties->>'league' = 'Australian Baseball League' OR properties->>'level' = 'ABL')
    AND (properties->>'country' IS NULL OR properties->>'country' = '');
  `,

  // STEP 5: Remove remaining duplicates after normalization
  `
  WITH dedup_normalized AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN properties->>'name' ~* ' Football Club$' THEN regexp_replace(properties->>'name', ' Football Club$', '', 'i')
            WHEN properties->>'name' ~* ' FC$' AND properties->>'name' != 'AFC Wimbledon' THEN regexp_replace(properties->>'name', ' FC$', '', 'i')
            WHEN properties->>'name' ~* ' AFC$' AND properties->>'name' NOT LIKE '%AFC%' THEN regexp_replace(properties->>'name', ' AFC$', '', 'i')
            WHEN properties->>'name' ~* ' CC$' THEN regexp_replace(properties->>'name', ' CC$', '', 'i')
            ELSE properties->>'name'
          END,
          properties->>'sport', 
          COALESCE(properties->>'league', 'Unknown League')
        ORDER BY 
          CASE 
            WHEN properties->>'league' IS NOT NULL AND properties->>'league' != '' THEN 1 
            ELSE 2 
          END,
          created_at DESC,
          id
      ) as row_num
    FROM cached_entities 
    WHERE properties->>'name' IS NOT NULL
  )
  DELETE FROM cached_entities 
  WHERE id IN (SELECT id FROM dedup_normalized WHERE row_num > 1);
  `,

  // STEP 6: Fix teams with missing but correctable league info
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties::jsonb,
    '{league}',
    CASE
      WHEN properties->>'sport' = 'Football' AND properties->>'level' = 'Tier 1' AND properties->>'name' IN (
        'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton & Hove Albion', 
        'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Liverpool', 
        'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest', 
        'Sheffield United', 'Tottenham', 'West Ham United', 'Wolverhampton Wanderers'
      ) THEN '"Premier League"'::jsonb
      
      WHEN properties->>'sport' = 'Football' AND properties->>'level' = 'Tier 2' AND properties->>'name' IN (
        'Coventry City', 'Derby County', 'Ipswich Town', 'Middlesbrough', 'Millwall', 
        'Norwich City', 'Sheffield Wednesday', 'Southampton', 'Watford', 'West Bromwich Albion'
      ) THEN '"English League Championship"'::jsonb
      
      WHEN properties->>'sport' = 'Football' AND properties->>'level' = 'Tier 3' AND properties->>'name' IN (
        'Birmingham City', 'Bolton Wanderers', 'Bristol Rovers', 'Burton Albion', 
        'Cambridge United', 'Charlton Athletic', 'Crawley Town', 'Exeter City'
      ) THEN '"League One"'::jsonb
      
      WHEN properties->>'sport' = 'Football' AND properties->>'level' = 'Tier 4' AND properties->>'name' IN (
        'Accrington Stanley', 'AFC Wimbledon', 'Barrow', 'Bradford City'
      ) THEN '"League Two"'::jsonb
      
      ELSE properties->>'league'::jsonb
    END
  )
  WHERE properties->>'league' IS NULL 
    AND properties->>'sport' = 'Football'
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 7: Final clean-up - remove entities with no meaningful data
  `
  DELETE FROM cached_entities 
  WHERE (
    COALESCE(properties->>'name', '') = '' OR 
    properties->>'name' IS NULL OR
    (COALESCE(properties->>'sport', '') = '' OR properties->>'sport' = 'Multi-sport')
  )
  AND id NOT IN (
    SELECT DISTINCT MIN(id) 
    FROM cached_entities 
    WHERE properties->>'name' IS NOT NULL 
    GROUP BY properties->>'name'
  );
  `
]

module.exports = {
  DUPLICATE_REMOVAL_SQL
}