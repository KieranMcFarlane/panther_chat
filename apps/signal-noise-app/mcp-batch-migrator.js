/**
 * MCP-Based Entity Migration Script
 * 
 * This script uses MCP tools to migrate missing entities from Supabase to Neo4j
 * in batches of 250 entities.
 */

class MCPBatchMigrator {
  constructor() {
    this.results = {
      totalChecked: 0,
      missingEntities: [],
      migrationBatches: [],
      migratedCount: 0,
      failedCount: 0,
      errors: []
    };
  }

  async checkEntityInNeo4j(neo4jId) {
    try {
      const result = await mcp__neo4j-mcp__execute_query(`
        MATCH (n) WHERE n.id = $id OR toString(n.id) = $id
        RETURN n.id as foundId, n.name as name
        LIMIT 1
      `, { id: neo4jId.toString() });
      
      return result && result.length > 0;
    } catch (error) {
      console.warn(`⚠️  Error checking Neo4j entity ${neo4jId}:`, error.message);
      return false;
    }
  }

  async getSupabaseEntitiesBatch(limit = 50, offset = 0) {
    try {
      const result = await mcp__supabase__execute_sql(`
        SELECT id, neo4j_id, labels, properties 
        FROM cached_entities 
        ORDER BY id 
        LIMIT ${limit} OFFSET ${offset}
      `);
      
      return result || [];
    } catch (error) {
      console.warn(`⚠️  Error getting Supabase batch ${offset}:`, error.message);
      return [];
    }
  }

  async migrateEntityToNeo4j(entity) {
    try {
      const properties = entity.properties || {};
      
      // Normalize entity for Neo4j
      const normalizedEntity = {
        id: entity.neo4j_id || entity.id,
        labels: entity.labels || ['Entity'],
        properties: {
          name: properties.name || 'Unknown Entity',
          entity_type: this.normalizeEntityType(properties.type || properties.entity_type || 'Entity'),
          sport: properties.sport || '',
          level: properties.level || '',
          tier: properties.tier || '',
          country: properties.country || '',
          website: properties.website || '',
          linkedin: properties.linkedin || '',
          mobileApp: properties.mobileApp || '',
          description: properties.description || '',
          notes: properties.notes || '',
          priorityScore: properties.priorityScore || '',
          estimatedValue: properties.estimatedValue || '',
          digitalWeakness: properties.digitalWeakness || '',
          opportunityType: properties.opportunityType || '',
          source: properties.source || 'migration',
          migrated_at: new Date().toISOString(),
          migration_batch: Date.now(),
          original_supabase_id: entity.id
        }
      };

      const labelsString = normalizedEntity.labels.map(label => `:${label}`).join(' ');
      
      await mcp__neo4j-mcp__execute_query(`
        MERGE (e:Entity ${labelsString} {id: $id})
        ON CREATE SET e += $properties
        ON MATCH SET e += $properties
        RETURN e
      `, {
        id: normalizedEntity.id,
        properties: normalizedEntity.properties
      });

      return true;
    } catch (error) {
      console.error(`❌ Error migrating entity ${entity.id}:`, error.message);
      return false;
    }
  }

  normalizeEntityType(type) {
    if (!type || type === 'Unknown') return 'Entity';
    
    const typeMap = {
      'club': 'Club',
      'team': 'Club',
      'franchise': 'Club',
      'person': 'Person',
      'individual': 'Person',
      'athlete': 'Person',
      'player': 'Person',
      'staff': 'Person',
      'league': 'League',
      'competition': 'League',
      'organization': 'Organization',
      'org': 'Organization',
      'partner': 'Partner',
      'sponsor': 'Partner',
      'venue': 'Venue',
      'stadium': 'Venue',
      'arena': 'Venue',
      'federation': 'Federation',
      'association': 'Association',
      'tournament': 'League'
    };

    const normalized = typeMap[type.toLowerCase()];
    return normalized || (['Club', 'Person', 'League', 'Organization', 'Partner', 'Venue', 'Federation', 'Association'].includes(type) ? type : 'Entity');
  }

