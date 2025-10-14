import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🚀 Starting Neo4j migration from Supabase cached_entities');
  
  try {
    const { clearDatabase = true } = await request.json();
    
    // Import Neo4j driver and PostgreSQL client
    const neo4j = require('neo4j-driver');
    const { Client } = require('pg');
    
    // Neo4j configuration
    const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
    const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
    const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
    
    // Supabase PostgreSQL configuration
    const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || 'postgresql://signal-noise-app.iowgwvavmoxo.us-east-1.aws.neon.tech:5432/signal-noise-app?sslmode=require';
    
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
      
      // Get total count from Supabase using MCP
      console.log('📊 Getting total entity count from Supabase...');
      const countResult = await mcp__supabase__execute_sql({
        query: 'SELECT COUNT(*) as count FROM cached_entities'
      });
      
      if (!countResult || countResult.length === 0) {
        throw new Error('Failed to get entity count from Supabase');
      }
      
      const totalEntities = countResult[0].count;
      console.log(`📊 Total entities to process: ${totalEntities}`);
      
      // Process entities in batches
      const BATCH_SIZE = 100;
      let totalProcessed = 0;
      let createdCount = 0;
      let errors = [];
      
      for (let offset = 0; offset < totalEntities; offset += BATCH_SIZE) {
        console.log(`📦 Processing batch ${Math.floor(offset/BATCH_SIZE) + 1}: entities ${offset} to ${Math.min(offset + BATCH_SIZE - 1, totalEntities - 1)}`);
        
        // Fetch batch from Supabase
        const batchQuery = `
          SELECT neo4j_id, labels, properties, badge_s3_url 
          FROM cached_entities 
          ORDER BY id 
          LIMIT ${BATCH_SIZE} OFFSET ${offset}
        `;
        
        const entities = await mcp__supabase__execute_sql({ query: batchQuery });
        
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
          
          const progress = Math.round((totalProcessed/totalEntities)*100);
          console.log(`✅ Batch completed: ${batchCreated}/${entities.length} entities created. Progress: ${totalProcessed}/${totalEntities} (${progress}%)`);
          
        } catch (txError) {
          console.error(`❌ Transaction failed for batch starting at offset ${offset}:`, txError);
          await tx.rollback();
          errors.push(`Transaction failed: ${txError.message}`);
        }
      }
      
      // Create relationships
      console.log('🔗 Creating relationships between entities...');
      const relationshipStats = await createRelationships(session);
      
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
      
      const sampleEntities = sampleResult.records.map(record => ({
        name: record.get('name'),
        type: record.get('type'),
        sport: record.get('sport')
      }));
      
      await session.close();
      await driver.close();
      
      console.log('\n🎉 Migration Complete!');
      console.log(`📊 Final entity count: ${finalCount}`);
      console.log(`🔗 Final relationship count: ${relationshipCount}`);
      console.log(`✅ Successfully created ${createdCount} entities`);
      
      return NextResponse.json({
        success: true,
        stats: {
          totalEntities: totalEntities,
          processedEntities: totalProcessed,
          createdEntities: createdCount,
          finalEntityCount: finalCount,
          relationshipCount: relationshipCount,
          relationshipStats: relationshipStats,
          errors: errors,
          sampleEntities: sampleEntities
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
    
    // Create federation relationships based on sport
    console.log('  🏢 Creating federation relationships...');
    const federationResult = await session.run(`
      MATCH (entity:Entity), (federation:Entity {type: 'Federation'})
      WHERE entity.sport IS NOT NULL 
        AND federation.sport IS NOT NULL 
        AND entity.sport = federation.sport
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