const neo4j = require('neo4j-driver');

// Test connection to the correct Neo4j database with 4,000+ entities
async function testCorrectNeo4j() {
  console.log('🔧 Testing correct Neo4j database with 4,000+ entities...');
  
  try {
    // Use the complete correct URI
    const driver = neo4j.driver(
      'neo4j+s://cce1f84b.databases.neo4j.io', // Full URI
      neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
    );

    await driver.verifyConnectivity();
    console.log('✅ Connected to correct Neo4j database');

    const session = driver.session();
    
    // Count ALL entities
    console.log('\n📊 Counting all entities...');
    const totalResult = await session.run(`
      MATCH (n)
      RETURN count(n) as total
    `);
    const total = totalResult.records[0].get('total').toNumber();
    console.log(`Total entities: ${total}`);
    
    // Count entities with names
    console.log('\n📊 Counting entities with names...');
    const namedResult = await session.run(`
      MATCH (n)
      WHERE n.name IS NOT NULL
      RETURN count(n) as named
    `);
    const named = namedResult.records[0].get('named').toNumber();
    console.log(`Entities with names: ${named}`);
    
    // Get sample entities
    console.log('\n📊 Getting sample entities...');
    const sampleResult = await session.run(`
      MATCH (n)
      WHERE n.name IS NOT NULL
      RETURN n.name as name, labels(n) as labels
      ORDER BY n.name
      LIMIT 10
    `);
    
    console.log('Sample entities:');
    sampleResult.records.forEach(record => {
      console.log(`  - ${record.get('name')} (${record.get('labels').join(', ')})`);
    });

    await session.close();
    await driver.close();
    
    console.log(`\n✅ SUCCESS: Found ${total} total entities, ${named} with names`);
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testCorrectNeo4j();