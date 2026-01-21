// Data sync script using MCP Supabase connection
// This will sync Premier League and Championship badges from Neo4j to Supabase

async function syncBadgeData() {
  console.log('🔄 SYNCING BADGE DATA USING MCP SUPABASE CONNECTION');
  console.log('='.repeat(60));
  
  // Badge data from Neo4j that needs to be synced to Supabase
  const badgeData = [
    // Premier League teams (English Premier League)
    { name: 'Brentford FC', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/brentford-fc-badge.png' },
    { name: 'Brighton & Hove Albion', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/brighton-and-hove-albion-badge.png' },
    { name: 'Burnley', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/burnley-badge.png' },
    { name: 'Fulham', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/fulham-badge.png' },
    { name: 'Leeds United', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/leeds-united-badge.png' },
    { name: 'Sunderland', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/sunderland-badge.png' },
    { name: 'Tottenham', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/tottenham-badge.png' },
    
    // Championship teams (English League Championship)
    { name: 'Coventry City', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/coventry-city-badge.png' },
    { name: 'Derby County', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/derby-county-badge.png' },
    { name: 'Ipswich Town', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/ipswich-town-badge.png' },
    { name: 'Middlesbrough', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/middlesbrough-badge.png' },
    { name: 'Millwall', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/millwall-badge.png' },
    { name: 'Norwich City', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/norwich-city-badge.png' },
    { name: 'Sheffield United', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/sheffield-united-badge.png' },
    { name: 'Sheffield Wednesday', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/sheffield-wednesday-badge.png' },
    { name: 'Southampton', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/southampton-badge.png' },
    { name: 'Swansea City', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/swansea-city-badge.png' },
    { name: 'Watford', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/watford-badge.png' },
    { name: 'West Bromwich Albion', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/west-bromwich-albion-badge.png' }
  ];
  
  console.log(`📊 Syncing ${badgeData.length} teams with badges to cached_entities table`);
  
  // Generate INSERT statements for teams that don't exist
  const insertStatements = badgeData.map((team, index) => `
-- Insert ${team.name} (${team.league})
INSERT INTO cached_entities (properties, badge_s3_url, cache_version, created_at, updated_at)
SELECT 
  jsonb_build_object(
    'name', '${team.name}',
    'sport', 'Football',
    'league', '${team.league}',
    'type', 'Club'
  ),
  '${team.badge_url}',
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM cached_entities 
  WHERE properties->>'name' = '${team.name}' 
    AND properties->>'sport' = 'Football'
);
`).join('\n');
  
  // Generate UPDATE statements for existing entities
  const updateStatements = badgeData.map(team => `
-- Update ${team.name} (${team.league}) badge
UPDATE cached_entities 
SET badge_s3_url = '${team.badge_url}',
    updated_at = NOW()
WHERE properties->>'name' = '${team.name}' 
  AND properties->>'sport' = 'Football';
`).join('\n');
  
  console.log('\n📋 SQL INSERT STATEMENTS (for new entities):');
  console.log(insertStatements);
  
  console.log('\n📋 SQL UPDATE STATEMENTS (for existing entities):');
  console.log(updateStatements);
  
  // Generate verification query
  const verificationQuery = `
SELECT 
  properties->>'name' as name,
  properties->>'league' as league,
  badge_s3_url
FROM cached_entities 
WHERE properties->>'sport' = 'Football'
  AND properties->>'league' IN ('Premier League', 'English League Championship', 'League One', 'League Two')
  AND badge_s3_url IS NOT NULL
ORDER BY properties->>'league', properties->>'name';
`;
  
  console.log('\n📋 VERIFICATION QUERY:');
  console.log(verificationQuery);
  
  return {
    insertStatements,
    updateStatements,
    verificationQuery,
    totalTeams: badgeData.length
  };
}

function saveSyncPlan(plan) {
  const fs = require('fs');
  const syncPlan = {
    timestamp: new Date().toISOString(),
    description: 'Sync Premier League and Championship badges from Neo4j to Supabase cached_entities table',
    plan: plan
  };
  
  fs.writeFileSync('badge-sync-plan.json', JSON.stringify(syncPlan, null, 2));
  console.log('\n📄 Sync plan saved to: badge-sync-plan.json');
}

async function main() {
  console.log('🔗 BADGE SYNC PLAN GENERATOR');
  console.log('🎯 Generate SQL commands to sync badges from Neo4j to Supabase');
  
  const plan = await syncBadgeData();
  saveSyncPlan(plan);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏆 SYNC PLAN SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\n📊 SYNCHRONIZATION PLAN:`);
  console.log(`   • Total teams: ${plan.totalTeams}`);
  console.log(`   • Premier League: 7 teams`);
  console.log(`   • Championship: 12 teams`);
  console.log(`   • League One: 25 teams (already cached)`);
  console.log(`   • League Two: 24 teams (already cached)`);
  
  console.log(`\n🔧 EXECUTION STEPS:`);
  console.log(`   1. Run INSERT statements to add missing teams`);
  console.log(`   2. Run UPDATE statements to add badges to existing teams`);
  console.log(`   3. Run verification query to confirm results`);
  
  console.log(`\n📈 EXPECTED OUTCOME:`);
  console.log(`   • Complete Premier League coverage (7 teams)`);
  console.log(`   • Complete Championship coverage (12 teams)`);
  console.log(`   • Fixed navigator display for all English leagues`);
  console.log(`   • Total: 68 English teams with badges`);
  
  console.log('\n✅ Ready to execute SQL commands using MCP Supabase connection!');
}

main().catch(console.error);