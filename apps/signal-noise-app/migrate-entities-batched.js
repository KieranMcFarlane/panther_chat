const neo4j = require('neo4j-driver');

// Configuration
const BATCH_SIZE = 250;
const DRIVER_CONCURRENCY = 4; // Max parallel processing

// Neo4j connection
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';

// Problematic patterns to exclude
const PROBLEMATIC_PATTERNS = [
  /\(json_seed\)$/,
  /\(csv_seed\)$/,
  /\(json_seed_\d+\)$/,
  /^(Academy Director|Commercial Director|Technical Director|Head Coach|General Manager|Chief Executive|Marketing Director|Operations Director|Finance Director|Stadium Manager|Equipment Manager|Team Doctor|Physiotherapist|Scout|Analyst)$/,
  /^(Test Person|Test.*|Placeholder.*|Sample.*)$/i,
  /^[A-Z][a-z]+ [0-9]{3,4}$/,
  /[Tt]eam [0-9]+/,
  /[Cc]lub [0-9]+/,
  /[Gg]olf Club [0-9]+/
];

function isProblematicEntity(name) {
  return PROBLEMATIC_PATTERNS.some(pattern => pattern.test(name));
}

function cleanEntityData(rawEntity) {
  // Remove suffixes and clean up name
  let cleanName = rawEntity.name || rawEntity.properties?.name || '';
  
  // Remove json_seed/csv_seed suffixes
  cleanName = cleanName.replace(/\s*\([^)]*seed[^)]*\)$/g, '');
  
  // Extract properties
  const properties = rawEntity.properties || {};
  
  return {
    name: cleanName.trim(),
    type: properties.type || rawEntity.type || 'Club',
    sport: properties.sport || rawEntity.sport || '',
    country: properties.country || rawEntity.country || '',
    division: properties.division || properties.level || '',
    website: properties.website || '',
    linkedin: properties.linkedin || properties.linkedin_company_url || '',
    source: properties.source || 'supabase_cached',
    digitalPresence: properties.digitalPresence || null,
    enrichedAt: properties.enrichedAt || null,
    metadata: {
      neo4j_id: rawEntity.neo4j_id,
      labels: rawEntity.labels || ['Entity'],
      cache_version: properties.cache_version || 1,
      migrated_at: new Date().toISOString()
    }
  };
}

async function checkIfEntityExists(session, name) {
  const result = await session.run(
    'MATCH (e:Entity) WHERE e.name = $name RETURN count(e) as count',
    { name: name.trim() }
  );
  return result.records[0].get('count').toNumber() > 0;
}

async function createEntity(session, entityData) {
  const cypher = `
    MERGE (e:Entity {name: $name})
    ON CREATE SET 
      e.type = $type,
      e.sport = $sport,
      e.country = $country,
      e.division = $division,
      e.website = $website,
      e.linkedin = $linkedin,
      e.source = $source,
      e.digitalPresence = $digitalPresence,
      e.enrichedAt = $enrichedAt,
      e.createdAt = timestamp(),
      e.updatedAt = timestamp(),
      e.migratedFromSupabase = true,
      e.supabaseNeo4jId = $neo4jId
    ON MATCH SET
      e.updatedAt = timestamp(),
      e.migratedFromSupabase = true,
      e.supabaseNeo4jId = $neo4jId
    RETURN e
  `;
  
  const params = {
    name: entityData.name,
    type: entityData.type,
    sport: entityData.sport,
    country: entityData.country,
    division: entityData.division,
    website: entityData.website,
    linkedin: entityData.linkedin,
    source: entityData.source,
    digitalPresence: entityData.digitalPresence,
    enrichedAt: entityData.enrichedAt,
    neo4jId: entityData.metadata.neo4j_id
  };
  
  return await session.run(cypher, params);
}

