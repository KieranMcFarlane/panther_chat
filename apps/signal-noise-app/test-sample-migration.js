const neo4j = require('neo4j-driver');

async function migrateWithManualData() {
  console.log('🚀 Starting Migration with Manual Entity Processing');
  
  // Neo4j configuration
  const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
  const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  await driver.verifyConnectivity();
  console.log('✅ Connected to Neo4j AuraDB');
  
  const session = driver.session();
  
  try {
    // Check current state
    const currentCountResult = await session.run('MATCH (n) RETURN count(n) as current');
    const currentCount = currentCountResult.records[0].get('current').toNumber();
    console.log(`📊 Current Neo4j entities: ${currentCount}`);
    
    // Clear existing entities
    if (currentCount > 0) {
      console.log('🗑️ Clearing existing entities...');
      await session.run('MATCH (n) DETACH DELETE n');
      console.log('✅ Cleared existing entities');
    }
    
    // Setup constraints
    console.log('🔧 Setting up constraints...');
    const constraints = [
      'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.neo4j_id IS UNIQUE',
      'CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.neo4j_id IS UNIQUE',
      'CREATE CONSTRAINT country_id_unique IF NOT EXISTS FOR (c:Country) REQUIRE c.neo4j_id IS UNIQUE',
      'CREATE CONSTRAINT sport_id_unique IF NOT EXISTS FOR (s:Sport) REQUIRE s.neo4j_id IS UNIQUE',
      'CREATE CONSTRAINT league_id_unique IF NOT EXISTS FOR (l:League) REQUIRE l.neo4j_id IS UNIQUE',
      'CREATE CONSTRAINT venue_id_unique IF NOT EXISTS FOR (v:Venue) REQUIRE v.neo4j_id IS UNIQUE',
      'CREATE CONSTRAINT federation_id_unique IF NOT EXISTS FOR (f:Federation) REQUIRE f.neo4j_id IS UNIQUE'
    ];
    
    for (const constraint of constraints) {
      try {
        await session.run(constraint);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn(`⚠️ Warning creating constraint: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Constraints setup complete');
    
    // First, let's create a small sample of entities to test
    console.log('📦 Creating sample entities for testing...');
    
    const sampleEntities = [
      {
        neo4j_id: '197',
        labels: ['Entity', 'Club'],
        properties: {
          name: '1. FC Köln',
          type: 'Club',
          sport: 'Football',
          country: 'Germany',
          tier: 'Tier 1',
          division: 'Bundesliga'
        },
        badge_s3_url: null
      },
      {
        neo4j_id: '198',
        labels: ['Entity', 'Club'],
        properties: {
          name: 'FC Bayern Munich',
          type: 'Club',
          sport: 'Football',
          country: 'Germany',
          tier: 'Tier 1',
          division: 'Bundesliga'
        },
        badge_s3_url: null
      },
      {
        neo4j_id: '199',
        labels: ['Entity', 'League'],
        properties: {
          name: 'Bundesliga',
          type: 'League',
          sport: 'Football',
          country: 'Germany',
          tier: 'Tier 1'
        },
        badge_s3_url: null
      },
      {
        neo4j_id: '200',
        labels: ['Entity', 'Sport'],
        properties: {
          name: 'Football',
          type: 'Sport',
          category: 'Team Sport',
          popularity: 'High'
        },
        badge_s3_url: null
      },
      {
        neo4j_id: '201',
        labels: ['Entity', 'Country'],
        properties: {
          name: 'Germany',
          type: 'Country',
          region: 'Europe',
          code: 'DE'
        },
        badge_s3_url: null
      }
    ];
    
    let createdCount = 0;
    for (const entity of sampleEntities) {
      try {
        await createEntityInNeo4j(session, entity);
        createdCount++;
        console.log(`✅ Created entity: ${entity.properties.name || entity.neo4j_id}`);
      } catch (error) {
        console.error(`❌ Failed to create entity ${entity.neo4j_id}:`, error.message);
      }
    }
    
    console.log(`✅ Sample migration completed: ${createdCount} entities created`);
    
    // Now check final state
    const finalCountResult = await session.run('MATCH (n) RETURN count(n) as final');
    const finalCount = finalCountResult.records[0].get('final').toNumber();
    
    console.log(`📈 Final entity count: ${finalCount}`);
    
    await session.close();
    await driver.close();
    
    console.log('✅ Sample migration completed successfully!');
    console.log('📥 Ready for full migration via MCP functions');
    
    return {
      success: true,
      createdEntities: createdCount,
      finalCount: finalCount
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await session.close();
    throw error;
  }
}

async function createEntityInNeo4j(session, entity) {
  const { neo4j_id, labels, properties, badge_s3_url } = entity;
  
  if (!neo4j_id || !labels || labels.length === 0) {
    throw new Error(`Invalid entity data: missing neo4j_id or labels for entity ${neo4j_id}`);
  }
  
  // Clean and prepare labels for Cypher
  const cleanLabels = labels.map(label => 
    label.replace(/[^a-zA-Z0-9_]/g, '_')
  );
  
  // Prepare properties with all necessary data
  const entityProperties = {
    neo4j_id: neo4j_id,
    badge_s3_url: badge_s3_url,
    migrated_at: new Date().toISOString(),
    migration_version: '1.0',
    ...properties
  };
  
  // Clean properties to handle Neo4j compatibility
  const cleanedProperties = cleanPropertiesForNeo4j(entityProperties);
  
  // Build the CREATE query with dynamic labels
  const labelString = cleanLabels.join(':');
  const createQuery = `
    CREATE (n:${labelString})
    SET n = $properties
    RETURN n
  `;
  
  return await session.run(createQuery, { properties: cleanedProperties });
}

function cleanPropertiesForNeo4j(properties) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) {
      continue;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length > 0) {
        cleaned[key] = value;
      }
    }
    // Handle objects - convert to JSON string or flatten
    else if (typeof value === 'object' && value.constructor === Object) {
      try {
        cleaned[key] = JSON.stringify(value);
      } catch {
        // If JSON.stringify fails, convert to string
        cleaned[key] = String(value);
      }
    }
    // Handle strings - clean up problematic characters
    else if (typeof value === 'string') {
      cleaned[key] = value
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/'/g, "\\'") // Escape single quotes
        .trim();
    }
    else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

// Run the migration
if (require.main === module) {
  migrateWithManualData()
    .then((result) => {
      console.log('\n✅ Sample migration completed successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      console.log('\n📥 Next step: Use MCP functions to migrate all 4,422 entities');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Sample migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateWithManualData };