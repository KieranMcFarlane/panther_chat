#!/usr/bin/env node

/**
 * COMPREHENSIVE DATABASE CLEANUP SCRIPT - ALL SPORTS
 * 
 * This script will clean up the massive data contamination across all sports
 * to ensure proper league classification and remove mislabeled entities.
 */

console.log('🌍 COMPREHENSIVE DATABASE CLEANUP SCRIPT - ALL SPORTS')
console.log('='.repeat(80))

// Sports contamination analysis results
const SPORTS_CONTAMINATION = {
  Basketball: {
    total: 504,
    contaminated: 323,
    contamination_type: 'International Basketball',
    proper_leagues: ['NBA', 'EuroLeague', 'Lega Basket Serie A', 'Liga ACB', 'Chinese Basketball Association']
  },
  Baseball: {
    total: 214,
    contaminated: 130,
    contamination_type: 'International Baseball',
    proper_leagues: ['Major League Baseball', 'KBO League', 'NPB Central League', 'NPB Pacific League']
  },
  Cricket: {
    total: 242,
    contaminated: 127,
    contamination_type: 'International Cricket',
    proper_leagues: ['Indian Premier League', 'Big Bash League', 'County Championship', 'Pakistan Super League']
  },
  IceHockey: {
    total: 209,
    contaminated: 92,
    contamination_type: 'International Hockey',
    proper_leagues: ['National Hockey League', 'American Hockey League', 'Kontinental Hockey League', 'ECHL']
  },
  Football: {
    total: 342,
    contaminated: 65, // Already partially cleaned
    contamination_type: 'FIFA Member Association',
    proper_leagues: ['Premier League', 'LaLiga', 'Bundesliga', 'Serie A', 'Ligue 1']
  }
}

// Official league teams for validation
const OFFICIAL_LEAGUE_TEAMS = {
  'NBA': [
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
    'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
    'Houston Rockets', 'Indiana Pacers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
    'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
    'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
    'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards'
  ],
  'Major League Baseball': [
    'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox', 'Chicago Cubs',
    'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians', 'Colorado Rockies', 'Detroit Tigers',
    'Houston Astros', 'Kansas City Royals', 'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins',
    'Milwaukee Brewers', 'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
    'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants', 'Seattle Mariners',
    'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers', 'Toronto Blue Jays', 'Washington Nationals'
  ],
  'National Hockey League': [
    'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres', 'Calgary Flames',
    'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche', 'Columbus Blue Jackets', 'Dallas Stars',
    'Detroit Red Wings', 'Edmonton Oilers', 'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild',
    'Montreal Canadiens', 'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
    'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks', 'Seattle Kraken',
    'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs', 'Vancouver Canucks', 'Vegas Golden Knights',
    'Washington Capitals', 'Winnipeg Jets'
  ],
  'Indian Premier League': [
    'Chennai Super Kings', 'Delhi Capitals', 'Gujarat Titans', 'Kolkata Knight Riders', 'Lucknow Super Giants',
    'Mumbai Indians', 'Punjab Kings', 'Royal Challengers Bangalore', 'Rajasthan Royals', 'Sunrisers Hyderabad'
  ],
  'Big Bash League': [
    'Adelaide Strikers', 'Brisbane Heat', 'Hobart Hurricanes', 'Melbourne Renegades', 'Melbourne Stars',
    'Perth Scorchers', 'Sydney Sixers', 'Sydney Thunder'
  ]
}

console.log('📊 CONTAMINATION ANALYSIS:')
console.log('')

Object.entries(SPORTS_CONTAMINATION).forEach(([sport, data]) => {
  const contaminationPercent = ((data.contaminated / data.total) * 100).toFixed(1)
  console.log(`${sport.padEnd(12)}: ${data.total} total entities`)
  console.log(`              ${data.contaminated} contaminated (${contaminationPercent}%)`)
  console.log(`              Issue: "${data.contamination_type}" misclassification`)
  console.log('')
})

console.log('🧹 CLEANUP STRATEGY:')
console.log('')

// Generate SQL cleanup queries
const SQL_CLEANUP_QUERIES = []

