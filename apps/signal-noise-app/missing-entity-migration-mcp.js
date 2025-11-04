/**
 * MCP-Based Missing Entity Migration System
 * 
 * This script uses MCP tools to identify and migrate missing entities
 * from Supabase cached_entities to Neo4j in batches of 250.
 */

class MissingEntityMigrationMCP {
  constructor() {
    this.results = {
      totalSupabase: 0,
      totalNeo4j: 0,
      missingEntities: [],
      migrationBatches: [],
      migrationResults: {
        totalBatches: 0,
        completedBatches: 0,
        migratedEntities: 0,
        failedEntities: 0,
        errors: []
      }
    };
  }

  async getSupabaseEntityCount() {
    console.log('📊 Getting Supabase entity count...');
    
    try {
      const response = await fetch('http://localhost:3000/api/supabase-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'SELECT COUNT(*) as count FROM cached_entities'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      this.results.totalSupabase = result.data[0]?.count || 0;
      console.log(`✅ Found ${this.results.totalSupabase} entities in Supabase`);
      
      return this.results.totalSupabase;
    } catch (error) {
      console.error('❌ Error getting Supabase count:', error.message);
      // Use known count from previous analysis
      this.results.totalSupabase = 4422;
      console.log(`📄 Using known count: ${this.results.totalSupabase}`);
      return this.results.totalSupabase;
    }
  }

  async getNeo4jEntityCount() {
    console.log('📊 Getting Neo4j entity count...');
    
    try {
      const response = await fetch('http://localhost:3000/api/neo4j-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'MATCH (n) RETURN count(n) as totalNodes'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      this.results.totalNeo4j = result.data[0]?.totalNodes || 0;
      console.log(`✅ Found ${this.results.totalNeo4j} nodes in Neo4j`);
      
      return this.results.totalNeo4j;
    } catch (error) {
      console.error('❌ Error getting Neo4j count:', error.message);
      // Use known count from previous analysis
      this.results.totalNeo4j = 2418;
      console.log(`📄 Using known count: ${this.results.totalNeo4j}`);
      return this.results.totalNeo4j;
    }
  }

  async getSupabaseEntitiesBatch(offset, limit = 100) {
    console.log(`📥 Getting Supabase entities ${offset}-${offset + limit - 1}...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/supabase-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `SELECT id, neo4j_id, labels, properties FROM cached_entities ORDER BY id LIMIT ${limit} OFFSET ${offset}`
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.warn(`⚠️  Error getting Supabase batch ${offset}:`, error.message);
      return [];
    }
  }

  async checkEntityInNeo4j(neo4jId) {
    try {
      const response = await fetch('http://localhost:3000/api/neo4j-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            MATCH (n) WHERE n.id = $id OR toString(n.id) = $id
            RETURN n.id as foundId, n.name as name
            LIMIT 1
          `,
          params: { id: neo4jId.toString() }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data && result.data.length > 0;
    } catch (error) {
      console.warn(`⚠️  Error checking Neo4j entity ${neo4jId}:`, error.message);
      return false;
    }
  }

  async identifyMissingEntities() {
    console.log('🔍 Identifying missing entities from Neo4j...');
    
    const missingEntities = [];
    const foundEntities = [];
    const batchSize = 50;
    
    for (let offset = 0; offset < this.results.totalSupabase; offset += batchSize) {
      const entities = await this.getSupabaseEntitiesBatch(offset, batchSize);
      
      if (entities.length === 0) break;
      
      console.log(`Checking batch ${Math.floor(offset/batchSize) + 1} (${entities.length} entities)...`);
      
      for (const entity of entities) {
        const neo4jId = entity.neo4j_id || entity.id.toString();
        
        try {
          const exists = await this.checkEntityInNeo4j(neo4jId);
          
          if (exists) {
            foundEntities.push(entity);
          } else {
            missingEntities.push({
              ...entity,
              missingReason: 'not_found_in_neo4j'
            });
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
      
      // Progress update
      const processed = Math.min(offset + batchSize, this.results.totalSupabase);
      console.log(`Progress: ${processed}/${this.results.totalSupabase} (Found: ${foundEntities.length}, Missing: ${missingEntities.length})`);
      
      // Add delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    this.results.missingEntities = missingEntities;
    console.log(`✅ Missing entity identification complete: ${missingEntities.length} missing, ${foundEntities.length} found`);
    
    return missingEntities;
  }

  createMigrationBatches(missingEntities) {
    console.log('📦 Creating migration batches...');
    
    const batchSize = 250;
    const batches = [];
    
    for (let i = 0; i < missingEntities.length; i += batchSize) {
      const batch = missingEntities.slice(i, i + batchSize);
      batches.push({
        batchNumber: Math.floor(i / batchSize) + 1,
        entities: batch,
        entityCount: batch.length,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
    
    this.results.migrationBatches = batches;
    this.results.migrationResults.totalBatches = batches.length;
    
    console.log(`✅ Created ${batches.length} migration batches of up to ${batchSize} entities each`);
    
    return batches;
  }

  normalizeEntityForNeo4j(entity) {
    // Extract properties safely
    const properties = entity.properties || {};
    
    return {
      id: entity.neo4j_id || entity.id,
      labels: entity.labels || ['Entity'],
      properties: {
        // Core properties
        name: properties.name || 'Unknown Entity',
        entity_type: this.normalizeEntityType(properties.type || properties.entity_type || 'Entity'),
        
        // Sports-specific properties
        sport: properties.sport || '',
        level: properties.level || '',
        tier: properties.tier || '',
        country: properties.country || '',
        
        // Contact information
        website: properties.website || '',
        linkedin: properties.linkedin || '',
        mobileApp: properties.mobileApp || '',
        
        // Business information
        description: properties.description || '',
        notes: properties.notes || '',
        
        // Classification
        priorityScore: properties.priorityScore || '',
        estimatedValue: properties.estimatedValue || '',
        digitalWeakness: properties.digitalWeakness || '',
        opportunityType: properties.opportunityType || '',
        
        // Data sources
        source: properties.source || 'migration',
        data_sources: properties.data_sources || '',
        company_info: properties.company_info || '',
        
        // Migration metadata
        migrated_at: new Date().toISOString(),
        migration_batch: Date.now(),
        original_supabase_id: entity.id
      }
    };
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

  async migrateEntityToNeo4j(entity) {
    const normalizedEntity = this.normalizeEntityForNeo4j(entity);
    const labelsString = normalizedEntity.labels.map(label => `:${label}`).join(' ');
    
    try {
      const response = await fetch('http://localhost:3000/api/neo4j-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            MERGE (e:Entity ${labelsString} {id: $id})
            ON CREATE SET e += $properties
            ON MATCH SET e += $properties
            RETURN e
          `,
          params: {
            id: normalizedEntity.id,
            properties: normalizedEntity.properties
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`❌ Error migrating entity ${entity.id}:`, error.message);
      throw error;
    }
  }

  async migrateBatch(batch) {
    console.log(`🔄 Migrating batch ${batch.batchNumber}/${this.results.migrationResults.totalBatches} (${batch.entityCount} entities)...`);
    
    const batchResult = {
      batchNumber: batch.batchNumber,
      startTime: new Date().toISOString(),
      successful: 0,
      failed: 0,
      errors: [],
      entities: []
    };
    
    for (const entity of batch.entities) {
      try {
        await this.migrateEntityToNeo4j(entity);
        
        batchResult.successful++;
        batchResult.entities.push({
          id: entity.id,
          name: entity.properties?.name || 'Unknown',
          status: 'success'
        });
        
      } catch (error) {
        batchResult.failed++;
        batchResult.errors.push({
          entityId: entity.id,
          entityName: entity.properties?.name || 'Unknown',
          error: error.message
        });
        
        batchResult.entities.push({
          id: entity.id,
          name: entity.properties?.name || 'Unknown',
          status: 'failed',
          error: error.message
        });
        
        console.warn(`⚠️  Failed to migrate entity ${entity.id}: ${error.message}`);
      }
      
      // Small delay between entities to avoid overwhelming Neo4j
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    batchResult.endTime = new Date().toISOString();
    batch.status = batchResult.failed === 0 ? 'completed' : 'completed_with_errors';
    
    console.log(`✅ Batch ${batch.batchNumber} completed: ${batchResult.successful} successful, ${batchResult.failed} failed`);
    
    return batchResult;
  }

  async runMigration() {
    if (this.results.migrationBatches.length === 0) {
      console.log('✅ No entities to migrate.');
      return;
    }
    
    console.log(`🚀 Starting migration of ${this.results.missingEntities.length} entities in ${this.results.migrationBatches.length} batches...`);
    
    for (const batch of this.results.migrationBatches) {
      try {
        const batchResult = await this.migrateBatch(batch);
        
        this.results.migrationResults.migratedEntities += batchResult.successful;
        this.results.migrationResults.failedEntities += batchResult.failed;
        this.results.migrationResults.completedBatches++;
        
        batch.result = batchResult;
        
        // Add delay between batches
        if (batch.batchNumber < this.results.migrationBatches.length) {
          console.log('⏳ Waiting 3 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`❌ Critical error in batch ${batch.batchNumber}:`, error.message);
        this.results.migrationResults.errors.push(`Batch ${batch.batchNumber} critical error: ${error.message}`);
        batch.status = 'failed';
      }
    }
    
    console.log(`🎉 Migration completed!`);
    console.log(`   Total entities: ${this.results.missingEntities.length}`);
    console.log(`   Successfully migrated: ${this.results.migrationResults.migratedEntities}`);
    console.log(`   Failed: ${this.results.migrationResults.failedEntities}`);
    
    if (this.results.missingEntities.length > 0) {
      console.log(`   Success rate: ${((this.results.migrationResults.migratedEntities / this.results.missingEntities.length) * 100).toFixed(2)}%`);
    }
  }

  printSummary() {
    console.log('\\n' + '='.repeat(80));
    console.log('🔍 MISSING ENTITY MIGRATION SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\\n📊 DATA COMPARISON:');
    console.log(`   Supabase cached_entities: ${this.results.totalSupabase}`);
    console.log(`   Neo4j nodes: ${this.results.totalNeo4j}`);
    console.log(`   Missing from Neo4j: ${this.results.missingEntities.length}`);
    console.log(`   Migration batches: ${this.results.migrationResults.totalBatches}`);
    
    console.log('\\n🚀 MIGRATION RESULTS:');
    console.log(`   Completed batches: ${this.results.migrationResults.completedBatches}/${this.results.migrationResults.totalBatches}`);
    console.log(`   Successfully migrated: ${this.results.migrationResults.migratedEntities}`);
    console.log(`   Failed migrations: ${this.results.migrationResults.failedEntities}`);
    
    if (this.results.missingEntities.length > 0) {
      console.log(`   Success rate: ${((this.results.migrationResults.migratedEntities / this.results.missingEntities.length) * 100).toFixed(2)}%`);
    }
    
    if (this.results.migrationResults.errors.length > 0) {
      console.log('\\n⚠️  ERRORS:');
      this.results.migrationResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\\n📋 BATCH BREAKDOWN:');
    this.results.migrationBatches.forEach(batch => {
      const result = batch.result || {};
      console.log(`   Batch ${batch.batchNumber}: ${batch.status} (${result.successful || 0} success, ${result.failed || 0} failed)`);
    });
    
    console.log('='.repeat(80));
  }

  async saveReport() {
    const filename = `missing-entity-migration-report-${Date.now()}.json`;
    
    try {
      require('fs').writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        results: this.results
      }, null, 2));
      
      console.log(`\\n📄 Detailed migration report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save migration report:', error.message);
      return null;
    }
  }

  async run() {
    console.log('🚀 Starting MCP-Based Missing Entity Migration System...\\n');

    try {
      // Get entity counts
      await this.getSupabaseEntityCount();
      await this.getNeo4jEntityCount();
      
      // Identify missing entities
      const missingEntities = await this.identifyMissingEntities();
      
      if (missingEntities.length === 0) {
        console.log('✅ No missing entities found. All entities are already in Neo4j.');
        return;
      }
      
      // Create migration batches
      this.createMigrationBatches(missingEntities);
      
      // Print migration plan
      console.log(`\\n📋 MIGRATION PLAN:`);
      console.log(`   Entities to migrate: ${missingEntities.length}`);
      console.log(`   Number of batches: ${this.results.migrationResults.totalBatches}`);
      console.log(`   Estimated time: ${this.results.migrationResults.totalBatches * 3}-${this.results.migrationResults.totalBatches * 5} minutes`);
      
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
      
      // Save report
      const reportFile = await this.saveReport();
      
      if (reportFile) {
        console.log(`\\n📄 Detailed migration report: ${reportFile}`);
      }

    } catch (error) {
      console.error('❌ Migration system failed:', error.message);
      console.error(error.stack);
    }
  }
}

// Run the migration system
async function main() {
  const migrator = new MissingEntityMigrationMCP();
  await migrator.run();
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

module.exports = { MissingEntityMigrationMCP };