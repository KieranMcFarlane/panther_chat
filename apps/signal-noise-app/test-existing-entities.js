const neo4j = require('neo4j-driver');

async function testExistingEntities() {
  require('dotenv').config();
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    console.log('🔍 Testing existing entities in Neo4j...');
    
    // Get first 10 entities with their neo4j_id and names
    const result = await session.run(`
      MATCH (n) 
      WHERE n.neo4j_id IS NOT NULL
      RETURN n.neo4j_id as neo4j_id, n.name as name, labels(n) as labels
      LIMIT 10
    `);
    
    console.log('Found entities:');
    result.records.forEach(record => {
      console.log(`ID: ${record.get('neo4j_id')}, Name: ${record.get('name')}, Labels: ${record.get('labels').join(', ')}`);
    });
    
    // Test specific entity 148 (Sunderland)
    console.log('\n🎯 Testing Sunderland (ID 148)...');
    const sunderlandResult = await session.run(`
      MATCH (n) 
      WHERE n.neo4j_id = 148
      RETURN n.name as name, n.dossier_data as dossier_data, labels(n) as labels
    `);
    
    if (sunderlandResult.records.length > 0) {
      const record = sunderlandResult.records[0];
      console.log(`✅ Found Sunderland: ${record.get('name')}`);
      console.log(`Has dossier_data: ${record.get('dossier_data') ? 'Yes' : 'No'}`);
      console.log(`Labels: ${record.get('labels').join(', ')}`);
    } else {
      console.log('❌ Sunderland not found');
    }
    
    // Check if there are any entities without dossier_data
    console.log('\n🔍 Checking entities without dossier_data...');
    const noDossierResult = await session.run(`
      MATCH (n) 
      WHERE n.neo4j_id IS NOT NULL AND n.dossier_data IS NULL
      RETURN n.neo4j_id as neo4j_id, n.name as name, labels(n) as labels
      LIMIT 5
    `);
    
    console.log('Entities without dossier_data:');
    noDossierResult.records.forEach(record => {
      console.log(`ID: ${record.get('neo4j_id')}, Name: ${record.get('name')}, Labels: ${record.get('labels').join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

testExistingEntities();