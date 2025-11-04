const neo4j = require('neo4j-driver');

// Since we can't import MCP functions directly, we'll use a fetch-based approach
async function fetchEntitiesFromAPI(offset = 0, limit = 50) {
  try {
    const response = await fetch('http://localhost:3005/api/migration/get-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offset: offset,
        limit: limit
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.success ? result.entities : [];
  } catch (error) {
    console.error(`Failed to fetch batch at offset ${offset}:`, error.message);
    return [];
  }
}

async function migrateAllEntities() {
  console.log('🚀 Starting Complete Migration: All 4,422 entities');
  
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
    console.log('🔧 Setting up constraints and indexes...');
    await setupConstraintsAndIndexes(session);
    
    // Process all entities in batches
    const BATCH_SIZE = 100;
    const TOTAL_ENTITIES = 4422;
    let totalProcessed = 0;
    let createdCount = 0;
    let errors = [];
    
    for (let offset = 0; offset < TOTAL_ENTITIES; offset += BATCH_SIZE) {
      console.log(`📦 Processing batch ${Math.floor(offset/BATCH_SIZE) + 1}: entities ${offset + 1} to ${Math.min(offset + BATCH_SIZE, TOTAL_ENTITIES)}`);
      
      // Fetch entities via API
      const entities = await fetchEntitiesFromAPI(offset, BATCH_SIZE);
      
      if (!entities || entities.length === 0) {
        console.log('📝 No more entities to process');
        break;
      }
      
      // Process batch in transaction
      const tx = session.beginTransaction();
      try {
        let batchCreated = 0;
        for (const entity of entities) {
          try {
            await createEntityInNeo4j(tx, entity);
            batchCreated++;
            createdCount++;
          } catch (entityError) {
            const errorMsg = `Failed to create entity ${entity.neo4j_id}: ${entityError.message}`;
            errors.push(errorMsg);
            console.warn(`⚠️ ${errorMsg}`);
          }
        }
        
        await tx.commit();
        totalProcessed += entities.length;
        
        const progress = Math.round((totalProcessed/TOTAL_ENTITIES)*100);
        console.log(`✅ Batch completed: ${batchCreated}/${entities.length} entities created. Progress: ${totalProcessed}/${TOTAL_ENTITIES} (${progress}%)`);
        
      } catch (txError) {
        console.error(`❌ Transaction failed for batch starting at offset ${offset}:`, txError);
        await tx.rollback();
        errors.push(`Transaction failed: ${txError.message}`);
      }
      
      // Add a small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Create relationships
    console.log('🔗 Creating relationships between entities...');
    const relationshipStats = await createRelationshipsFromProperties(session);
    
    // Create vector index
    console.log('🔍 Creating vector index for semantic search...');
    try {
      await session.run(`
        CREATE VECTOR INDEX entity_embeddings IF NOT EXISTS
        FOR (n:Entity)
        ON n.embedding
        OPTIONS {
          indexConfig: {
            \`vector.dimensions\`: 1536,
            \`vector.similarity_function\`: 'cosine'
          }
        }
      `);
      console.log('✅ Vector index created/verified');
    } catch (indexError) {
      console.warn(`⚠️ Warning creating vector index: ${indexError.message}`);
    }
    
    // Verify final state
    const finalCountResult = await session.run('MATCH (n) RETURN count(n) as final');
    const finalCount = finalCountResult.records[0].get('final').toNumber();
    
    const relationshipCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
    const relationshipCount = relationshipCountResult.records[0].get('relCount').toNumber();
    
    // Get sample of created entities
    const sampleResult = await session.run(`
      MATCH (n:Entity) 
      WHERE n.name IS NOT NULL 
      RETURN n.name as name, n.type as type, n.sport as sport 
      LIMIT 15
    `);
    
    const createdSampleEntities = sampleResult.records.map(record => ({
      name: record.get('name'),
      type: record.get('type'),
      sport: record.get('sport')
    }));
    
    await session.close();
    await driver.close();
    
    console.log('\n🎉 FULL MIGRATION COMPLETE!');
    console.log(`📊 Target entities: ${TOTAL_ENTITIES}`);
    console.log(`📊 Processed entities: ${totalProcessed}`);
    console.log(`✅ Created entities: ${createdCount}`);
    console.log(`📈 Final entity count: ${finalCount}`);
    console.log(`🔗 Created relationships: ${relationshipCount}`);
    
    return {
      success: true,
      stats: {
        targetEntities: TOTAL_ENTITIES,
        processedEntities: totalProcessed,
        createdEntities: createdCount,
        finalEntityCount: finalCount,
        relationshipCount: relationshipCount,
        relationshipStats: relationshipStats,
        errors: errors,
        sampleEntities: createdSampleEntities,
        migrationCompleteness: `${Math.round((createdCount/TOTAL_ENTITIES)*100)}%`,
        note: `Successfully migrated ${createdCount} out of ${TOTAL_ENTITIES} entities from Supabase cached_entities table`
      }
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await session.close();
    throw error;
  }
}

async function setupConstraintsAndIndexes(session) {
  const constraints = [
    'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT country_id_unique IF NOT EXISTS FOR (c:Country) REQUIRE c.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT sport_id_unique IF NOT EXISTS FOR (s:Sport) REQUIRE s.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT league_id_unique IF NOT EXISTS FOR (l:League) REQUIRE l.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT venue_id_unique IF NOT EXISTS FOR (v:Venue) REQUIRE v.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT federation_id_unique IF NOT EXISTS FOR (f:Federation) REQUIRE f.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT team_id_unique IF NOT EXISTS FOR (t:Team) REQUIRE t.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT organization_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.neo4j_id IS UNIQUE'
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

  const indexes = [
    'CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)',
    'CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type)',
    'CREATE INDEX entity_sport_index IF NOT EXISTS FOR (e:Entity) ON (e.sport)',
    'CREATE INDEX entity_country_index IF NOT EXISTS FOR (e:Entity) ON (e.country)',
    'CREATE INDEX entity_tier_index IF NOT EXISTS FOR (e:Entity) ON (e.tier)',
    'CREATE INDEX league_name_index IF NOT EXISTS FOR (l:League) ON (l.name)',
    'CREATE INDEX country_name_index IF NOT EXISTS FOR (c:Country) ON (c.name)',
    'CREATE INDEX sport_name_index IF NOT EXISTS FOR (s:Sport) ON (s.name)'
  ];

  for (const index of indexes) {
    try {
      await session.run(index);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.warn(`⚠️ Warning creating index: ${error.message}`);
      }
    }
  }
}

async function createEntityInNeo4j(tx, entity) {
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
  
  return await tx.run(createQuery, { properties: cleanedProperties });
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

async function createRelationshipsFromProperties(session) {
  const stats = {
    sport: 0,
    country: 0,
    league: 0,
    federation: 0,
    total: 0
  };
  
  try {
    // Create sport-based relationships
    console.log('  🔗 Creating sport relationships...');
    const sportResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.sport IS NOT NULL 
        AND e2.name = e1.sport 
        AND e2:Sport
      MERGE (e1)-[:PLAYS_IN]->(e2)
      RETURN count(*) as count
    `);
    stats.sport = sportResult.records[0].get('count').toNumber();
    
    // Create country-based relationships
    console.log('  🌍 Creating country relationships...');
    const countryResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.country IS NOT NULL 
        AND e2.name = e1.country 
        AND e2:Country
      MERGE (e1)-[:LOCATED_IN]->(e2)
      RETURN count(*) as count
    `);
    stats.country = countryResult.records[0].get('count').toNumber();
    
    // Create league-team relationships
    console.log('  ⚽ Creating league-team relationships...');
    const leagueResult = await session.run(`
      MATCH (club:Entity {type: 'Club'}), (league:Entity {type: 'League'})
      WHERE club.name CONTAINS league.name 
         OR club.league = league.name
         OR club.division = league.name
      MERGE (club)-[:MEMBER_OF]->(league)
      RETURN count(*) as count
    `);
    stats.league = leagueResult.records[0].get('count').toNumber();
    
    // Create federation relationships
    console.log('  🏢 Creating federation relationships...');
    const federationResult = await session.run(`
      MATCH (entity:Entity), (federation:Entity {type: 'Federation'})
      WHERE (entity.sport IS NOT NULL AND federation.sport IS NOT NULL AND entity.sport = federation.sport)
         OR (entity.country IS NOT NULL AND federation.name CONTAINS entity.country)
      MERGE (entity)-[:AFFILIATED_WITH]->(federation)
      RETURN count(*) as count
    `);
    stats.federation = federationResult.records[0].get('count').toNumber();
    
    stats.total = stats.sport + stats.country + stats.league + stats.federation;
    console.log(`✅ Created ${stats.total} relationships total (Sport: ${stats.sport}, Country: ${stats.country}, League: ${stats.league}, Federation: ${stats.federation})`);
    
  } catch (error) {
    console.error('❌ Error creating relationships:', error);
  }
  
  return stats;
}

// Run the migration
if (require.main === module) {
  migrateAllEntities()
    .then((result) => {
      console.log('\n🎉 Complete migration finished successfully!');
      console.log('Final stats:', JSON.stringify(result.stats, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Complete migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAllEntities };