const neo4j = require('neo4j-driver');

async function queryEntities() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME || 'neo4j',
      process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
    )
  );
  
  const session = driver.session();
  
  try {
    console.log('🔍 Querying Neo4j for 50 sports entities starting from offset 650...');
    
    const result = await session.run(`
      MATCH (e:Entity)
      WHERE e.type IN ['Club','League','Federation','Tournament']
      RETURN e.name, e.sport, e.country
      SKIP 650 LIMIT 50
    `);
    
    const entities = result.records.map((record, index) => ({
      index: 650 + index + 1, // Actual position in the full list
      name: record.get('e.name'),
      sport: record.get('e.sport'),
      country: record.get('e.country')
    }));
    
    console.log(`✅ Found ${entities.length} entities:`);
    console.log('');
    
    // Format for easy parsing
    entities.forEach(entity => {
      console.log(`${entity.index}. ${entity.name} | ${entity.sport} | ${entity.country}`);
    });
    
    console.log('');
    console.log('JSON format for easy parsing:');
    console.log(JSON.stringify(entities, null, 2));
    
    return entities;
    
  } catch (error) {
    console.error('❌ Neo4j query error:', error.message);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

queryEntities().catch(console.error);