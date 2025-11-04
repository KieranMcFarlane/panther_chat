/**
 * Direct Missing Entity Migration using Existing Infrastructure
 * 
 * This script directly queries Supabase and Neo4j to identify and migrate
 * missing entities without requiring complex API infrastructure.
 */

const { createClient } = require('@supabase/supabase-js');
const neo4j = require('neo4j-driver');

class DirectMissingEntityMigrator {
  constructor() {
    this.supabase = null;
    this.neo4jDriver = null;
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

  async initializeConnections() {
    console.log('🔌 Initializing database connections...');
    
    try {
      // Initialize Supabase
      this.supabase = createClient(
        'https://cxegmhkvlxejhiwpjzkw.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZWdtaGt2bHhlamhpd3Bqemt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY0NzcwMiwiZXhwIjoyMDcwMjIzNzAyfQ.g5aA6rP2l9qwN1h3C4X2tXq5JY5L6r8qX9kL1Y3Z9W'
      );
      
      // Test Supabase connection
      const { data, error } = await this.supabase.from('cached_entities').select('count').limit(1);
      if (error) throw error;
      
      // Initialize Neo4j
      this.neo4jDriver = neo4j.driver(
        'neo4j+s://cce1f84b.databases.neo4j.io',
        neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
      );
      
      const session = this.neo4jDriver.session();
      await session.run('RETURN 1');
      await session.close();
      
      console.log('✅ Database connections established');
      
    } catch (error) {
      console.error('❌ Failed to initialize connections:', error.message);
      throw error;
    }
  }

  async getEntityCounts() {
    console.log('📊 Getting entity counts...');
    
    try {
      // Get Supabase count
      const { count } = await this.supabase
        .from('cached_entities')
        .select('*', { count: 'exact', head: true });
      
      this.results.totalSupabase = count || 0;
      
      // Get Neo4j count
      const session = this.neo4jDriver.session();
      const result = await session.run('MATCH (n) RETURN count(n) as totalNodes');
      this.results.totalNeo4j = result.records[0].get('totalNodes');
      await session.close();
      
      console.log(`✅ Found ${this.results.totalSupabase} entities in Supabase, ${this.results.totalNeo4j} in Neo4j`);
      
    } catch (error) {
      console.error('❌ Error getting entity counts:', error.message);
      throw error;
    }
  }

  async checkEntityInNeo4j(neo4jId) {
    const session = this.neo4jDriver.session();
    
    try {
      const result = await session.run(`
        MATCH (n) WHERE n.id = $id OR toString(n.id) = $id
        RETURN n.id as foundId
        LIMIT 1
      `, { id: neo4jId.toString() });
      
      return result.records.length > 0;
    } catch (error) {
      console.warn(`⚠️  Error checking Neo4j entity ${neo4jId}:`, error.message);
      return false;
    } finally {
      await session.close();
    }
  }

  async identifyMissingEntities() {
    console.log('🔍 Identifying missing entities from Neo4j...');
    
    const missingEntities = [];
    const batchSize = 100;
    let offset = 0;
    let processedCount = 0;
    
    while (offset < this.results.totalSupabase) {
      console.log(`Fetching Supabase batch ${Math.floor(offset/batchSize) + 1} (${offset}-${offset+batchSize-1})...`);
      
      try {
        const { data: entities, error } = await this.supabase
          .from('cached_entities')
          .select('id, neo4j_id, labels, properties')
          .order('id')
          .range(offset, offset + batchSize - 1);
        
        if (error) throw error;
        if (entities.length === 0) break;
        
        console.log(`Checking ${entities.length} entities against Neo4j...`);
        
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
            
            processedCount++;
            
            // Progress update
            if (processedCount % 50 === 0) {
              console.log(`Progress: ${processedCount}/${this.results.totalSupabase} (Missing: ${missingEntities.length})`);
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
        
        // Add delay to avoid overwhelming Neo4j
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error processing batch ${offset}:`, error.message);
        break;
      }
    }
    
    this.results.missingEntities = missingEntities;
    console.log(`✅ Missing entity identification complete: ${missingEntities.length} missing entities found`);
    
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

  async migrateEntityToNeo4j(entity, transaction) {
    const normalizedEntity = this.normalizeEntityForNeo4j(entity);
    const labelsString = normalizedEntity.labels.map(label => `:${label}`).join(' ');
    
    const cypherQuery = `
      MERGE (e:Entity ${labelsString} {id: $id})
      ON CREATE SET e += $properties
      ON MATCH SET e += $properties
      RETURN e
    `;

    await transaction.run(cypherQuery, {
      id: normalizedEntity.id,
      properties: normalizedEntity.properties
    });
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

    const session = this.neo4jDriver.session({
      defaultAccessMode: neo4j.session.WRITE
    });

    const transaction = session.beginTransaction();
    
    try {
      for (const entity of batch.entities) {
        try {
          await this.migrateEntityToNeo4j(entity, transaction);
          
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
      }

      await transaction.commit();
      batchResult.endTime = new Date().toISOString();
      
      console.log(`✅ Batch ${batch.batchNumber} completed: ${batchResult.successful} successful, ${batchResult.failed} failed`);
      
    } catch (error) {
      await transaction.rollback();
      batchResult.endTime = new Date().toISOString();
      batchResult.errors.push({
        error: `Batch transaction failed: ${error.message}`,
        severity: 'critical'
      });
      
      console.error(`❌ Batch ${batch.batchNumber} failed completely:`, error.message);
      
      batchResult.failed = batch.entityCount;
      batchResult.successful = 0;
      
    } finally {
      await transaction.close();
      await session.close();
    }

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
        
        batch.status = batchResult.failed === 0 ? 'completed' : 'completed_with_errors';
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
    
    console.log('\\n📋 BATCH BREAKDOWN:');
    this.results.migrationBatches.forEach(batch => {
      const result = batch.result || {};
      console.log(`   Batch ${batch.batchNumber}: ${batch.status} (${result.successful || 0} success, ${result.failed || 0} failed)`);
    });
    
    console.log('\\n📋 SAMPLE MIGRATED ENTITIES:');
    this.results.migrationBatches.slice(0, 3).forEach(batch => {
      if (batch.result && batch.result.entities) {
        const successful = batch.result.entities.filter(e => e.status === 'success').slice(0, 2);
        successful.forEach(entity => {
          console.log(`   ✓ ${entity.name} (ID: ${entity.id})`);
        });
      }
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

  async cleanup() {
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
      console.log('✅ Neo4j driver closed');
    }
  }

  async run() {
    console.log('🚀 Starting Direct Missing Entity Migration System...\\n');

    try {
      // Initialize connections
      await this.initializeConnections();
      
      // Get entity counts
      await this.getEntityCounts();
      
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
      console.log(`   Estimated time: ${this.results.migrationResults.totalBatches * 2}-${this.results.migrationResults.totalBatches * 4} minutes`);
      
      // Show sample of entities to migrate
      console.log(`\\n📋 SAMPLE ENTITIES TO MIGRATE:`);
      missingEntities.slice(0, 10).forEach((entity, index) => {
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
    } finally {
      await this.cleanup();
    }
  }
}

// Run the migration system
async function main() {
  const migrator = new DirectMissingEntityMigrator();
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

module.exports = { DirectMissingEntityMigrator };