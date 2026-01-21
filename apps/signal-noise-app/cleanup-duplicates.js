require('dotenv').config();
const neo4j = require('neo4j-driver');

async function cleanupDuplicates() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    console.log('🧹 CLEANING UP DUPLICATE ENTITIES\n');
    
    // Arsenal cleanup
    console.log('🏆 Arsenal cleanup:');
    console.log('   KEEP: Arsenal Football Club (has badge)');
    
    // Mark Arsenal for removal
    await session.run(
      "MATCH (e:Entity) WHERE e.name = 'Arsenal' SET e.to_be_removed = true, e.removal_reason = 'duplicate_of_arsenal_fc', e.merge_target = 'Arsenal Football Club'"
    );
    console.log('   🗑️  Marked Arsenal for removal → Arsenal Football Club');
    
    // Mark Arsenal FC for removal
    await session.run(
      "MATCH (e:Entity) WHERE e.name = 'Arsenal FC' SET e.to_be_removed = true, e.removal_reason = 'duplicate_of_arsenal_fc', e.merge_target = 'Arsenal Football Club'"
    );
    console.log('   🗑️  Marked Arsenal FC for removal → Arsenal Football Club');
    
    // Premier League patterns
    const premierLeaguePatterns = [
      { keep: 'Manchester United', remove: 'Manchester United FC' },
      { keep: 'Manchester City', remove: 'Manchester City FC' },
      { keep: 'Liverpool', remove: 'Liverpool FC' },
      { keep: 'Chelsea', remove: 'Chelsea FC' },
      { keep: 'Tottenham', remove: 'Tottenham Hotspur' }
    ];
    
    console.log('\n⚽ Premier League cleanup:');
    let totalCleaned = 2; // Arsenal duplicates
    
    for (const pattern of premierLeaguePatterns) {
      console.log(`   ${pattern.keep} vs ${pattern.remove}:`);
      
      // Check if both exist
      const checkResult = await session.run(
        "MATCH (e:Entity) WHERE e.name IN [$keep, $remove] RETURN count(e) as count",
        { keep: pattern.keep, remove: pattern.remove }
      );
      
      if (checkResult.records[0].get('count').toNumber() === 2) {
        // Mark the FC version for removal
        await session.run(
          "MATCH (e:Entity) WHERE e.name = $remove SET e.to_be_removed = true, e.removal_reason = 'prefer_shorter_name', e.merge_target = $keep",
          { remove: pattern.remove, keep: pattern.keep }
        );
        console.log(`     🗑️  Marked ${pattern.remove} for removal → ${pattern.keep}`);
        totalCleaned++;
      } else {
        console.log(`     ℹ️  Only one version exists, no action needed`);
      }
    }
    
    console.log(`\n🎉 Successfully marked ${totalCleaned} duplicate entities for removal!`);
    
    // Show final status
    const removedResult = await session.run(
      "MATCH (e:Entity) WHERE e.to_be_removed = true RETURN e.name as name, e.merge_target as target"
    );
    
    console.log(`\n📋 Entities marked for removal (${removedResult.records.length}):`);
    removedResult.records.forEach(record => {
      console.log(`   🗑️  ${record.get('name')} → ${record.get('target')}`);
    });
    
    return totalCleaned;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return 0;
  } finally {
    await session.close();
    await driver.close();
  }
}

cleanupDuplicates();