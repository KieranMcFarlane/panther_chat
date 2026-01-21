// Test the new smart entities API

async function testSmartAPI() {
  console.log('🧪 TESTING SMART ENTITIES API');
  console.log('='.repeat(60));
  
  try {
    // Test LeagueNav context - should load Priority 100 sports teams first
    console.log('\n🏆 Testing LeagueNav context (should prioritize sports teams):');
    const leagueNavResponse = await fetch('http://localhost:3005/api/entities/smart?context=leaguenav&limit=2000');
    const leagueNavData = await leagueNavResponse.json();
    
    console.log(`📊 LeagueNav Results:`);
    console.log(`   • Entities loaded: ${leagueNavData.entities.length}`);
    console.log(`   • Loading strategy: ${leagueNavData.metadata?.loadingStrategy}`);
    console.log(`   • Duration: ${leagueNavData.metadata?.duration}`);
    
    // Count Premier League teams in LeagueNav results
    const leagueNavTeams = leagueNavData.entities.filter(entity => {
      const league = entity.properties?.league || entity.properties?.level || entity.properties?.competition;
      const sport = entity.properties?.sport?.toLowerCase() || '';
      return (league === 'Premier League') && sport.includes('football');
    });
    
    console.log(`   • Premier League teams: ${leagueNavTeams.length}`);
    if (leagueNavTeams.length > 0) {
      console.log('   🎉 Premier League teams found:');
      leagueNavTeams.slice(0, 10).forEach((team, index) => {
        console.log(`     ${index + 1}. ${team.properties.name} (Priority: ${team.properties._priority_score})`);
      });
      if (leagueNavTeams.length > 10) {
        console.log(`     ... and ${leagueNavTeams.length - 10} more`);
      }
    }
    
    // Test general context - should load all priorities
    console.log('\n🔍 Testing general context (should load all priorities):');
    const generalResponse = await fetch('http://localhost:3005/api/entities/smart?context=general&limit=1000');
    const generalData = await generalResponse.json();
    
    console.log(`📊 General Results:`);
    console.log(`   • Entities loaded: ${generalData.entities.length}`);
    console.log(`   • Loading strategy: ${generalData.metadata?.loadingStrategy}`);
    console.log(`   • Duration: ${generalData.metadata?.duration}`);
    
    // Check priority distribution in general results
    const priorityDistribution = {};
    generalData.entities.forEach(entity => {
      const priority = entity.properties._priority_score || 0;
      priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
    });
    
    console.log('   • Priority distribution:');
    Object.entries(priorityDistribution)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .forEach(([priority, count]) => {
        console.log(`     Priority ${priority}: ${count} entities`);
      });
    
    // Test priority statistics
    console.log('\n📈 Testing priority statistics:');
    const statsResponse = await fetch('http://localhost:3005/api/entities/smart', { method: 'PUT' });
    const statsData = await statsResponse.json();
    
    console.log(`📊 Priority Stats:`);
    console.log(`   • Total entities with priorities: ${statsData.totalEntities}`);
    console.log(`   • Priority range: ${statsData.lowestPriority} - ${statsData.highestPriority}`);
    
    console.log('   • Priority breakdown:');
    Object.entries(statsData.priorityDistribution).forEach(([key, info]) => {
      const [_, priority, category] = key.split('_');
      console.log(`     Priority ${priority} (${category}): ${info.count} entities`);
    });
    
    // Performance comparison
    console.log('\n⚡ PERFORMANCE ANALYSIS:');
    console.log(`LeagueNav: ${leagueNavData.metadata?.duration} for ${leagueNavData.entities.length} entities`);
    console.log(`General: ${generalData.metadata?.duration} for ${generalData.entities.length} entities`);
    
    const leagueNavAvg = leagueNavData.entities.length / parseFloat(leagueNavData.metadata?.duration || '1');
    const generalAvg = generalData.entities.length / parseFloat(generalData.metadata?.duration || '1');
    
    console.log(`LeagueNav throughput: ${leagueNavAvg.toFixed(2)} entities/ms`);
    console.log(`General throughput: ${generalAvg.toFixed(2)} entities/ms`);
    
    // Final verification
    if (leagueNavTeams.length >= 21) {
      console.log('\n✅ SUCCESS: All Premier League teams accessible via smart API!');
      console.log('The LeagueNav component should now show complete coverage.');
    } else {
      console.log(`\n⚠️ ISSUE: Still only ${leagueNavTeams.length} Premier League teams`);
      console.log('Expected: 21 teams');
    }
    
  } catch (error) {
    console.error('❌ Error testing smart API:', error.message);
  }
}

testSmartAPI();