// Test the entities API to verify LeagueNav fix

const fetch = require('node-fetch');

async function testEntitiesAPI() {
  console.log('🧪 TESTING ENTITIES API FOR LEAGUENAV FIX');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch('http://localhost:3005/api/entities?limit=2000&useCache=true');
    const data = await response.json();
    
    console.log(`📊 Total entities: ${data.entities.length}`);
    console.log(`📊 Source: ${data.source}`);
    
    // Filter for football clubs with league info
    const footballClubs = data.entities.filter(entity => {
      const sport = entity.properties?.sport?.toLowerCase() || '';
      const type = entity.properties?.type?.toLowerCase() || '';
      const labels = entity.labels || [];
      
      const isClub = type.includes('club') || type.includes('team') || 
                     labels.some(label => label.toLowerCase().includes('club') || label.toLowerCase().includes('team'));
      const isFootball = sport.includes('football') || sport.includes('soccer');
      
      const hasLeagueInfo = !!(entity.properties?.league || entity.properties?.level || entity.properties?.competition);
      
      return isClub && isFootball && hasLeagueInfo;
    });
    
    console.log(`⚽ Football clubs with league info: ${footballClubs.length}`);
    
    // Group by league
    const leagues = {};
    footballClubs.forEach(club => {
      const league = club.properties?.league || club.properties?.level || club.properties?.competition || 'Unknown';
      if (!leagues[league]) {
        leagues[league] = [];
      }
      leagues[league].push(club.properties?.name);
    });
    
    console.log('\n🏆 ENGLISH FOOTBALL LEAGUES:');
    Object.entries(leagues)
      .filter(([league, teams]) => 
        league.toLowerCase().includes('premier') || 
        league.toLowerCase().includes('championship') ||
        league.toLowerCase().includes('league one') ||
        league.toLowerCase().includes('league two')
      )
      .sort(([a], [b]) => {
        // Sort by league hierarchy
        const order = ['Premier League', 'English League Championship', 'League One', 'League Two'];
        const aIndex = order.findIndex(l => a.includes(l));
        const bIndex = order.findIndex(l => b.includes(l));
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
      .forEach(([league, teams]) => {
        console.log(`  ${league}: ${teams.length} teams`);
        teams.sort().forEach(team => {
          console.log(`    - ${team}`);
        });
      });
    
    // Specifically check Premier League
    const premierLeagueTeams = leagues['Premier League'] || [];
    console.log(`\n✅ PREMIER LEAGUE VERIFICATION:`);
    console.log(`   Expected: 21 teams`);
    console.log(`   Found: ${premierLeagueTeams.length} teams`);
    
    if (premierLeagueTeams.length === 21) {
      console.log(`   🎉 SUCCESS: Premier League is complete!`);
    } else {
      console.log(`   ⚠️  ISSUE: Missing ${21 - premierLeagueTeams.length} teams`);
    }
    
    // Check for Championship
    const championshipTeams = leagues['English League Championship'] || [];
    console.log(`\n✅ CHAMPIONSHIP VERIFICATION:`);
    console.log(`   Found: ${championshipTeams.length} teams`);
    
    // Check total English football coverage
    const englishLeagues = ['Premier League', 'English League Championship', 'League One', 'League Two'];
    const totalEnglishTeams = englishLeagues.reduce((total, league) => {
      return total + (leagues[league] || []).length;
    }, 0);
    
    console.log(`\n📊 TOTAL ENGLISH FOOTBALL COVERAGE:`);
    console.log(`   All English leagues: ${totalEnglishTeams} teams`);
    console.log(`   Expected total: 83 teams (21 + 13 + 25 + 24)`);
    
    if (totalEnglishTeams === 83) {
      console.log(`   🏆 PERFECT: Complete English football coverage!`);
    } else {
      console.log(`   ⚠️  Missing ${83 - totalEnglishTeams} teams`);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testEntitiesAPI();