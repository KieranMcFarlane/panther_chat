const neo4j = require('neo4j-driver');

/**
 * Monitor Relationship Weighting Progress
 */

async function monitorWeightingProgress() {
  const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
  const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  await driver.verifyConnectivity();
  const session = driver.session();
  
  try {
    // Get total relationships and weighted relationships count
    const totalResult = await session.run('MATCH ()-[r]->() RETURN count(r) as total');
    const totalRels = totalResult.records[0].get('total').toNumber();
    
    const weightedResult = await session.run(`
      MATCH ()-[r]->()
      WHERE r.strength IS NOT NULL
      RETURN count(r) as weighted, type(r) as relType
    `);
    
    const weightedRels = weightedResult.records.reduce((sum, record) => sum + record.get('weighted').toNumber(), 0);
    const progress = ((weightedRels / totalRels) * 100).toFixed(1);
    
    console.log('📊 Relationship Weighting Progress:');
    console.log(`Total relationships: ${totalRels}`);
    console.log(`Weighted relationships: ${weightedRels}`);
    console.log(`Progress: ${progress}%`);
    
    if (weightedRels > 0) {
      console.log('\n📋 Weighted by type:');
      const byType = {};
      weightedResult.records.forEach(record => {
        const type = record.get('relType');
        const count = record.get('weighted').toNumber();
        byType[type] = (byType[type] || 0) + count;
      });
      
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} relationships`);
      });
      
      // Test a weighted query
      const testResult = await session.run(`
        MATCH (e:Entity)
        OPTIONAL MATCH (e)-[r:PLAYS_IN]->(s:Sport)
        RETURN e.name as entityName, s.name as sportName, r.strength as strength
        WHERE r.strength IS NOT NULL
        LIMIT 5
      `);
      
      console.log('\n🔍 Sample weighted relationships:');
      testResult.records.forEach(record => {
        console.log(`  ${record.get('entityName')} -> ${record.get('sportName')} (strength: ${record.get('strength')?.toFixed(2)})`);
      });
    }
    
    await session.close();
    await driver.close();
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error);
  }
}

// Run monitoring
monitorWeightingProgress();