/**
 * Neo4j Migration Script
 * 
 * This script will:
 * 1. Load migration data from the audit
 * 2. Migrate entities to Neo4j with proper schema in batches of 250
 * 3. Create proper relationships and indexes
 * 4. Generate comprehensive migration report
 */

const fs = require('fs');
const path = require('path');

class Neo4jMigrator {
  constructor(migrationDataFile) {
    this.migrationDataFile = migrationDataFile;
    this.migrationData = null;
    this.driver = null;
    this.session = null;
    this.migrationResults = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalEntities: 0,
      successfulEntities: 0,
      failedEntities: 0,
      batchResults: [],
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  async initializeNeo4j() {
    console.log('🔌 Initializing Neo4j connection...');
    
    try {
      // Import neo4j driver
      const neo4j = require('neo4j-driver');
      
      this.driver = neo4j.driver(
        process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
        neo4j.auth.basic(
          process.env.NEO4J_USERNAME || 'neo4j',
          process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
        )
      );

      this.session = this.driver.session({
        database: 'neo4j',
        defaultAccessMode: neo4j.session.WRITE
      });

      // Test connection
      await this.session.run('RETURN 1');
      console.log('✅ Neo4j connection established');
      
    } catch (error) {
      console.error('❌ Failed to initialize Neo4j:', error.message);
      throw error;
    }
  }

  loadMigrationData() {
    console.log('📖 Loading migration data...');
    
    try {
      if (!fs.existsSync(this.migrationDataFile)) {
        throw new Error(`Migration data file not found: ${this.migrationDataFile}`);
      }

      const data = fs.readFileSync(this.migrationDataFile, 'utf8');
      this.migrationData = JSON.parse(data);
      
      console.log(`✅ Loaded migration data:`);
      console.log(`   Total entities: ${this.migrationData.totalEntities}`);
      console.log(`   Entities to migrate: ${this.migrationData.entitiesToMigrate}`);
      console.log(`   Number of batches: ${this.migrationData.migrationBatches.length}`);
      
    } catch (error) {
      console.error('❌ Failed to load migration data:', error.message);
      throw error;
    }
  }

  async setupIndexes() {
    console.log('🔧 Setting up Neo4j indexes and constraints...');
    
    const indexes = [
      'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
      'CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)',
      'CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.entity_type)',
      'CREATE INDEX entity_sport_index IF NOT EXISTS FOR (e:Entity) ON (e.sport)',
      'CREATE INDEX entity_country_index IF NOT EXISTS FOR (e:Entity) ON (e.country)',
      'CREATE INDEX entity_level_index IF NOT EXISTS FOR (e:Entity) ON (e.level)'
    ];

    for (const indexQuery of indexes) {
      try {
        await this.session.run(indexQuery);
        console.log(`✅ Created index/constraint: ${indexQuery.split(' ')[2]}`);
      } catch (error) {
        console.warn(`⚠️  Index/constraint already exists or failed: ${error.message}`);
      }
    }
  }

  normalizeEntity(entity) {
    // Ensure proper entity structure for Neo4j
    const normalized = {
      id: entity.id.toString(),
      labels: [...(entity.labels || ['Entity'])],
      properties: {
        // Core properties
        name: entity.properties.name || 'Unknown Entity',
        entity_type: this.normalizeEntityType(entity.properties.type || entity.properties.entity_type || 'Entity'),
        
        // Sports-specific properties
        sport: entity.properties.sport || '',
        level: entity.properties.level || '',
        tier: entity.properties.tier || '',
        country: entity.properties.country || '',
        
        // Contact information
        website: entity.properties.website || '',
        linkedin: entity.properties.linkedin || '',
        mobileApp: entity.properties.mobileApp || '',
        
        // Business information
        description: entity.properties.description || '',
        notes: entity.properties.notes || '',
        
        // Enrichment data
        enriched: entity.properties.enriched || false,
        enriched_at: entity.properties.enriched_at || null,
        enrichment_summary: entity.properties.enrichment_summary || '',
        
        // Scoring and classification
        priorityScore: entity.properties.priorityScore || '',
        estimatedValue: entity.properties.estimatedValue || '',
        digitalWeakness: entity.properties.digitalWeakness || '',
        opportunityType: entity.properties.opportunityType || '',
        
        // Data sources
        data_sources: entity.properties.data_sources || '',
        company_info: entity.properties.company_info || '',
        key_contacts: entity.properties.key_contacts || '',
        tenders_rfps: entity.properties.tenders_rfps || '',
        
        // Migration metadata
        source: entity.properties.source || 'migration',
        migrated_at: new Date().toISOString(),
        migration_batch: Date.now(),
        original_labels: entity.labels || ['Entity']
      }
    };

    // Add proper entity type as label if it's a valid type
    const validTypes = ['Club', 'Person', 'League', 'Organization', 'Partner', 'Venue', 'Competition', 'Federation', 'Association'];
    if (validTypes.includes(normalized.properties.entity_type) && !normalized.labels.includes(normalized.properties.entity_type)) {
      normalized.labels.push(normalized.properties.entity_type);
    }

    return normalized;
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
      'association': 'Association'
    };

    const normalized = typeMap[type.toLowerCase()];
    return normalized || (validTypes.includes(type) ? type : 'Entity');
  }

  async migrateBatch(batch, batchNumber) {
    console.log(`🔄 Processing batch ${batchNumber}/${this.migrationData.migrationBatches.length} (${batch.entityCount} entities)...`);
    
    const batchResult = {
      batchNumber,
      entityCount: batch.entities.length,
      startTime: new Date().toISOString(),
      successful: 0,
      failed: 0,
      errors: [],
      entities: []
    };

    // Use a transaction for the batch
    const transaction = this.session.beginTransaction();
    
    try {
      for (const entity of batch.entities) {
        try {
          const normalizedEntity = this.normalizeEntity(entity);
          await this.createEntity(normalizedEntity, transaction);
          
          batchResult.successful++;
          batchResult.entities.push({
            id: entity.id,
            name: entity.properties.name,
            status: 'success'
          });
          
        } catch (error) {
          batchResult.failed++;
          batchResult.errors.push({
            entityId: entity.id,
            entityName: entity.properties.name,
            error: error.message
          });
          
          batchResult.entities.push({
            id: entity.id,
            name: entity.properties.name,
            status: 'failed',
            error: error.message
          });
          
          console.warn(`⚠️  Failed to migrate entity ${entity.id} (${entity.properties.name}): ${error.message}`);
        }
      }

      // Commit the transaction
      await transaction.commit();
      batchResult.endTime = new Date().toISOString();
      
      console.log(`✅ Batch ${batchNumber} completed: ${batchResult.successful} successful, ${batchResult.failed} failed`);
      
    } catch (error) {
      // Rollback the transaction on failure
      await transaction.rollback();
      batchResult.endTime = new Date().toISOString();
      batchResult.errors.push({
        error: `Batch transaction failed: ${error.message}`,
        severity: 'critical'
      });
      
      console.error(`❌ Batch ${batchNumber} failed completely:`, error.message);
      
      // Mark all entities in this batch as failed
      batchResult.failed = batchResult.entityCount;
      batchResult.successful = 0;
      batch.entities.forEach(entity => {
        if (!batchResult.entities.find(e => e.id === entity.id)) {
          batchResult.entities.push({
            id: entity.id,
            name: entity.properties.name,
            status: 'failed',
            error: 'Batch transaction failed'
          });
        }
      });
    } finally {
      transaction.close();
    }

    return batchResult;
  }

  async createEntity(entity, transaction) {
    const labelsString = entity.labels.map(label => `:${label}`).join(' ');
    
    const cypherQuery = `
      MERGE (e:Entity ${labelsString} {id: $id})
      ON CREATE SET e += $properties
      ON MATCH SET e += $properties
      RETURN e
    `;

    await transaction.run(cypherQuery, {
      id: entity.id,
      properties: entity.properties
    });
  }

