#!/usr/bin/env node

/**
 * DATABASE CLEANUP SCRIPT - ORGANIZE SPORTS ENTITIES
 * 
 * This script will clean up the massive data contamination in the database
 * to ensure Premier League only contains actual English Premier League teams
 * and other entities are properly categorized.
 */

// Official English Premier League teams for 2024-2025 season
const OFFICIAL_PREMIER_LEAGUE_TEAMS = [
  'Arsenal',
  'Aston Villa', 
  'Bournemouth',
  'Brentford',
  'Brighton & Hove Albion',
  'Burnley',
  'Chelsea',
  'Crystal Palace',
  'Everton',
  'Fulham',
  'Ipswich Town',
  'Liverpool',
  'Manchester City',
  'Manchester United',
  'Newcastle United',
  'Nottingham Forest',
  'Sheffield United',
  'Tottenham',
  'West Ham United',
  'Wolverhampton Wanderers'
]

// Competitions and their proper league names
const COMPETITION_CORRECTIONS = {
  '2. Bundesliga': '2. Bundesliga',
  'A-League': 'A-League',
  'Allsvenskan': 'Allsvenskan',
  'Belgian Pro League': 'Belgian Pro League',
  'Brasileirão Série A': 'Brasileirão Série A',
  'Austrian Bundesliga': 'Austrian Bundesliga',
  'Botola Pro': 'Botola Pro',
  'Chinese Super League': 'Chinese Super League',
  'Qatar Stars League': 'Qatar Stars League',
  'Sudan Premier League': 'Sudan Premier League',
  'Belgian Pro League': 'Belgian Pro League',
  'Categoría Primera A': 'Categoría Primera A'
}

// FIFA Federation mappings - these should not be in Premier League
const FIFA_FEDERATIONS = [
  'Afghanistan Football Federation',
  'Albanian Football Association',
  'Algerian Football Association', 
  'Angolan Football Association',
  'Anguilla Football Association',
  'Antigua and Barbuda Football Association',
  'Argentine Football Association',
  'Armenian Football Association',
  'Aruba Football Federation',
  'Asian Football Confederation',
  'Asian Football Confederation (AFC)',
  'Austrian Football Association',
  'Azerbaijan Football Federation',
  'Bahamas Football Association',
  'Bahrain Football Association',
  'Bangladesh Football Federation',
  'Barbados Football Association',
  'Belarus Football Association',
  'Belgian Football Association',
  'Belize Football Association',
  'Benin Football Federation',
  'Bermuda Football Association',
  'Bhutan Football Federation',
  'Bolivian Football Association',
  'Bosnia and Herzegovina Football Federation',
  'Botswana Football Association',
  'Brazilian Football Confederation',
  'British Virgin Islands Football Association'
]

console.log('🧹 DATABASE CLEANUP SCRIPT')
console.log('=' .repeat(80))
console.log('📋 CLEANUP PLAN:')
console.log('')
console.log('1. Fix Premier League contamination')
console.log('   - Remove FIFA federations and governing bodies')
console.log('   - Remove competitions from Premier League')
console.log('   - Remove non-English teams from Premier League')
console.log('   - Only keep official 20 EPL teams')
console.log('')
console.log('2. Fix competition misclassification')
console.log('   - Move competitions to proper league names')
console.log('   - Remove incorrectly tagged entities')
console.log('')
console.log('3. Verify official EPL teams')
console.log('   - Ensure all 20 official teams are properly classified')
console.log('   - Set correct country (England) and level (Tier 1)')
console.log('')
console.log('🎯 TARGET RESULT:')
console.log('   Premier League: 20 English teams')
console.log('   Other leagues: Properly categorized teams')
console.log('   No more contamination or misclassification')
console.log('=' .repeat(80))

