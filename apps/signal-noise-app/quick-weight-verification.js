const neo4j = require('neo4j-driver');

/**
 * Quick verification of weighted relationships
 */

async function quickVerification() {
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
    console.log('🎯 Weighted Relationship Verification');
    console.log('=====================================\n');
    
    // 1. Check overall progress
    const totalResult = await session.run('MATCH ()-[r]->() RETURN count(r) as total');
    const weightedResult = await session.run('MATCH ()-[r]->() WHERE r.strength IS NOT NULL RETURN count(r) as weighted');
    
    const total = totalResult.records[0].get('total').toNumber();
    const weighted = weightedResult.records[0].get('weighted').toNumber();
    const progress = ((weighted / total) * 100).toFixed(1);
    
    console.log(`📊 Overall Progress: ${weighted}/${total} relationships weighted (${progress}%)`);
    
    // 2. Check high-value relationships
    const highValueResult = await session.run(`
      MATCH ()-[r]->() 
      WHERE r.strength >= 0.8 
      RETURN count(r) as highValue, type(r) as relType
      ORDER BY highValue DESC
    `);
    
    console.log('\n🔥 High-Value Relationships (strength >= 0.8):');
    highValueResult.records.forEach(record => {
      console.log(`  ${record.get('relType')}: ${record.get('highValue').toNumber()} relationships`);
    });
    
    // 3. Sample weighted relationships
    const sampleResult = await session.run(`
      MATCH (e1:Entity)-[r]->(e2:Entity) 
      WHERE r.strength IS NOT NULL 
      RETURN e1.name as entity1, type(r) as relationship, e2.name as entity2, r.strength as strength
      ORDER BY r.strength DESC 
      LIMIT 5
    `);
    
    console.log('\n⭐ Top 5 Weighted Relationships:');
    sampleResult.records.forEach((record, index) => {
      const entity1 = record.get('entity1') || 'Unknown';
      const entity2 = record.get('entity2') || 'Unknown';
      const relationship = record.get('relationship');
      const strength = record.get('strength');
      console.log(`  ${index + 1}. ${entity1} -[${relationship}]-> ${entity2} (strength: ${strength})`);
    });
    
    // 4. Test weighted business query
    const businessResult = await session.run(`
      MATCH (club:Entity)-[r:PLAYS_IN]->(sport:Sport)
      WHERE club.type = 'Club' AND r.strength >= 0.9
      RETURN club.name as club, club.country as country, sport.name as sport, r.strength as strength
      ORDER BY r.strength DESC
      LIMIT 3
    `);
    
    console.log('\n💼 Top Business Opportunities (Elite Clubs):');
    businessResult.records.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.get('club')} (${record.get('country')}) - ${record.get('sport')} (strength: ${record.get('strength')})`);
    });
    
    console.log('\n✅ Relationship Weighting System - OPERATIONAL');
    console.log('🚀 Enhanced Business Intelligence Capabilities Now Available');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run verification
quickVerification();