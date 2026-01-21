const neo4j = require('neo4j-driver');

async function getEntities() {
  let driver = null;
  let session = null;
  
  try {
    // Initialize Neo4j connection
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || 'neo4j',
        process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
      )
    );
    
    session = driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.READ
    });
    
    // Execute the query
    const query = `
      MATCH (e:Entity)
      WHERE e.type IN ['Club','League','Federation','Tournament']
      RETURN e.name, e.sport, e.country
      SKIP 700 LIMIT 50
    `;
    
    console.log('Executing query:', query);
    
    const result = await session.run(query);
    
    // Transform the records into a more usable format
    const entities = result.records.map((record, index) => {
      return {
        index: index + 700,
        name: record.get('e.name'),
        sport: record.get('e.sport'),
        country: record.get('e.country')
      };
    });
    
    console.log(`Found ${entities.length} entities starting from offset 700:`);
    console.log(JSON.stringify(entities, null, 2));
    
    return entities;
    
  } catch (error) {
    console.error('Error querying Neo4j:', error);
    throw error;
  } finally {
    if (session) {
      await session.close();
    }
    if (driver) {
      await driver.close();
    }
  }
}

// Run the query
getEntities().catch(console.error);