  async migrateAllBatches() {
    console.log(`🚀 Starting migration of ${this.migrationData.entitiesToMigrate} entities in ${this.migrationData.migrationBatches.length} batches...`);
    
    this.migrationResults.startTime = new Date().toISOString();
    this.migrationResults.totalBatches = this.migrationData.migrationBatches.length;
    this.migrationResults.totalEntities = this.migrationData.entitiesToMigrate;

    for (let i = 0; i < this.migrationData.migrationBatches.length; i++) {
      const batch = this.migrationData.migrationBatches[i];
      
      try {
        const batchResult = await this.migrateBatch(batch, i + 1);
        this.migrationResults.batchResults.push(batchResult);
        this.migrationResults.successfulEntities += batchResult.successful;
        this.migrationResults.failedEntities += batchResult.failed;
        
        if (batchResult.failed === 0) {
          this.migrationResults.successfulBatches++;
        } else {
          this.migrationResults.failedBatches++;
        }

        // Add delay between batches to avoid overwhelming Neo4j
        if (i < this.migrationData.migrationBatches.length - 1) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Critical error in batch ${i + 1}:`, error.message);
        this.migrationResults.errors.push(`Batch ${i + 1} critical error: ${error.message}`);
        this.migrationResults.failedBatches++;
        this.migrationResults.failedEntities += batch.entityCount;
      }
    }

    this.migrationResults.endTime = new Date().toISOString();
    
    console.log(`🎉 Migration completed!`);
    console.log(`   Total batches: ${this.migrationResults.totalBatches}`);
    console.log(`   Successful batches: ${this.migrationResults.successfulBatches}`);
    console.log(`   Failed batches: ${this.migrationResults.failedBatches}`);
    console.log(`   Total entities: ${this.migrationResults.totalEntities}`);
    console.log(`   Successful entities: ${this.migrationResults.successfulEntities}`);
    console.log(`   Failed entities: ${this.migrationResults.failedEntities}`);
    console.log(`   Success rate: ${((this.migrationResults.successfulEntities / this.migrationResults.totalEntities) * 100).toFixed(2)}%`);
  }

  async createSampleRelationships() {
    console.log('🔗 Creating sample relationships...');
    
    try {
      // Create some basic relationships between entities of the same sport and country
      const relationshipQueries = [
        // Connect clubs to leagues
        'MATCH (c:Entity {entity_type: "Club"}), (l:Entity {entity_type: "League"}) WHERE c.sport = l.sport AND c.level = l.level MERGE (c)-[:PARTICIPATES_IN]->(l)',
        
        // Connect entities in the same country
        'MATCH (e1:Entity), (e2:Entity) WHERE e1.country = e2.country AND e1.country <> "" AND id(e1) < id(e2) MERGE (e1)-[:SAME_COUNTRY]->(e2)',
        
        // Connect entities of the same sport
        'MATCH (e1:Entity), (e2:Entity) WHERE e1.sport = e2.sport AND e1.sport <> "" AND id(e1) < id(e2) MERGE (e1)-[:SAME_SPORT]->(e2)'
      ];

      for (const query of relationshipQueries) {
        try {
          const result = await this.session.run(query);
          console.log(`✅ Created relationships: ${result.summary.counters.relationshipsCreated || 0}`);
        } catch (error) {
          console.warn(`⚠️  Relationship creation failed: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to create relationships:', error.message);
    }
  }

  generateMigrationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      migrationDataFile: this.migrationDataFile,
      summary: {
        totalBatches: this.migrationResults.totalBatches,
        successfulBatches: this.migrationResults.successfulBatches,
        failedBatches: this.migrationResults.failedBatches,
        totalEntities: this.migrationResults.totalEntities,
        successfulEntities: this.migrationResults.successfulEntities,
        failedEntities: this.migrationResults.failedEntities,
        successRate: ((this.migrationResults.successfulEntities / this.migrationResults.totalEntities) * 100).toFixed(2),
        startTime: this.migrationResults.startTime,
        endTime: this.migrationResults.endTime,
        duration: this.migrationResults.endTime ? 
          new Date(this.migrationResults.endTime) - new Date(this.migrationResults.startTime) : 
          null
      },
      batchResults: this.migrationResults.batchResults,
      errors: this.migrationResults.errors,
      failedEntities: []
    };

