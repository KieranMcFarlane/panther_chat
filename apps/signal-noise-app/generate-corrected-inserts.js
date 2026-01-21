// Generate corrected INSERT statements with required fields for cached_entities

async function generateCorrectedInserts() {
  console.log('🔧 GENERATING CORRECTED INSERT STATEMENTS');
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
    { name: 'Ipswich Town', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/ipswitch-town-badge.png' },
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
  
  // Generate corrected INSERT statements with all required fields
  const insertStatements = badgeData.map((team, index) => {
    const teamId = `team-${team.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}`;
    const cleanName = team.name.replace(' FC', '').trim();
    
    return `
-- Insert ${team.name} (${team.league})
INSERT INTO cached_entities (
  id,
  neo4j_id,
  labels, 
  properties,
  badge_s3_url,
  cache_version,
  created_at,
  updated_at
) VALUES (
  '${teamId}-${index}',
  'neo4j-node-${index}',
  ARRAY['Entity', 'Club'],
  jsonb_build_object(
    'name', '${team.name}',
    'sport', 'Football', 
    'league', '${team.league}',
    'type', 'Club',
    'short_name', '${cleanName}',
    'full_name', '${team.name}'
  ),
  '${team.badge_url}',
  1,
  NOW(),
  NOW()
);`;
  }).join('\n');
  
  console.log(`📊 Generated ${badgeData.length} corrected INSERT statements`);
  console.log('\n📋 CORRECTED INSERT STATEMENTS:');
  console.log(insertStatements);
  
  // Verification query
  const verificationQuery = `
SELECT 
  properties->>'name' as name,
  properties->>'league' as league,
  badge_s3_url
FROM cached_entities 
WHERE properties->>'sport' = 'Football'
  AND badge_s3_url IS NOT NULL
ORDER BY properties->>'league', properties->>'name';`;
  
  console.log('\n📋 VERIFICATION QUERY:');
  console.log(verificationQuery);
  
  return {
    insertStatements,
    verificationQuery,
    totalTeams: badgeData.length
  };
}

function saveCorrectedPlan(plan) {
  const fs = require('fs');
  const correctedPlan = {
    timestamp: new Date().toISOString(),
    description: 'Corrected INSERT statements with all required fields for cached_entities',
    plan: plan
  };
  
  fs.writeFileSync('corrected-badge-sync.json', JSON.stringify(correctedPlan, null, 2));
  console.log('\n📄 Corrected sync plan saved to: corrected-badge-sync.json');
}

async function main() {
  console.log('🔧 CORRECTED BADGE SYNC GENERATOR');
  console.log('🎯 Generate INSERT statements with required neo4j_id and labels fields');
  
  const plan = await generateCorrectedInserts();
  saveCorrectedPlan(plan);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏆 CORRECTED SYNC PLAN');
  console.log('='.repeat(80));
  
  console.log(`\n📊 CORRECTIONS MADE:`);
  console.log(`   • Added required 'id' field (UUID generation)`);
  console.log(`   • Added required 'neo4j_id' field (placeholder values)`);
  console.log(`   • Added required 'labels' field (Entity, Club arrays)`);
  console.log(`   • Enhanced properties with name variants`);
  
  console.log(`\n📊 SYNCHRONIZATION PLAN:`);
  console.log(`   • Total teams: ${plan.totalTeams}`);
  console.log(`   • Premier League: 7 teams`);
  console.log(`   • Championship: 12 teams`);
  
  console.log(`\n🔧 EXECUTION STEPS:`);
  console.log(`   1. Execute corrected INSERT statements`);
  console.log(`   2. Run verification query`);
  console.log(`   3. Check navigator shows complete coverage`);
  
  console.log('\n✅ Ready to execute corrected SQL commands!');
}

main().catch(console.error);