import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🚀 Starting Sample Neo4j Migration');
  
  try {
    const { clearDatabase = true } = await request.json();
    
    // Import Neo4j driver
    const neo4j = require('neo4j-driver');
    
    // Neo4j configuration
    const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
    const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
    const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
    
    // Initialize Neo4j connection
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
      
      // Clear existing entities if requested
      if (clearDatabase && currentCount > 0) {
        console.log('🗑️ Clearing existing entities...');
        await session.run('MATCH (n) DETACH DELETE n');
        console.log('✅ Cleared existing entities');
      }
      
      // Setup constraints and indexes
      console.log('🔧 Setting up constraints and indexes...');
      await setupConstraintsAndIndexes(session);
      
      // Sample entities based on the structure we saw from MCP queries
      const sampleEntities = [
        {
          neo4j_id: '197',
          labels: ['Entity', 'Club'],
          properties: {
            name: '1. FC Köln',
            type: 'Club',
            sport: 'Football',
            country: 'Germany'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/1-fc-koln-badge.png'
        },
        {
          neo4j_id: '191',
          labels: ['Entity', 'Club'],
          properties: {
            name: '1. FC Nürnberg',
            type: 'Club',
            sport: 'Football',
            country: 'Germany'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/1-fc-nurnberg-badge.png'
        },
        {
          neo4j_id: '450',
          labels: ['Entity', 'League'],
          properties: {
            name: '2. Bundesliga',
            type: 'League',
            sport: 'Football',
            country: 'Germany'
          }
        },
        {
          neo4j_id: 'premier-league',
          labels: ['Entity', 'League'],
          properties: {
            name: 'Premier League',
            type: 'League',
            sport: 'Football',
            country: 'England'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/premier-league-badge.png'
        },
        {
          neo4j_id: 'manchester-united',
          labels: ['Entity', 'Club'],
          properties: {
            name: 'Manchester United FC',
            type: 'Club',
            sport: 'Football',
            country: 'England'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/manchester-united-badge.png'
        },
        {
          neo4j_id: 'chelsea',
          labels: ['Entity', 'Club'],
          properties: {
            name: 'Chelsea FC',
            type: 'Club',
            sport: 'Football',
            country: 'England'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/chelsea-badge.png'
        },
        {
          neo4j_id: 'liverpool',
          labels: ['Entity', 'Club'],
          properties: {
            name: 'Liverpool FC',
            type: 'Club',
            sport: 'Football',
            country: 'England'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/liverpool-badge.png'
        },
        {
          neo4j_id: 'arsenal',
          labels: ['Entity', 'Club'],
          properties: {
            name: 'Arsenal FC',
            type: 'Club',
            sport: 'Football',
            country: 'England'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/arsenal-badge.png'
        },
        {
          neo4j_id: 'bayern-munich',
          labels: ['Entity', 'Club'],
          properties: {
            name: 'FC Bayern Munich',
            type: 'Club',
            sport: 'Football',
            country: 'Germany'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/bayern-munich-badge.png'
        },
        {
          neo4j_id: 'real-madrid',
          labels: ['Entity', 'Club'],
          properties: {
            name: 'Real Madrid CF',
            type: 'Club',
            sport: 'Football',
            country: 'Spain'
          },
          badge_s3_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/real-madrid-badge.png'
        }
      ];
      
      console.log(`📝 Creating ${sampleEntities.length} sample entities...`);
      let createdCount = 0;
      let errors = [];
      
      // Process entities in transaction
      const tx = session.beginTransaction();
      try {
        for (const entity of sampleEntities) {
          try {
            await createEntityInNeo4j(tx, entity);
            createdCount++;
            console.log(`✅ Created entity: ${entity.properties.name}`);
          } catch (entityError) {
            const errorMsg = `Failed to create entity ${entity.neo4j_id}: ${entityError.message}`;
            errors.push(errorMsg);
            console.warn(`⚠️ ${errorMsg}`);
          }
        }
        
        await tx.commit();
        console.log(`✅ Successfully created ${createdCount} entities`);
        
      } catch (txError) {
        console.error(`❌ Transaction failed:`, txError);
        await tx.rollback();
        errors.push(`Transaction failed: ${txError.message}`);
      }
      
      // Create relationships
      console.log('🔗 Creating relationships between entities...');
      const relationshipStats = await createRelationships(session);
      
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
        LIMIT 10
      `);
      
      const createdSampleEntities = sampleResult.records.map(record => ({
        name: record.get('name'),
        type: record.get('type'),
        sport: record.get('sport')
      }));
      
      await session.close();
      await driver.close();
      
      console.log('\n🎉 Sample Migration Complete!');
      console.log(`📊 Final entity count: ${finalCount}`);
      console.log(`🔗 Final relationship count: ${relationshipCount}`);
      console.log(`✅ Successfully created ${createdCount} sample entities`);
      
      return NextResponse.json({
        success: true,
        stats: {
          totalEntities: sampleEntities.length,
          processedEntities: sampleEntities.length,
          createdEntities: createdCount,
          finalEntityCount: finalCount,
          relationshipCount: relationshipCount,
          relationshipStats: relationshipStats,
          errors: errors,
          sampleEntities: createdSampleEntities,
          note: 'This is a sample migration with representative data. The full migration requires Supabase database credentials.'
        }
      });
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      await session.close();
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Failed to complete migration:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

async function setupConstraintsAndIndexes(session) {
  const constraints = [
    'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT country_id_unique IF NOT EXISTS FOR (c:Country) REQUIRE c.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT sport_id_unique IF NOT EXISTS FOR (s:Sport) REQUIRE s.neo4j_id IS UNIQUE'
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
    'CREATE INDEX entity_country_index IF NOT EXISTS FOR (e:Entity) ON (e.country)'
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

async function createRelationships(session) {
  const stats = {
    sport: 0,
    country: 0,
    league: 0,
    federation: 0,
    total: 0
  };
  
  try {
    // Create league-team relationships
    console.log('  ⚽ Creating league-team relationships...');
    const leagueResult = await session.run(`
      MATCH (club:Entity {type: 'Club'}), (league:Entity {type: 'League'})
      WHERE (club.name CONTAINS league.name 
         OR club.name = 'Manchester United FC' AND league.name = 'Premier League'
         OR club.name = 'Chelsea FC' AND league.name = 'Premier League'
         OR club.name = 'Liverpool FC' AND league.name = 'Premier League'
         OR club.name = 'Arsenal FC' AND league.name = 'Premier League'
         OR club.name = '1. FC Köln' AND league.name = '2. Bundesliga'
         OR club.name = '1. FC Nürnberg' AND league.name = '2. Bundesliga'
         OR club.name CONTAINS 'Bundesliga')
      MERGE (club)-[:MEMBER_OF]->(league)
      RETURN count(*) as count
    `);
    stats.league = leagueResult.records[0].get('count').toNumber();
    
    stats.total = stats.league;
    console.log(`✅ Created ${stats.total} relationships total (League: ${stats.league})`);
    
  } catch (error) {
    console.error('❌ Error creating relationships:', error);
  }
  
  return stats;
}