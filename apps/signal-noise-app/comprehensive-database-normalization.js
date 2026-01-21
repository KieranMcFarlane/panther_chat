#!/usr/bin/env node

/**
 * COMPREHENSIVE Database Normalization Script
 * 
 * This script normalizes ALL sports data in the database to fix navigation issues
 * and ensure consistent LeagueNav functionality across all sports.
 * 
 * Issues Found:
 * 1. 211 entities with empty sport field
 * 2. Inconsistent league/level naming across all sports
 * 3. Missing league information for most entities
 * 4. Inconsistent entity types and labels
 * 5. Null values in key fields
 */

// Database connection setup will use MCP tools for SQL execution

/**
 * Complete normalization SQL for all sports
 */
const COMPREHENSIVE_NORMALIZATION_SQL = [
  // STEP 1: Fix entities with empty sport fields
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(properties, '{sport}', '"Multi-sport"')
  WHERE COALESCE(properties->>'sport', '') = '' OR properties->>'sport' IS NULL;
  `,

  // STEP 2: Normalize Football data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'LaLiga' THEN '"LaLiga"'
      WHEN properties->>'level' = 'Serie A' THEN '"Serie A"'
      WHEN properties->>'level' = 'MLS' THEN '"MLS"'
      WHEN properties->>'level' = 'Bundesliga' THEN '"Bundesliga"'
      WHEN properties->>'level' = 'Ligue 1' THEN '"Ligue 1"'
      WHEN properties->>'level' = 'Eredivisie' THEN '"Eredivisie"'
      WHEN properties->>'level' = 'Primeira Liga' THEN '"Primeira Liga"'
      WHEN properties->>'level' = 'Liga MX' THEN '"Liga MX"'
      WHEN properties->>'level' = 'Primera División' THEN '"Primera División"'
      WHEN properties->>'level' = 'Süper Lig' THEN '"Süper Lig"'
      WHEN properties->>'level' = 'Saudi Pro League' THEN '"Saudi Pro League"'
      WHEN properties->>'level' = 'Scottish Premiership' THEN '"Scottish Premiership"'
      WHEN properties->>'level' = 'Brasileirão Série A' THEN '"Brasileirão Série A"'
      WHEN properties->>'level' = 'EFL Championship' THEN '"English League Championship"'
      WHEN properties->>'level' = 'J1 League' THEN '"J1 League"'
      WHEN properties->>'level' = '2. Bundesliga' THEN '"2. Bundesliga"'
      WHEN properties->>'level' = 'K League 1' THEN '"K League 1"'
      WHEN properties->>'level' = 'Série A' THEN '"Serie A"'
      WHEN properties->>'level' = 'A-League' THEN '"A-League"'
      WHEN properties->>'level' = 'Ligue 2' THEN '"Ligue 2"'
      WHEN properties->>'level' = 'Allsvenskan' THEN '"Allsvenskan"'
      ELSE COALESCE('"Premier League"', properties->>'league')
    END
  )
  WHERE properties->>'sport' = 'Football' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 3: Normalize Basketball levels to proper league names
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'NBA' THEN '"NBA"'
      WHEN properties->>'level' = 'EuroLeague/ACB/BSL etc.' THEN '"EuroLeague"'
      WHEN properties->>'level' = 'Top-tier' THEN '"Top Tier Basketball"'
      WHEN properties->>'level' = 'CBA' THEN '"Chinese Basketball Association"'
      WHEN properties->>'level' = 'NBL' THEN '"National Basketball League"'
      WHEN properties->>'level' = 'BSL' THEN '"Basketball Super League"'
      WHEN properties->>'level' = 'Liga ACB' THEN '"Liga ACB"'
      WHEN properties->>'level' = 'BBL' THEN '"Basketball Bundesliga"'
      WHEN properties->>'level' = 'LNB Pro A' THEN '"LNB Pro A"'
      WHEN properties->>'level' = 'Lega Basket Serie A' THEN '"Lega Basket Serie A"'
      WHEN properties->>'level' = 'VTB United League' THEN '"VTB United League"'
      WHEN properties->>'level' = 'Greek A1 League' THEN '"Greek A1 League"'
      WHEN properties->>'level' = 'LKL' THEN '"Lietuvos Krepšinio Lyga"'
      WHEN properties->>'level' = 'B1 League' THEN '"B1 League"'
      WHEN properties->>'level' = 'Adriatic League' THEN '"Adriatic League"'
      WHEN properties->>'level' = 'NBB' THEN '"Novo Basquete Brasil"'
      WHEN properties->>'level' = 'PBA' THEN '"Philippine Basketball Association"'
      WHEN properties->>'level' = 'KBL' THEN '"Korean Basketball League"'
      ELSE COALESCE(properties->>'league', '"International Basketball"')
    END
  )
  WHERE properties->>'sport' = 'Basketball' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 4: Normalize Baseball data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'MLB' THEN '"Major League Baseball"'
      WHEN properties->>'level' = 'MiLB (Triple-A)' THEN '"Triple-A Baseball"'
      WHEN properties->>'level' = 'KBO League' THEN '"KBO League"'
      WHEN properties->>'level' = 'NPB (Central League)' THEN '"NPB Central League"'
      WHEN properties->>'level' = 'NPB (Pacific League)' THEN '"NPB Pacific League"'
      WHEN properties->>'level' = 'ABL' THEN '"Australian Baseball League"'
      WHEN properties->>'level' = 'CPBL' THEN '"Chinese Professional Baseball League"'
      WHEN properties->>'level' = 'Top Division' THEN '"Top Division Baseball"'
      ELSE COALESCE(properties->>'league', '"International Baseball"')
    END
  )
  WHERE properties->>'sport' = 'Baseball' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 5: Normalize Ice Hockey data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'NHL' THEN '"National Hockey League"'
      WHEN properties->>'level' = 'AHL' THEN '"American Hockey League"'
      WHEN properties->>'level' = 'ECHL' THEN '"ECHL"'
      WHEN properties->>'level' = 'KHL' THEN '"Kontinental Hockey League"'
      WHEN properties->>'level' = 'SHL' THEN '"Swedish Hockey League"'
      WHEN properties->>'level' = 'Liiga' THEN '"Liiga"'
      WHEN properties->>'level' = 'Swiss National League' THEN '"Swiss National League"'
      WHEN properties->>'level' = 'Top Division' THEN '"Top Division Hockey"'
      ELSE COALESCE(properties->>'league', '"International Hockey"')
    END
  )
  WHERE properties->>'sport' = 'Ice Hockey' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 6: Normalize Motorsport data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'Formula 1' THEN '"Formula 1"'
      WHEN properties->>'level' = 'NASCAR Cup Series' THEN '"NASCAR Cup Series"'
      WHEN properties->>'level' = 'FIM Motorcycle Racing' THEN '"FIM Motorcycle Racing"'
      WHEN properties->>'level' = 'IMSA' THEN '"IMSA"'
      WHEN properties->>'level' = 'GT Racing' THEN '"GT Racing"'
      WHEN properties->>'level' = 'Touring Car' THEN '"Touring Car Racing"'
      WHEN properties->>'level' = 'IndyCar' THEN '"IndyCar"'
      WHEN properties->>'level' = 'WEC' THEN '"World Endurance Championship"'
      WHEN properties->>'level' = 'Formula 2/Formula 3' THEN '"Formula 2/Formula 3"'
      WHEN properties->>'level' = 'WRC (Rally)' THEN '"World Rally Championship"'
      WHEN properties->>'level' = 'NASCAR Stock Car' THEN '"NASCAR"'
      ELSE COALESCE(properties->>'league', '"International Motorsport"')
    END
  )
  WHERE properties->>'sport' = 'Motorsport' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 7: Normalize Rugby data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'United Rugby Championship' THEN '"United Rugby Championship"'
      WHEN properties->>'level' = 'Top 14' THEN '"Top 14"'
      WHEN properties->>'level' = 'Nationale' THEN '"Rugby Nationale"'
      WHEN properties->>'level' = 'Japan Rugby League One' THEN '"Japan Rugby League One"'
      WHEN properties->>'level' = 'Super Rugby Pacific' THEN '"Super Rugby Pacific"'
      WHEN properties->>'level' = 'RFU Championship' THEN '"RFU Championship"'
      WHEN properties->>'level' = 'Major League Rugby' THEN '"Major League Rugby"'
      WHEN properties->>'level' = 'Pro D2' THEN '"Pro D2"'
      WHEN properties->>'level' = 'Gallagher Premiership' THEN '"Gallagher Premiership"'
      WHEN properties->>'level' = 'Top10' THEN '"Top10"'
      WHEN properties->>'level' = 'NPC' THEN '"National Provincial Championship"'
      WHEN properties->>'level' = 'Currie Cup' THEN '"Currie Cup"'
      ELSE COALESCE(properties->>'league', '"International Rugby"')
    END
  )
  WHERE properties->>'sport' = 'Rugby' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 8: Normalize Volleyball data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'Superliga' THEN '"Superliga"'
      WHEN properties->>'level' = 'SuperLega' THEN '"SuperLega"'
      WHEN properties->>'level' = 'PlusLiga' THEN '"PlusLiga"'
      WHEN properties->>'level' = 'Efeler Ligi' THEN '"Efeler Ligi"'
      WHEN properties->>'level' = 'Serie A2' THEN '"Serie A2"'
      WHEN properties->>'level' = 'V.League Division 1' THEN '"V.League Division 1"'
      WHEN properties->>'level' = 'Swiss League' THEN '"Swiss League"'
      WHEN properties->>'level' = 'Pro Volleyball Federation' THEN '"Pro Volleyball Federation"'
      WHEN properties->>'level' = '1. DOL' THEN '"1. DOL"'
      WHEN properties->>'level' = 'Bundesliga' THEN '"Volleyball Bundesliga"'
      WHEN properties->>'level' = 'Ligue A' THEN '"Ligue A"'
      WHEN properties->>'level' = 'Top Division' THEN '"Top Division Volleyball"'
      ELSE COALESCE(properties->>'league', '"International Volleyball"')
    END
  )
  WHERE properties->>'sport' = 'Volleyball' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 9: Normalize Handball data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'Bundesliga' THEN '"Handball Bundesliga"'
      WHEN properties->>'level' = 'Liga ASOBAL' THEN '"Liga ASOBAL"'
      WHEN properties->>'level' = 'LNH Division 1' THEN '"LNH Division 1"'
      WHEN properties->>'level' = 'Superliga' THEN '"Handball Superliga"'
      WHEN properties->>'level' = 'Handbollsligan' THEN '"Handbollsligan"'
      WHEN properties->>'level' = 'Asian Handball Club Championship' THEN '"Asian Handball Club Championship"'
      WHEN properties->>'level' = 'Nemzeti Bajnokság I' THEN '"Nemzeti Bajnokság I"'
      WHEN properties->>'level' = 'African Handball Champions League' THEN '"African Handball Champions League"'
      WHEN properties->>'level' = 'Eliteserien' THEN '"Eliteserien"'
      WHEN properties->>'level' = 'Handboldligaen' THEN '"Handboldligaen"'
      ELSE COALESCE(properties->>'league', '"International Handball"')
    END
  )
  WHERE properties->>'sport' = 'Handball' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 10: Normalize Cricket data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'SLC Premier League' THEN '"SLC Premier League"'
      WHEN properties->>'level' = 'County Championship' THEN '"County Championship"'
      WHEN properties->>'level' = 'Ranji Trophy' THEN '"Ranji Trophy"'
      WHEN properties->>'level' = 'Indian Premier League' THEN '"Indian Premier League"'
      WHEN properties->>'level' = 'Big Bash League' THEN '"Big Bash League"'
      WHEN properties->>'level' = 'Pakistan Super League' THEN '"Pakistan Super League"'
      WHEN properties->>'level' = 'The Hundred' THEN '"The Hundred"'
      WHEN properties->>'level' = 'CSA 4-Day Series' THEN '"CSA 4-Day Series"'
      WHEN properties->>'level' = 'Sheffield Shield' THEN '"Sheffield Shield"'
      WHEN properties->>'level' = 'Quaid-e-Azam Trophy' THEN '"Quaid-e-Azam Trophy"'
      WHEN properties->>'level' = 'Plunket Shield' THEN '"Plunket Shield"'
      ELSE COALESCE(properties->>'league', '"International Cricket"')
    END
  )
  WHERE properties->>'sport' = 'Cricket' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 11: Normalize Cycling data
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{league}',
    CASE
      WHEN properties->>'level' = 'UCI WorldTour' THEN '"UCI WorldTour"'
      WHEN properties->>'level' = 'UCI Men\'s WorldTeam' THEN '"UCI Men\'s WorldTeam"'
      WHEN properties->>'level' = 'UCI Men\'s ProTeam' THEN '"UCI Men\'s ProTeam"'
      WHEN properties->>'level' = 'UCI Women\'s WorldTeam' THEN '"UCI Women\'s WorldTeam"'
      WHEN properties->>'level' = 'UCI Women\'s WorldTour' THEN '"UCI Women\'s WorldTour"'
      WHEN properties->>'level' = 'UCI Women\'s ProTeam' THEN '"UCI Women\'s ProTeam"'
      WHEN properties->>'level' = 'UCI ProSeries' THEN '"UCI ProSeries"'
      WHEN properties->>'level' = 'UCI Standalone' THEN '"UCI Standalone"'
      ELSE COALESCE(properties->>'league', '"International Cycling"')
    END
  )
  WHERE properties->>'sport' = 'Cycling' 
    AND properties->>'league' IS NULL
    AND properties->>'level' IS NOT NULL;
  `,

  // STEP 12: Clean up empty levels and set default values
  `
  UPDATE cached_entities 
  SET properties = jsonb_set(
    properties,
    '{level}',
    CASE
      WHEN properties->>'sport' = 'Football' AND properties->>'league' = 'Premier League' THEN '"Tier 1"'
      WHEN properties->>'sport' = 'Football' AND properties->>'league' = 'English League Championship' THEN '"Tier 2"'
      WHEN properties->>'sport' = 'Football' AND properties->>'league' = 'League One' THEN '"Tier 3"'
      WHEN properties->>'sport' = 'Football' AND properties->>'league' = 'League Two' THEN '"Tier 4"'
      WHEN properties->>'sport' = 'Basketball' AND properties->>'league' = 'NBA' THEN '"Tier 1"'
      WHEN properties->>'sport' = 'Baseball' AND properties->>'league' = 'Major League Baseball' THEN '"Tier 1"'
      WHEN properties->>'sport' = 'Ice Hockey' AND properties->>'league' = 'National Hockey League' THEN '"Tier 1"'
      WHEN COALESCE(properties->>'level', '') = '' OR properties->>'level' IS NULL THEN '"International"'
      ELSE properties->>'level'
    END
  )
  WHERE COALESCE(properties->>'level', '') = '' OR properties->>'level' IS NULL;
  `,

  // STEP 13: Normalize entity types to ensure consistency
  `
  UPDATE cached_entities 
  SET labels = CASE
    WHEN properties->>'sport' IN ('Football', 'Basketball', 'Baseball', 'Ice Hockey', 'Rugby', 'Cricket') AND properties->>'league' IS NOT NULL THEN ARRAY['Entity', 'Club', 'Team']
    WHEN properties->>'sport' IN ('Motorsport', 'Cycling', 'Golf', 'Tennis') AND properties->>'league' IS NOT NULL THEN ARRAY['Entity', 'Team', 'Competitor']
    WHEN properties->>'name' ILIKE '%national team%' OR properties->>'name' ILIKE '%national%' THEN ARRAY['Entity', 'National Team']
    WHEN properties->>'name' ILIKE '%league%' OR properties->>'name' ILIKE '%championship%' OR properties->>'name' ILIKE '%cup%' THEN ARRAY['Entity', 'Competition']
    WHEN properties->>'name' ILIKE '%federation%' OR properties->>'name' ILIKE '%association%' OR properties->>'name' ILIKE '%confederation%' THEN ARRAY['Entity', 'Governing Body']
    ELSE ARRAY['Entity']
  END
  WHERE labels IS NULL OR cardinality(labels) = 0;
  `
]

/**
 * Comprehensive verification query
 */
const VERIFICATION_QUERY = `
  SELECT 
    properties->>'sport' as sport,
    properties->>'league' as league,
    properties->>'level' as level,
    COUNT(*) as count,
    CASE 
      WHEN properties->>'league' IS NULL THEN 'Missing League'
      WHEN properties->>'level' IS NULL THEN 'Missing Level'
      WHEN properties->>'sport' IS NULL OR properties->>'sport' = '' THEN 'Missing Sport'
      ELSE 'Complete'
    END as status
  FROM cached_entities 
  GROUP BY properties->>'sport', properties->>'league', properties->>'level'
  ORDER BY sport, count DESC
  LIMIT 50;
`

/**
 * Export for use
 */
module.exports = {
  COMPREHENSIVE_NORMALIZATION_SQL,
  VERIFICATION_QUERY
}