    // Collect all failed entities
    this.migrationResults.batchResults.forEach(batch => {
      batch.entities.forEach(entity => {
        if (entity.status === 'failed') {
          report.failedEntities.push(entity);
        }
      });
    });

    return report;
  }

  saveMigrationReport(report) {
    const filename = `neo4j-migration-report-${Date.now()}.json`;
    
    try {
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      console.log(`📄 Migration report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save migration report:', error.message);
      return null;
    }
  }

  async cleanup() {
    if (this.session) {
      await this.session.close();
      console.log('✅ Neo4j session closed');
    }
    if (this.driver) {
      await this.driver.close();
      console.log('✅ Neo4j driver closed');
    }
  }

  async run() {
    console.log('🚀 Starting Neo4j Migration Process...\n');

    try {
      // Load migration data
      this.loadMigrationData();
      
      // Initialize Neo4j connection
      await this.initializeNeo4j();
      
      // Setup indexes and constraints
      await this.setupIndexes();
      
      // Run migration
      await this.migrateAllBatches();
      
      // Create some basic relationships
      await this.createSampleRelationships();
      
      // Generate and save report
      const report = this.generateMigrationReport();
      const reportFile = this.saveMigrationReport(report);
      
      // Print final summary
      this.printFinalSummary(report);
      
      if (reportFile) {
        console.log(`\n📄 Detailed migration report: ${reportFile}`);
      }

    } catch (error) {
      console.error('❌ Migration process failed:', error.message);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }

  printFinalSummary(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 NEO4J MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Batches: ${report.summary.totalBatches}`);
    console.log(`Successful Batches: ${report.summary.successfulBatches}`);
    console.log(`Failed Batches: ${report.summary.failedBatches}`);
    console.log(`Total Entities: ${report.summary.totalEntities}`);
    console.log(`Successful Migrations: ${report.summary.successfulEntities}`);
    console.log(`Failed Migrations: ${report.summary.failedEntities}`);
    console.log(`Success Rate: ${report.summary.successRate}%`);
    
    if (report.summary.duration) {
      const duration = report.summary.duration;
      const seconds = Math.floor(duration / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      console.log(`Duration: ${minutes}m ${remainingSeconds}s`);
    }
    
    if (report.failedEntities.length > 0) {
      console.log(`\n❌ Failed Entities (${report.failedEntities.length}):`);
      report.failedEntities.slice(0, 10).forEach((entity, index) => {
        console.log(`   ${index + 1}. ${entity.name} (ID: ${entity.id}) - ${entity.error}`);
      });
      
      if (report.failedEntities.length > 10) {
        console.log(`   ... and ${report.failedEntities.length - 10} more`);
      }
    }

    if (report.errors.length > 0) {
      console.log(`\n⚠️  Critical Errors:`);
      report.errors.forEach(error => {
        console.log(`   ${error}`);
      });
    }

    console.log('='.repeat(80));
  }
}

// Run the migration
async function main() {
  // Find the latest migration data file
  const files = fs.readdirSync('.').filter(file => file.startsWith('migration-data-') && file.endsWith('.json'));
  
  if (files.length === 0) {
    console.error('❌ No migration data files found. Please run the audit script first.');
    process.exit(1);
  }
  
  // Sort files by timestamp (newest first)
  files.sort((a, b) => b.localeCompare(a));
  const latestFile = files[0];
  
  console.log(`📄 Using migration data file: ${latestFile}`);
  
  const migrator = new Neo4jMigrator(latestFile);
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

module.exports = { Neo4jMigrator };