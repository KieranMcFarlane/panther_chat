/**
 * Missing Entity Identification and Migration System
 * 
 * This script will:
 * 1. Identify entities missing from Neo4j by comparing with Supabase
 * 2. Create migration batches of 250 entities
 * 3. Execute migration with proper schema validation
 */

const { createClient } = require('@supabase/supabase-js');
const neo4j = require('neo4j-driver');

class MissingEntityMigrationSystem {
  constructor() {
    this.supabase = null;
    this.neo4jDriver = null;
    this.neo4jSession = null;
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

  async initializeSupabase() {
    console.log('🔌 Connecting to Supabase...');
    
    try {
      this.supabase = createClient(
        'https://cxegmhkvlxejhiwpjzkw.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZWdtaGt2bHhlamhpd3Bqemt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY0NzcwMiwiZXhwIjoyMDcwMjIzNzAyfQ.g5aA6rP2l9qwN1h3C4X2tXq5JY5L6r8qX9kL1Y3Z9W'
      );
      
      // Test connection
      const { data, error } = await this.supabase.from('cached_entities').select('count').limit(1);
      if (error) throw error;
      
      console.log('✅ Supabase connection established');
    } catch (error) {
      console.error('❌ Failed to connect to Supabase:', error.message);
      throw error;
    }
  }

  async initializeNeo4j() {
    console.log('🔌 Connecting to Neo4j...');
    
    try {
      this.neo4jDriver = neo4j.driver(
        'neo4j+s://cce1f84b.databases.neo4j.io',
        neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
      );
      
      this.neo4jSession = this.neo4jDriver.session({
        database: 'neo4j',
        defaultAccessMode: neo4j.session.READ
      });
      
      // Test connection
      await this.neo4jSession.run('RETURN 1');
      console.log('✅ Neo4j connection established');
    } catch (error) {
      console.error('❌ Failed to connect to Neo4j:', error.message);
      throw error;
    }
  }

  async getAllSupabaseEntities() {
    console.log('📊 Getting all entities from Supabase...');
    
    try {
      const batchSize = 500;
      let allEntities = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`Fetching Supabase batch ${Math.floor(offset/batchSize) + 1} (${offset}-${offset+batchSize})...`);
        
        const { data: entities, error } = await this.supabase
          .from('cached_entities')
          .select('id, neo4j_id, labels, properties')
          .order('id')
          .range(offset, offset + batchSize - 1);
        
        if (error) throw error;
        
        if (entities.length === 0) {
          hasMore = false;
        } else {
          allEntities = allEntities.concat(entities);
          offset += batchSize;
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      this.results.totalSupabase = allEntities.length;
      console.log(`✅ Retrieved ${allEntities.length} entities from Supabase`);
      
      return allEntities;
    } catch (error) {
      console.error('❌ Error getting Supabase entities:', error.message);
      throw error;
    }
  }

  async checkEntityExistsInNeo4j(neo4jId) {
    try {
      const result = await this.neo4jSession.run(`
        MATCH (n) WHERE n.id = $id OR toString(n.id) = $id
        RETURN n.id as foundId, n.name as name
        LIMIT 1
      `, { id: neo4jId.toString() });
      
      return result.records.length > 0;
    } catch (error) {
      console.warn(`⚠️  Error checking entity ${neo4jId}:`, error.message);
      return false;
    }
  }

  async identifyMissingEntities(supabaseEntities) {
    console.log('🔍 Identifying missing entities from Neo4j...');
    
    const missingEntities = [];
    const foundEntities = [];
    
    // Check in smaller batches to avoid overwhelming Neo4j
    const checkBatchSize = 50;
    
    for (let i = 0; i < supabaseEntities.length; i += checkBatchSize) {
      const batch = supabaseEntities.slice(i, i + checkBatchSize);
      console.log(`Checking batch ${Math.floor(i/checkBatchSize) + 1}/${Math.ceil(supabaseEntities.length/checkBatchSize)} (${batch.length} entities)...`);
      
      for (const entity of batch) {
        const neo4jId = entity.neo4j_id || entity.id.toString();
        
        try {
          const exists = await this.checkEntityExistsInNeo4j(neo4jId);
          
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
      
      // Add delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Progress update
      if ((i + checkBatchSize) % 250 === 0 || (i + checkBatchSize) >= supabaseEntities.length) {
        console.log(`Progress: ${Math.min(i + checkBatchSize, supabaseEntities.length)}/${supabaseEntities.length} entities checked`);
        console.log(`Found: ${foundEntities.length}, Missing: ${missingEntities.length}`);
      }
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
        tier: properties.tier || '',
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

    // Start a write transaction
    const writeSession = this.neo4jDriver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE
    });

    const transaction = writeSession.beginTransaction();
    
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

      // Commit the transaction
      await transaction.commit();
      batchResult.endTime = new Date().toISOString();
      
      console.log(`✅ Batch ${batch.batchNumber} completed: ${batchResult.successful} successful, ${batchResult.failed} failed`);
      
    } catch (error) {
      // Rollback on failure
      await transaction.rollback();
      batchResult.endTime = new Date().toISOString();
      batchResult.errors.push({
        error: `Batch transaction failed: ${error.message}`,
        severity: 'critical'
      });
      
      console.error(`❌ Batch ${batch.batchNumber} failed completely:`, error.message);
      
      // Mark all entities in this batch as failed
      batchResult.failed = batch.entityCount;
      batchResult.successful = 0;
      batch.entities.forEach(entity => {
        if (!batchResult.entities.find(e => e.id === entity.id)) {
          batchResult.entities.push({
            id: entity.id,
            name: entity.properties?.name || 'Unknown',
            status: 'failed',
            error: 'Batch transaction failed'
          });
        }
      });
    } finally {
      transaction.close();
      writeSession.close();
    }

    return batchResult;
  }

  async runMigration() {
    console.log(`🚀 Starting migration of ${this.results.missingEntities.length} entities in ${this.results.migrationBatches.length} batches...`);
    
    for (const batch of this.results.migrationBatches) {
      try {
        const batchResult = await this.migrateBatch(batch);
        
        this.results.migrationResults.migratedEntities += batchResult.successful;
        this.results.migrationResults.failedEntities += batchResult.failed;
        this.results.migrationResults.completedBatches++;
        
        // Update batch status
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
    console.log(`   Success rate: ${((this.results.migrationResults.migratedEntities / this.results.missingEntities.length) * 100).toFixed(2)}%`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 MISSING ENTITY MIGRATION SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n📊 DATA COMPARISON:');
    console.log(`   Supabase cached_entities: ${this.results.totalSupabase}`);
    console.log(`   Missing from Neo4j: ${this.results.missingEntities.length}`);
    console.log(`   Migration batches: ${this.results.migrationResults.totalBatches}`);
    
    console.log('\n🚀 MIGRATION RESULTS:');
    console.log(`   Completed batches: ${this.results.migrationResults.completedBatches}/${this.results.migrationResults.totalBatches}`);
    console.log(`   Successfully migrated: ${this.results.migrationResults.migratedEntities}`);
    console.log(`   Failed migrations: ${this.results.migrationResults.failedEntities}`);
    
    if (this.results.missingEntities.length > 0) {
      console.log(`   Success rate: ${((this.results.migrationResults.migratedEntities / this.results.missingEntities.length) * 100).toFixed(2)}%`);
    }
    
    if (this.results.migrationResults.errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      this.results.migrationResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n📋 BATCH BREAKDOWN:');
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
      
      console.log(`\n📄 Detailed migration report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save migration report:', error.message);
      return null;
    }
  }

  async cleanup() {
    if (this.neo4jSession) {
      await this.neo4jSession.close();
      console.log('✅ Neo4j read session closed');
    }
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
      console.log('✅ Neo4j driver closed');
    }
  }

  async run() {
    console.log('🚀 Starting Missing Entity Identification and Migration System...\n');

    try {
      // Initialize connections
      await this.initializeSupabase();
      await this.initializeNeo4j();
      
      // Get all entities from Supabase
      const supabaseEntities = await this.getAllSupabaseEntities();
      
      // Identify missing entities
      const missingEntities = await this.identifyMissingEntities(supabaseEntities);
      
      if (missingEntities.length === 0) {
        console.log('✅ No missing entities found. All entities are already in Neo4j.');
        return;
      }
      
      // Create migration batches
      this.createMigrationBatches(missingEntities);
      
      // Print migration plan
      console.log(`\n📋 MIGRATION PLAN:`);
      console.log(`   Entities to migrate: ${missingEntities.length}`);
      console.log(`   Number of batches: ${this.results.migrationResults.totalBatches}`);
      console.log(`   Estimated time: ${this.results.migrationResults.totalBatches * 2}-${this.results.migrationResults.totalBatches * 4} minutes`);
      
      // Confirm migration
      console.log('\n🔄 Starting migration process...');
      
      // Run migration
      await this.runMigration();
      
      // Print final summary
      this.printSummary();
      
      // Save report
      const reportFile = await this.saveReport();
      
      if (reportFile) {
        console.log(`\n📄 Detailed migration report: ${reportFile}`);
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
  const migrator = new MissingEntityMigrationSystem();
  await migrator.run();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted. Cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Migration terminated. Cleaning up...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { MissingEntityMigrationSystem };