// SQL statements for cleanup
const SQL_CLEANUP_QUERIES = [
  // Step 1: Fix competition misclassification
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', '2. Bundesliga')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = '2. Bundesliga'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'A-League')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'A-League'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Allsvenskan')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Allsvenskan'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Belgian Pro League')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Belgian Pro League'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Brasileirão Série A')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Brasileirão Série A'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Austrian Bundesliga')
   WHERE properties->>'league' = 'Premier League' 
     AND properties->>'name' = 'Austrian Bundesliga'`,

  // Step 2: Remove FIFA federations from Premier League
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'FIFA Member Association')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'name' IN (${FIFA_FEDERATIONS.map(name => `'${name}'`).join(', ')})`,

  // Step 3: Fix Qatar Stars League teams
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Qatar Stars League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Qatar Stars League'`,

  // Step 4: Fix Sudan Premier League teams  
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Sudan Premier League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Sudan Premier League'`,

  // Step 5: Fix Chinese Super League team
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Chinese Super League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Chinese Super League'`,

  // Step 6: Fix other misclassified teams
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Belgian Pro League')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Belgian Pro League'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Categoría Primera A')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Categoría Primera A'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Austrian Bundesliga')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Austrian Bundesliga'`,

  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Botola Pro')
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'level' = 'Top-tier'`,

  // Step 7: Ensure official EPL teams are properly configured
  `UPDATE cached_entities 
   SET properties = jsonb_set(
     jsonb_set(
       jsonb_set(properties, '{country}', '"England"'),
       '{level}', '"Tier 1"'
     ),
     '{league}', '"Premier League"'
   )
   WHERE properties->>'name' IN (${OFFICIAL_PREMIER_LEAGUE_TEAMS.map(name => `'${name}'`).join(', ')})
     AND properties->>'sport' = 'Football'`,

  // Step 8: Add missing labels for EPL teams
  `UPDATE cached_entities 
   SET labels = ARRAY['Entity', 'Club']
   WHERE properties->>'name' IN (${OFFICIAL_PREMIER_LEAGUE_TEAMS.map(name => `'${name}'`).join(', ')})
     AND properties->>'sport' = 'Football'
     AND NOT 'Club' = ANY(labels)`,

  // Step 9: Clean up any remaining problematic entities
  `DELETE FROM cached_entities 
   WHERE properties->>'league' = 'Premier League'
     AND properties->>'sport' = 'Football'
     AND properties->>'name' NOT IN (${OFFICIAL_PREMIER_LEAGUE_TEAMS.map(name => `'${name}'`).join(', ')})`
]

console.log('📊 OFFICIAL ENGLISH PREMIER LEAGUE TEAMS (2024-2025):')
console.log('')
OFFICIAL_PREMIER_LEAGUE_TEAMS.forEach((team, index) => {
  console.log(`${(index + 1).toString().padStart(2, ' ')}. ${team}`)
})

console.log('')
console.log('🧹 SQL CLEANUP QUERIES GENERATED:')
console.log(`Total queries: ${SQL_CLEANUP_QUERIES.length}`)
console.log('')
console.log('💡 TO EXECUTE CLEANUP:')
console.log('1. Copy the SQL queries to your Supabase SQL editor')
console.log('2. Execute them one by one or in batches')
console.log('3. Verify the results by checking Premier League teams')
console.log('4. Test the LeagueNav functionality')
console.log('')
console.log('🎯 EXPECTED RESULT AFTER CLEANUP:')
console.log('   Premier League: 20 English teams only')
console.log('   Other leagues: Properly categorized')
console.log('   No more contamination or misclassification')
console.log('')
console.log('⚠️  WARNING: This will permanently modify your database!')
console.log('   Make sure to backup your data before executing!')
console.log('=' .repeat(80))

// Write SQL queries to file for easy execution
const fs = require('fs')
fs.writeFileSync('database-cleanup.sql', SQL_CLEANUP_QUERIES.join('\n\n'))

console.log('✅ SQL cleanup queries saved to: database-cleanup.sql')
console.log('🚀 Ready to execute database cleanup!')