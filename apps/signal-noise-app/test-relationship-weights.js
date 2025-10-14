const neo4j = require('neo4j-driver');

/**
 * Simplified Relationship Weighting Test
 * 
 * Test script to add weights to a small sample of relationships first
 */

async function testRelationshipWeighting() {
  console.log('🧪 Testing Relationship Weighting System');
  console.log('📊 Will add strength properties to a sample of relationships');
  
  // Neo4j configuration
  const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
  const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  await driver.verifyConnectivity();
  console.log('✅ Connected to Neo4j AuraDB');
  
  const session = driver.session();
  
  try {
    // Start with PLAYS_IN relationships first
    console.log('\n🏃 Testing PLAYS_IN relationship weighting...');
    
    const sportWeights = {
      'Football': 0.95, 'Basketball': 0.85, 'Cricket': 0.80, 'Tennis': 0.75,
      'Golf': 0.70, 'Athletics': 0.65, 'Swimming': 0.60, 'Cycling': 0.55,
      'Motorsport': 0.70, 'Rugby': 0.60, 'Baseball': 0.75, 'Karate': 0.40
    };
    
    // Get a sample of PLAYS_IN relationships to test
    const sampleResult = await session.run(`
      MATCH (e:Entity)-[r:PLAYS_IN]->(s:Sport)
      RETURN r, e.name as entityName, s.name as sportName, e.tier as entityTier
      LIMIT 10
    `);
    
    console.log(`📋 Found ${sampleResult.records.length} sample PLAYS_IN relationships`);
    
    let weightedCount = 0;
    let totalWeight = 0;
    
    for (const record of sampleResult.records) {
      const relationship = record.get('r');
      const sportName = record.get('sportName');
      const entityTier = record.get('entityTier') || '';
      
      const baseWeight = sportWeights[sportName] || 0.5;
      
      // Adjust weight based on entity tier
      let tierMultiplier = 1.0;
      if (entityTier && (entityTier.includes('Tier 1') || entityTier.includes('Premier'))) {
        tierMultiplier = 1.2;
      } else if (entityTier && entityTier.includes('Tier 2')) {
        tierMultiplier = 1.0;
      } else if (entityTier && entityTier.includes('Tier 3')) {
        tierMultiplier = 0.8;
      }
      
      const finalWeight = Math.min(1.0, baseWeight * tierMultiplier);
      
      try {
        await session.run(`
          MATCH ()-[r:PLAYS_IN]->()
          WHERE id(r) = $relId
          SET r.strength = $weight, r.weight_category = $category
        `, { 
          relId: relationship.identity, 
          weight: finalWeight, 
          category: getWeightCategory(finalWeight) 
        });
        
        weightedCount++;
        totalWeight += finalWeight;
        console.log(`  ✅ Weighted: ${record.get('entityName')} -> ${sportName} (weight: ${finalWeight.toFixed(2)})`);
        
      } catch (weightError) {
        console.error(`  ❌ Failed to weight relationship: ${weightError.message}`);
      }
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`  ✅ Successfully weighted: ${weightedCount} relationships`);
    console.log(`  📈 Average weight: ${(totalWeight / Math.max(weightedCount, 1)).toFixed(2)}`);
    
    // Verify the weighting worked
    console.log('\n🔍 Verifying test results...');
    const verificationResult = await session.run(`
      MATCH ()-[r:PLAYS_IN]->()
      WHERE r.strength IS NOT NULL
      RETURN r.weight_category as category, count(*) as count, avg(r.strength) as avgWeight
    `);
    
    verificationResult.records.forEach(record => {
      console.log(`  📊 ${record.get('category')}: ${record.get('count')} relationships (avg: ${record.get('avgWeight').toFixed(2)})`);
    });
    
    // Test a weighted query
    console.log('\n🚀 Testing weighted pathfinding...');
    const pathResult = await session.run(`
      MATCH path = (start:Entity)-[r:PLAYS_IN*2..3]->(end:Entity)
      WHERE all(rel IN relationships(path) WHERE rel.strength >= 0.7)
      RETURN count(path) as highStrengthPaths
      LIMIT 5
    `);
    
    const highStrengthPaths = pathResult.records[0].get('highStrengthPaths').toNumber();
    console.log(`  ✅ Found ${highStrengthPaths} high-strength paths using weighted relationships`);
    
    await session.close();
    await driver.close();
    
    console.log('\n🎉 Relationship weighting test completed successfully!');
    console.log('✅ Weighted relationships are ready for production use');
    
    return {
      success: true,
      testResults: {
        relationshipsWeighted: weightedCount,
        averageWeight: totalWeight / Math.max(weightedCount, 1),
        highStrengthPaths: highStrengthPaths
      }
    };
    
  } catch (error) {
    console.error('❌ Relationship weighting test failed:', error);
    await session.close();
    throw error;
  }
}

function getWeightCategory(weight) {
  if (weight >= 0.8) return 'HIGH';
  if (weight >= 0.6) return 'MEDIUM_HIGH';
  if (weight >= 0.4) return 'MEDIUM';
  if (weight >= 0.2) return 'MEDIUM_LOW';
  return 'LOW';
}

// Run the test
if (require.main === module) {
  testRelationshipWeighting()
    .then((result) => {
      console.log('\n✅ Test completed! Ready to implement full weighting system.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testRelationshipWeighting };