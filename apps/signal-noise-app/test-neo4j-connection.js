const neo4j = require('neo4j-driver');

// Use environment variables
const uri = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';

async function testNeo4jConnection() {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();
  
  try {
    console.log('Testing Neo4j connection...');
    console.log(`URI: ${uri}`);
    console.log(`User: ${user}`);
    
    // Test basic connectivity
    const result = await session.run('RETURN 1 as test');
    console.log('✅ Basic connection successful');
    
    // Test the specific query from RFP monitoring
    const entities = await session.run(`
      MATCH (e:Entity)
      WHERE e.type IN ['Club','League','Federation','Tournament']
      RETURN e.name, e.sport, e.country
      SKIP 0 LIMIT 10
    `);
    
    console.log(`✅ Found ${entities.records.length} entities`);
    console.log('Sample entities:');
    entities.records.forEach((record, index) => {
      const name = record.get('e.name');
      const sport = record.get('e.sport');
      const country = record.get('e.country');
      console.log(`  ${index + 1}. ${name} (${sport}) - ${country}`);
    });
    
    return entities.records.map(record => ({
      name: record.get('e.name'),
      sport: record.get('e.sport'),
      country: record.get('e.country')
    }));
    
  } catch (error) {
    console.error('❌ Neo4j connection failed:', error.message);
    return [];
  } finally {
    await session.close();
    await driver.close();
  }
}

testNeo4jConnection().then(entities => {
  console.log('\n=== ENTITY DATA FOR RFP MONITORING ===');
  console.log(JSON.stringify(entities, null, 2));
}).catch(console.error);