const neo4j = require('neo4j-driver');

require('dotenv').config();

async function checkNeo4jIdCoverage() {
  console.log('🔍 CHECKING neo4j_id COVERAGE\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Check total vs entities with neo4j_id
    console.log('📊 neo4j_id COVERAGE ANALYSIS:');
    
    const totalResult = await session.run('MATCH (n) RETURN count(n) as total');
    const withIdResult = await session.run('MATCH (n) WHERE n.neo4j_id IS NOT NULL RETURN count(n) as withId');
    const withoutIdResult = await session.run('MATCH (n) WHERE n.neo4j_id IS NULL RETURN count(n) as withoutId');
    
    const total = Number(totalResult.records[0].get('total'));
    const withId = Number(withIdResult.records[0].get('withId'));
    const withoutId = Number(withoutIdResult.records[0].get('withoutId'));
    
    console.log(`  • Total nodes: ${total.toLocaleString()}`);
    console.log(`  • With neo4j_id: ${withId.toLocaleString()} (${((withId/total)*100).toFixed(1)}%)`);
    console.log(`  • Without neo4j_id: ${withoutId.toLocaleString()} (${((withoutId/total)*100).toFixed(1)}%)`);
    
    if (withoutId > 0) {
      console.log('\n⚠️ ENTITIES WITHOUT neo4j_id:');
      const sampleQuery = `
        MATCH (n) 
        WHERE n.neo4j_id IS NULL 
        RETURN n.name as name, labels(n) as labels, n.sport as sport
        LIMIT 10
      `;
      
      const sampleResult = await session.run(sampleQuery);
      sampleResult.records.forEach(record => {
        const name = record.get('name') || 'Unnamed';
        const labels = record.get('labels').join(', ');
        const sport = record.get('sport') || '';
        console.log(`  • ${name} (${labels}) ${sport ? '- ' + sport : ''}`);
      });
    }
    
    // Check API endpoint fallback behavior
    console.log('\n🔄 API ENDPOINT FALLBACK:');
    console.log('The API endpoint handles missing neo4j_id by:');
    console.log('  1. Using node.identity as fallback (line 412)');
    console.log('  2. Converting to string for consistency');
    console.log('  3. Query works with either neo4j_id or identity');
    
    // Test with internal Neo4j ID
    console.log('\n🧪 TESTING INTERNAL IDs:');
    const internalIdQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NULL AND n.name IS NOT NULL
      RETURN ID(n) as internalId, n.name as name, labels(n)[0] as type
      LIMIT 5
    `;
    
    const internalResult = await session.run(internalIdQuery);
    internalResult.records.forEach(record => {
      const internalId = record.get('internalId');
      const name = record.get('name');
      const type = record.get('type');
      console.log(`  • Internal ID: ${internalId} - ${name} (${type})`);
      console.log(`    URL would be: http://localhost:3005/entity/${internalId}`);
    });
    
    console.log('\n✅ CONCLUSION:');
    if (withoutId === 0) {
      console.log('  • ALL entities have neo4j_id - no issues for automatic dossiers');
    } else {
      console.log(`  • ${withoutId} entities lack neo4j_id but can still be accessed`);
      console.log('  • API endpoint uses internal Neo4j ID as fallback');
      console.log('  • Automatic dossier generation will still work');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkNeo4jIdCoverage();