async function migrateBatch(session, batch, batchNumber) {
  console.log(`\n🔄 Processing Batch ${batchNumber} (${batch.length} entities)`);
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  const results = [];
  
  for (let i = 0; i < batch.length; i++) {
    const rawEntity = batch[i];
    
    try {
      // Check if problematic
      if (isProblematicEntity(rawEntity.name || rawEntity.properties?.name)) {
        console.log(`  ⚠️  Skipping problematic entity: ${rawEntity.name}`);
        skipped++;
        continue;
      }
      
      // Clean entity data
      const entityData = cleanEntityData(rawEntity);
      
      // Skip if no name
      if (!entityData.name || entityData.name.trim() === '') {
        console.log(`  ⚠️  Skipping entity with no name`);
        skipped++;
        continue;
      }
      
      // Check if already exists
      const exists = await checkIfEntityExists(session, entityData.name);
      
      if (exists) {
        console.log(`  ✓ Entity already exists: ${entityData.name}`);
        updated++;
        // Still update with latest data
        await createEntity(session, entityData);
      } else {
        console.log(`  ➕ Creating new entity: ${entityData.name}`);
        await createEntity(session, entityData);
        created++;
      }
      
      results.push({
        neo4j_id: rawEntity.neo4j_id,
        name: entityData.name,
        status: exists ? 'updated' : 'created'
      });
      
    } catch (error) {
      console.error(`  ❌ Error processing entity ${rawEntity.name || 'unknown'}:`, error.message);
      errors++;
    }
    
    // Add delay to avoid overwhelming the database
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return {
    batchNumber,
    totalProcessed: batch.length,
    created,
    updated,
    skipped,
    errors,
    results
  };
}

async function getEntitiesFromSupabase(offset, limit) {
  // This would normally use mcp__supabase__execute_sql
  // For now, simulate with sample data
  
  const sampleEntities = [
    {
      neo4j_id: "sample_1",
      name: "Sevilla FC",
      properties: {
        type: "Club",
        sport: "Football",
        country: "Spain",
        division: "La Liga",
        website: "https://www.sevillafc.es/",
        linkedin: "https://www.linkedin.com/company/sevilla-fc"
      }
    },
    {
      neo4j_id: "sample_2", 
      name: "FC Porto",
      properties: {
        type: "Club",
        sport: "Football", 
        country: "Portugal",
        division: "Primeira Liga",
        website: "https://www.fcporto.pt/",
        linkedin: "https://www.linkedin.com/company/fcporto"
      }
    },
    {
      neo4j_id: "sample_3",
      name: "AS Roma",
      properties: {
        type: "Club",
        sport: "Football",
        country: "Italy", 
        division: "Serie A",
        website: "https://www.asroma.com/",
        linkedin: "https://www.linkedin.com/company/asroma"
      }
    },
    {
      neo4j_id: "sample_4",
      name: "AFC (json_seed)",
      properties: {
        type: "Organization",
        sport: "",
        country: ""
      }
    },
    {
      neo4j_id: "sample_5",
      name: "Academy Director",
      properties: {
        type: null,
        sport: null,
        country: null
      }
    }
  ];
  
  return sampleEntities;
}

async function runMigration() {
  console.log('🚀 Starting Entity Migration from Supabase to Neo4j');
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`🔧 Max concurrency: ${DRIVER_CONCURRENCY}`);
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD),
    { 
      maxConnectionPoolSize: DRIVER_CONCURRENCY,
      connectionTimeout: 30000,
      maxTransactionRetryTime: 30000
    }
  );
  
  const session = driver.session();
  
  try {
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    let batchNumber = 1;
    let offset = 0;
    let hasMoreData = true;
    
    while (hasMoreData) {
      console.log(`\n📥 Fetching batch ${batchNumber} (offset: ${offset}, limit: ${BATCH_SIZE})`);
      
      // Get batch from Supabase
      const entities = await getEntitiesFromSupabase(offset, BATCH_SIZE);
      
      if (entities.length === 0) {
        hasMoreData = false;
        break;
      }
      
      // Process batch
      const batchResult = await migrateBatch(session, entities, batchNumber);
      
      totalProcessed += batchResult.totalProcessed;
      totalCreated += batchResult.created;
      totalUpdated += batchResult.updated;
      totalSkipped += batchResult.skipped;
      totalErrors += batchResult.errors;
      
      console.log(`\n📊 Batch ${batchNumber} Results:`);
      console.log(`  Total processed: ${batchResult.totalProcessed}`);
      console.log(`  Created: ${batchResult.created}`);
      console.log(`  Updated: ${batchResult.updated}`);
      console.log(`  Skipped: ${batchResult.skipped}`);
      console.log(`  Errors: ${batchResult.errors}`);
      
      // Prepare for next batch
      offset += BATCH_SIZE;
      batchNumber++;
      
      // Safety check - don't run forever
      if (batchNumber > 20) {
        console.log('⚠️  Safety limit reached, stopping migration');
        break;
      }
    }
    
    console.log('\n🎉 MIGRATION COMPLETE');
    console.log('='.repeat(50));
    console.log(`📊 Total processed: ${totalProcessed}`);
    console.log(`✅ Total created: ${totalCreated}`);
    console.log(`🔄 Total updated: ${totalUpdated}`);
    console.log(`⚠️  Total skipped: ${totalSkipped}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    console.log(`📈 Success rate: ${((totalCreated + totalUpdated) / totalProcessed * 100).toFixed(1)}%`);
    
    return {
      totalProcessed,
      totalCreated,
      totalUpdated,
      totalSkipped,
      totalErrors,
      successRate: (totalCreated + totalUpdated) / totalProcessed
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(results => {
      console.log('\n✅ Entity migration completed successfully!');
      
      // Save results
      const fs = require('fs');
      const reportPath = './migration-results.json';
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      console.log(`📄 Migration report saved to: ${reportPath}`);
      
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  runMigration, 
  migrateBatch, 
  cleanEntityData, 
  isProblematicEntity 
};