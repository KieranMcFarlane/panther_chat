require('dotenv').config();
const neo4j = require('neo4j-driver');

// Common English Championship teams (2024/25 season)
const championshipTeams = [
  'Leicester City', 'Leeds United', 'Ipswich Town', 'Southampton', 'West Bromwich Albion',
  'Norwich City', 'Coventry City', 'Middlesbrough', 'Watford', 'Crystal Palace',
  'West Ham United', 'Burnley', 'Sheffield United', 'Reading', 'Fulham',
  'Derby County', 'Nottingham Forest', 'Aston Villa', 'Sunderland', 'Newcastle United',
  'Wolverhampton Wanderers', 'Cardiff City', 'Swansea City', 'Portsmouth', 'Hull City',
  'Stoke City', 'Wigan Athletic', 'Blackburn Rovers', 'Bolton Wanderers', 'Birmingham City'
];

async function discoverChampionshipTeams() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    console.log('🔍 DISCOVERING ENGLISH CHAMPIONSHIP TEAMS IN NEO4J\n');
    
    // Find teams with Championship mentioned in properties
    const championshipResult = await session.run(
      `MATCH (e:Entity) 
       WHERE e.league CONTAINS 'Championship' 
          OR e.division CONTAINS 'Championship'
          OR e.competition CONTAINS 'Championship'
       RETURN e.name as name, e.league as league, e.division as division, 
              e.badge_url as badgeUrl, elementId(e) as elementId,
              CASE WHEN e.badge_url IS NOT NULL THEN 'HAS BADGE' ELSE 'NEEDS BADGE' END as status
       ORDER BY e.name
       LIMIT 30`
    );
    
    console.log(`✅ Found ${championshipResult.records.length} entities with 'Championship' mentioned:`);
    
    let withBadges = 0;
    let withoutBadges = 0;
    const championshipEntities = [];
    
    championshipResult.records.forEach((record, index) => {
      const name = record.get('name');
      const league = record.get('league') || record.get('division');
      const badge = record.get('badgeUrl');
      const status = record.get('status');
      const elementId = record.get('elementId').split(':')[2];
      
      if (status === 'HAS BADGE') {
        withBadges++;
      } else {
        withoutBadges++;
      }
      
      championshipEntities.push({
        name,
        league,
        badge: badge || null,
        elementId,
        status
      });
      
      const badgeIcon = badge ? '✅' : '❌';
      console.log(`   ${index + 1}. ${badgeIcon} ${name}`);
      console.log(`      📊 League: ${league || 'Not specified'}`);
      console.log(`      🆔 ID: ${elementId}`);
    });
    
    // Also search for common Championship team names
    console.log('\n🔍 Searching for common Championship team names...');
    
    const commonTeamsResult = await session.run(
      `MATCH (e:Entity)
       WHERE e.name IN $teamNames
       RETURN e.name as name, e.badge_url as badgeUrl, e.league as league,
              CASE WHEN e.badge_url IS NOT NULL THEN 'HAS BADGE' ELSE 'NEEDS BADGE' END as status
       ORDER BY e.name`,
      { teamNames: championshipTeams.slice(0, 25) } // Limit to first 25
    );
    
    if (commonTeamsResult.records.length > 0) {
      console.log(`\n✅ Found ${commonTeamsResult.records.length} common Championship teams:`);
      
      commonTeamsResult.records.forEach((record, index) => {
        const name = record.get('name');
        const badge = record.get('badgeUrl');
        const league = record.get('league');
        const status = record.get('status');
        
        if (status === 'HAS BADGE') {
          console.log(`   ${index + 1}. ✅ ${name} (${league || 'No league'})`);
        } else {
          console.log(`   ${index + 1}. ❌ ${name} (${league || 'No league'})`);
        }
      });
    }
    
    // Summary
    console.log(`\n📊 CHAMPIONSHIP TEAM SUMMARY:`);
    console.log(`   🏆 Teams with 'Championship' mentioned: ${championshipResult.records.length}`);
    console.log(`   ✅ Already have badges: ${withBadges}`);
    console.log(`   ❌ Need badges: ${withoutBadges}`);
    console.log(`   📈 Badge coverage: ${Math.round((withBadges / championshipResult.records.length) * 100)}%`);
    
    // Create list of teams that need badges
    const teamsNeedingBadges = championshipEntities.filter(entity => entity.status === 'NEEDS BADGE');
    
    console.log(`\n🎯 TEAMS THAT NEED BADGES (${teamsNeedingBadges.length}):`);
    teamsNeedingBadges.forEach((entity, index) => {
      console.log(`   ${index + 1}. ${entity.name} (${entity.league || 'No league'})`);
    });
    
    return {
      totalFound: championshipResult.records.length,
      withBadges,
      withoutBadges: teamsNeedingBadges.length,
      teamsToProcess: teamsNeedingBadges,
      coveragePercentage: Math.round((withBadges / championshipResult.records.length) * 100)
    };
    
  } catch (error) {
    console.error('❌ Error discovering Championship teams:', error);
    return null;
  } finally {
    await session.close();
    await driver.close();
  }
}

discoverChampionshipTeams();