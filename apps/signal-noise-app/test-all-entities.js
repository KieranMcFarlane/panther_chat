const neo4j = require('neo4j-driver');

// Get all available entities from the Neo4j database
async function getAllEntities() {
  console.log('🔧 Fetching ALL entities from Neo4j AuraDB...');
  
  try {
    const driver = neo4j.driver(
      'neo4j+s://cce1f84b.databases.neo4j.io',
      neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
    );

    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j AuraDB successfully');

    const session = driver.session();
    
    // Get ALL entities with proper label handling
    console.log('\n📊 Fetching ALL entities...');
    const allEntitiesResult = await session.run(`
      MATCH (n)
      WHERE n.name IS NOT NULL
      RETURN n, labels(n) as labels, elementId(n) as id
      ORDER BY n.name
    `);
    
    console.log(`Found ${allEntitiesResult.records.length} entities with names:`);
    
    const entities = allEntitiesResult.records.map(record => {
      const node = record.get('n');
      const labels = record.get('labels');
      const id = record.get('id');
      
      return {
        id: id,
        name: node.properties.name || 'Unknown',
        labels: labels,
        properties: node.properties,
        entity_type: determineEntityType(labels)
      };
    });
    
    entities.forEach((entity, index) => {
      console.log(`${index + 1}. ${entity.name} (${entity.labels.join(', ')}) - ID: ${entity.id}`);
    });
    
    // Get relationships
    console.log('\n📊 Fetching relationships...');
    const relationshipsResult = await session.run(`
      MATCH (a)-[r]->(b)
      WHERE a.name IS NOT NULL AND b.name IS NOT NULL
      RETURN a.name as from, b.name as to, type(r) as relationship, labels(a) as fromLabels, labels(b) as toLabels
    `);
    
    console.log(`Found ${relationshipsResult.records.length} relationships:`);
    relationshipsResult.records.forEach(record => {
      console.log(`  ${record.get('from')} -> ${record.get('to')} (${record.get('relationship')})`);
    });
    
    await session.close();
    await driver.close();
    
    return { entities, relationships: relationshipsResult.records };
    
  } catch (error) {
    console.error('❌ Failed to fetch entities:', error);
    return { entities: [], relationships: [] };
  }
}

function determineEntityType(labels) {
  if (labels.includes('Club') || labels.includes('Company')) return 'club';
  if (labels.includes('League')) return 'league';
  if (labels.includes('Competition')) return 'competition';
  if (labels.includes('Venue')) return 'venue';
  if (labels.includes('RfpOpportunity') || labels.includes('RFP')) return 'tender';
  if (labels.includes('Stakeholder')) return 'poi';
  return 'entity';
}

getAllEntities().then(result => {
  console.log(`\n✅ SUCCESS: Retrieved ${result.entities.length} entities and ${result.relationships.length} relationships`);
  console.log('Ready to update the graph with all available data!');
});