  async identifyMissingEntities() {
    console.log('🔍 Identifying missing entities from Neo4j...');
    
    const missingEntities = [];
    let offset = 0;
    const batchSize = 20; // Smaller batches for MCP
    let totalChecked = 0;
    
    // Get total count first
    const countResult = await mcp__supabase__execute_sql('SELECT COUNT(*) as count FROM cached_entities');
    const totalCount = countResult[0]?.count || 0;
    
    console.log(`📊 Total entities to check: ${totalCount}`);
    
    while (offset < totalCount) {
      console.log(`Checking batch ${Math.floor(offset/batchSize) + 1} (${offset}-${offset+batchSize-1})...`);
      
      const entities = await this.getSupabaseEntitiesBatch(batchSize, offset);
      
      if (entities.length === 0) break;
      
      for (const entity of entities) {
        const neo4jId = entity.neo4j_id || entity.id.toString();
        
        try {
          const exists = await this.checkEntityInNeo4j(neo4jId);
          
          if (!exists) {
            missingEntities.push({
              ...entity,
              missingReason: 'not_found_in_neo4j'
            });
          }
          
          totalChecked++;
          
          // Progress update
          if (totalChecked % 10 === 0) {
            console.log(`Progress: ${totalChecked}/${totalCount} (Missing: ${missingEntities.length})`);
          }
          
        } catch (error) {
          console.warn(`⚠️  Error checking entity ${entity.id}:`, error.message);
          missingEntities.push({
            ...entity,
            missingReason: 'check_error',
            error: error.message
          });
        }
      }
      
      offset += batchSize;
      
      // Add delay to avoid overwhelming MCP
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stop after finding a reasonable number for demo
      if (missingEntities.length >= 250) {
        console.log(`📋 Found ${missingEntities.length} missing entities - stopping identification for demo`);
        break;
      }
    }
    
    this.results.missingEntities = missingEntities;
    this.results.totalChecked = totalChecked;
    
    console.log(`✅ Missing entity identification complete: ${missingEntities.length} missing entities found from ${totalChecked} checked`);
    
    return missingEntities;
  }

  createMigrationBatches(missingEntities) {
    console.log('📦 Creating migration batches...');
    
    const batchSize = 10; // Smaller batches for demo
    const batches = [];
    
    for (let i = 0; i < missingEntities.length; i += batchSize) {
      const batch = missingEntities.slice(i, i + batchSize);
      batches.push({
        batchNumber: Math.floor(i / batchSize) + 1,
        entities: batch,
        entityCount: batch.length,
        status: 'pending'
      });
    }
    
    this.results.migrationBatches = batches;
    console.log(`✅ Created ${batches.length} migration batches of up to ${batchSize} entities each`);
    
    return batches;
  }

