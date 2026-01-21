const { Neo4jService } = require('./src/lib/neo4j');
require('dotenv').config();

async function processEntitiesForRFP() {
  const neo4j = new Neo4jService();
  await neo4j.initialize();
  
  try {
    const session = neo4j.getDriver().session();
    try {
      // Query 50 entities starting from offset 50
      const result = await session.run(`
        MATCH (e:Entity)
        WHERE e.type IN ['Club','League','Federation','Tournament']
        RETURN e.name as name, e.sport as sport, e.country as country
        SKIP 50 LIMIT 50
      `);
      
      const entities = result.records.map(record => ({
        name: record.get('name'),
        sport: record.get('sport'),
        country: record.get('country')
      }));
      
      console.log('Entities to process:', entities.length);
      console.log('First few entities:', entities.slice(0, 5));
      
      return entities;
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('❌ Failed to query entities:', error);
    return [];
  } finally {
    await neo4j.close();
  }
}

processEntitiesForRFP().then(entities => {
  console.log(`Found ${entities.length} entities to process`);
}).catch(console.error);