// Basketball cleanup
SQL_CLEANUP_QUERIES.push(
  `-- Basketball Cleanup: Remove International Basketball contamination`,
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'NBA')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'United States'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'EuroLeague')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' IN ('Spain', 'Greece', 'Italy', 'France', 'Germany', 'Turkey', 'Russia', 'Lithuania', 'Serbia', 'Croatia')`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Chinese Basketball Association')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'China'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Korean Basketball League')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'South Korea'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Philippine Basketball Association')
   WHERE properties->>'sport' = 'Basketball'
     AND properties->>'league' = 'International Basketball'
     AND properties->>'country' = 'Philippines'`
)

// Baseball cleanup
SQL_CLEANUP_QUERIES.push(
  `-- Baseball Cleanup: Remove International Baseball contamination`,
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Major League Baseball')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'United States'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'NPB Central League')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'Japan'
     AND properties->>'region' = 'Central'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'NPB Pacific League')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'Japan'
     AND properties->>'region' = 'Pacific'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'KBO League')
   WHERE properties->>'sport' = 'Baseball'
     AND properties->>'league' = 'International Baseball'
     AND properties->>'country' = 'South Korea'`
)

// Cricket cleanup
SQL_CLEANUP_QUERIES.push(
  `-- Cricket Cleanup: Remove International Cricket contamination`,
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Indian Premier League')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'India'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Big Bash League')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'Australia'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'County Championship')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'England'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Pakistan Super League')
   WHERE properties->>'sport' = 'Cricket'
     AND properties->>'league' = 'International Cricket'
     AND properties->>'country' = 'Pakistan'`
)

// Ice Hockey cleanup
SQL_CLEANUP_QUERIES.push(
  `-- Ice Hockey Cleanup: Remove International Hockey contamination`,
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'National Hockey League')
   WHERE properties->>'sport' = 'Ice Hockey'
     AND properties->>'league' = 'International Hockey'
     AND properties->>'country' = 'United States'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'National Hockey League')
   WHERE properties->>'sport' = 'Ice Hockey'
     AND properties->>'league' = 'International Hockey'
     AND properties->>'country' = 'Canada'`,
   
  `UPDATE cached_entities 
   SET properties = jsonb_set(properties, '{league}', 'Kontinental Hockey League')
   WHERE properties->>'sport' = 'Ice Hockey'
     AND properties->>'league' = 'International Hockey'
     AND properties->>'country' IN ('Russia', 'Belarus', 'Kazakhstan', 'Latvia', 'Finland')`
)

// Remove remaining problematic entities
SQL_CLEANUP_QUERIES.push(
  `-- Remove remaining generic league classifications`,
  `DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Basketball'
     AND properties->>'sport' = 'Basketball'`,
   
  `DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Baseball'
     AND properties->>'sport' = 'Baseball'`,
     
  `DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Cricket'
     AND properties->>'sport' = 'Cricket'`,
     
  `DELETE FROM cached_entities 
   WHERE properties->>'league' = 'International Hockey'
     AND properties->>'sport' = 'Ice Hockey'`
)

// Write SQL queries to file
const fs = require('fs')
fs.writeFileSync('comprehensive-database-cleanup.sql', SQL_CLEANUP_QUERIES.join('\n\n'))

console.log('🎯 CLEANUP PLAN:')
console.log('')
console.log('1. Basketball: Move teams from "International Basketball" to proper regional leagues')
console.log('2. Baseball: Move teams from "International Baseball" to proper national leagues')
console.log('3. Cricket: Move teams from "International Cricket" to proper national leagues')
console.log('4. Ice Hockey: Move teams from "International Hockey" to proper national/continental leagues')
console.log('5. Remove remaining problematic entities that cannot be properly classified')
console.log('')
console.log('📋 EXPECTED RESULTS:')
console.log('')
Object.entries(SPORTS_CONTAMINATION).forEach(([sport, data]) => {
  const remaining = data.total - data.contaminated
  console.log(`${sport.padEnd(12)}: ${remaining} properly classified entities`)
})
console.log('')
console.log('✅ SQL cleanup queries saved to: comprehensive-database-cleanup.sql')
console.log(`Generated ${SQL_CLEANUP_QUERIES.length} SQL queries for cleanup`)
console.log('')
console.log('⚠️  WARNING: This will permanently modify your database!')
console.log('   Make sure to backup your data before executing!')
console.log('=' .repeat(80))
console.log('🚀 Ready to execute comprehensive database cleanup!')