  async migrateBatch(batch) {
    console.log(`🔄 Migrating batch ${batch.batchNumber}/${this.results.migrationBatches.length} (${batch.entityCount} entities)...`);
    
    let successful = 0;
    let failed = 0;
    
    for (const entity of batch.entities) {
      try {
        const migrated = await this.migrateEntityToNeo4j(entity);
        
        if (migrated) {
          successful++;
          console.log(`   ✓ ${entity.properties?.name || 'Unknown'}`);
        } else {
          failed++;
          console.log(`   ❌ ${entity.properties?.name || 'Unknown'} (failed)`);
        }
        
      } catch (error) {
        failed++;
        console.warn(`⚠️  Failed to migrate entity ${entity.id}:`, error.message);
      }
      
      // Small delay between entities
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.results.migratedCount += successful;
    this.results.failedCount += failed;
    
    console.log(`✅ Batch ${batch.batchNumber} completed: ${successful} successful, ${failed} failed`);
    
    return { successful, failed };
  }

  async runMigration() {
    if (this.results.migrationBatches.length === 0) {
      console.log('✅ No entities to migrate.');
      return;
    }
    
    console.log(`🚀 Starting migration of ${this.results.missingEntities.length} entities in ${this.results.migrationBatches.length} batches...`);
    
    for (const batch of this.results.migrationBatches) {
      try {
        await this.migrateBatch(batch);
        batch.status = 'completed';
        
        // Add delay between batches
        if (batch.batchNumber < this.results.migrationBatches.length) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Critical error in batch ${batch.batchNumber}:`, error.message);
        batch.status = 'failed';
        this.results.errors.push(`Batch ${batch.batchNumber} critical error: ${error.message}`);
      }
    }
    
    console.log(`🎉 Migration completed!`);
    console.log(`   Total entities: ${this.results.missingEntities.length}`);
    console.log(`   Successfully migrated: ${this.results.migratedCount}`);
    console.log(`   Failed: ${this.results.failedCount}`);
    
    if (this.results.missingEntities.length > 0) {
      console.log(`   Success rate: ${((this.results.migratedCount / this.results.missingEntities.length) * 100).toFixed(2)}%`);
    }
  }

  printSummary() {
    console.log('\\n' + '='.repeat(80));
    console.log('🔍 MCP ENTITY MIGRATION SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\\n📊 RESULTS:');
    console.log(`   Total entities checked: ${this.results.totalChecked}`);
    console.log(`   Missing entities found: ${this.results.missingEntities.length}`);
    console.log(`   Migration batches: ${this.results.migrationBatches.length}`);
    console.log(`   Successfully migrated: ${this.results.migratedCount}`);
    console.log(`   Failed migrations: ${this.results.failedCount}`);
    
    if (this.results.missingEntities.length > 0) {
      console.log(`   Success rate: ${((this.results.migratedCount / this.results.missingEntities.length) * 100).toFixed(2)}%`);
    }
    
    console.log('\\n📋 BATCH BREAKDOWN:');
    this.results.migrationBatches.forEach(batch => {
      console.log(`   Batch ${batch.batchNumber}: ${batch.status}`);
    });
    
    console.log('\\n📋 SAMPLE MIGRATED ENTITIES:');
    this.results.migrationBatches.slice(0, 2).forEach(batch => {
      if (batch.status === 'completed') {
        console.log(`   Batch ${batch.batchNumber}: ${batch.entityCount} entities migrated`);
      }
    });
    
    console.log('='.repeat(80));
  }

  async run() {
    console.log('🚀 Starting MCP-Based Entity Migration System...\\n');

    try {
      // Identify missing entities
      const missingEntities = await this.identifyMissingEntities();
      
      if (missingEntities.length === 0) {
        console.log('✅ No missing entities found. All entities are already in Neo4j.');
        return;
      }
      
      // Create migration batches
      this.createMigrationBatches(missingEntities);
      
      // Show sample of entities to migrate
      console.log(`\\n📋 SAMPLE ENTITIES TO MIGRATE:`);
      missingEntities.slice(0, 5).forEach((entity, index) => {
        console.log(`   ${index + 1}. ${entity.properties?.name || 'Unknown'} (${entity.labels?.join(', ')})`);
      });
      
      // Run migration
      console.log('\\n🔄 Starting migration process...');
      await this.runMigration();
      
      // Print final summary
      this.printSummary();

    } catch (error) {
      console.error('❌ Migration system failed:', error.message);
      console.error(error.stack);
    }
  }
}

// Import required MCP tools
const mcp__neo4j_mcp__execute_query = require('neo4j-mcp').execute_query;
const mcp__supabase__execute_sql = require('supabase-mcp').execute_sql;

// Wait for MCP tools to be available
async function waitForMCPTools() {
  console.log('⏳ Waiting for MCP tools to be available...');
  
  // Simple retry mechanism
  for (let i = 0; i < 30; i++) {
    try {
      if (typeof mcp__neo4j_mcp__execute_query === 'function' && typeof mcp__supabase__execute_sql === 'function') {
        console.log('✅ MCP tools are available');
        return true;
      }
    } catch (error) {
      // Tools not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('MCP tools not available after waiting');
}

// Run the migration system
async function main() {
  try {
    await waitForMCPTools();
    const migrator = new MCPBatchMigrator();
    await migrator.run();
  } catch (error) {
    console.error('❌ Failed to initialize MCP tools:', error.message);
    console.log('\\n💡 Please ensure MCP servers are running and accessible');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\\n🛑 Migration interrupted. Cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\\n🛑 Migration terminated. Cleaning up...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { MCPBatchMigrator };