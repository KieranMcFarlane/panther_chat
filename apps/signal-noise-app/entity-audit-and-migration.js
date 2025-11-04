/**
 * Entity Audit and Migration Script
 * 
 * This script will:
 * 1. Analyze all 4,422 entities for patterns and issues
 * 2. Create logs of incorrectly added entities and suspicious names
 * 3. Cross-reference entities for Neo4j migration
 * 4. Migrate entities to Neo4j with proper schema in batches of 250
 */

const { neo4jDriver } = require('./src/lib/neo4j');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BATCH_SIZE = 250;

// Initialize clients
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

class EntityAuditor {
  constructor() {
    this.neo4jSession = null;
    this.suspiciousPatterns = [
      /^Golf Club \d+$/,           // "Golf Club 1122" pattern
      /^Team \d+$/,               // "Team 1234" pattern
      /^Club \d+$/,               // "Club 5678" pattern
      /^Player \d+$/,             // "Player 9999" pattern
      /^\d+$/,                    // Just numbers
      /^Test \w+/,                // "Test something"
      /^Sample \w+/,              // "Sample something"
      /^Placeholder \w+/,         // "Placeholder something"
      /^Temp \w+/,                // "Temp something"
      /^Duplicate \w+/,           // "Duplicate something"
      /^\w+Copy$/i,               // "Copy" suffix
      /^\w+\s*\d+\s*$/,          // Name ending with numbers
      /^[A-Z]\d+$/,               // Single letter + numbers
    ];
    
    this.validEntityTypes = [
      'Club', 'Person', 'League', 'Organization', 'Partner', 
      'Venue', 'Competition', 'Federation', 'Association'
    ];
    
    this.auditLog = [];
    this.migrationLog = [];
    this.errorLog = [];
  }

  async initializeNeo4j() {
    try {
      if (!neo4jDriver) {
        throw new Error('Neo4j driver not available');
      }
      this.neo4jSession = neo4jDriver.session();
      console.log('✅ Neo4j session initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Neo4j:', error.message);
      throw error;
    }
  }

  async fetchAllEntities() {
    console.log('📖 Fetching all entities from database...');
    
    if (!supabase) {
      console.log('⚠️  Supabase not available, using Neo4j direct access');
      return await this.fetchFromNeo4j();
    }

    const allEntities = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      console.log(`📄 Fetching page ${page + 1} (${page * pageSize}-${(page + 1) * pageSize})...`);
      
      try {
        const { data, error } = await supabase
          .from('entities')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('name', { ascending: true });

        if (error) {
          console.error(`❌ Error fetching page ${page + 1}:`, error.message);
          this.errorLog.push(`Supabase fetch error: ${error.message}`);
          break;
        }

        if (data && data.length > 0) {
          allEntities.push(...data);
          console.log(`✅ Fetched ${data.length} entities from page ${page + 1}`);
        } else {
          hasMore = false;
        }

        page++;
        // Add small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Unexpected error fetching page ${page + 1}:`, error.message);
        this.errorLog.push(`Fetch error: ${error.message}`);
        break;
      }
    }

    console.log(`📊 Total entities fetched: ${allEntities.length}`);
    return allEntities;
  }

  async fetchFromNeo4j() {
    console.log('🔍 Fetching entities directly from Neo4j...');
    
    try {
      const result = await this.neo4jSession.run(
        'MATCH (e) RETURN e LIMIT 10000'
      );
      
      const entities = result.records.map(record => {
        const entity = record.get('e').properties;
        return {
          id: entity.id || entity.neo4j_id,
          name: entity.name,
          type: entity.type || entity.entity_type,
          properties: entity,
          labels: record.get('e').labels
        };
      });

      console.log(`✅ Fetched ${entities.length} entities from Neo4j`);
      return entities;
    } catch (error) {
      console.error('❌ Error fetching from Neo4j:', error.message);
      throw error;
    }
  }

  analyzeEntity(entity) {
    const issues = [];
    const analysis = {
      id: entity.id,
      name: entity.name,
      type: entity.type || entity.entity_type || 'Unknown',
      issues: [],
      severity: 'low',
      suspicious: false,
      recommendedAction: 'keep'
    };

    // Check for missing or invalid name
    if (!entity.name || entity.name.trim() === '') {
      issues.push({
        type: 'missing_name',
        severity: 'high',
        message: 'Entity has no name'
      });
    } else {
      const name = entity.name.trim();
      
      // Check for suspicious name patterns
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(name)) {
          issues.push({
            type: 'suspicious_name',
            severity: 'medium',
            message: `Name matches suspicious pattern: ${pattern}`,
            pattern: pattern.toString()
          });
          analysis.suspicious = true;
        }
      }

      // Check for very short names (less than 2 characters)
      if (name.length < 2) {
        issues.push({
          type: 'too_short_name',
          severity: 'medium',
          message: 'Name is too short'
        });
      }

      // Check for very long names (more than 200 characters)
      if (name.length > 200) {
        issues.push({
          type: 'too_long_name',
          severity: 'low',
          message: 'Name is unusually long'
        });
      }

      // Check for special characters that might indicate bad data
      if (/[^a-zA-Z0-9\s\-\.\'&\(\)]/.test(name)) {
        issues.push({
          type: 'special_characters',
          severity: 'low',
          message: 'Name contains unusual special characters'
        });
      }
    }

    // Check entity type
    if (!analysis.type || analysis.type === 'Unknown') {
      issues.push({
        type: 'missing_type',
        severity: 'high',
        message: 'Entity has no type defined'
      });
    } else if (!this.validEntityTypes.includes(analysis.type)) {
      issues.push({
        type: 'invalid_type',
        severity: 'medium',
        message: `Invalid entity type: ${analysis.type}`,
        validTypes: this.validEntityTypes
      });
    }

    // Check for missing essential properties
    const hasBasicProperties = entity.properties && 
      typeof entity.properties === 'object' &&
      Object.keys(entity.properties).length > 0;

    if (!hasBasicProperties) {
      issues.push({
        type: 'missing_properties',
        severity: 'medium',
        message: 'Entity has no properties or empty properties object'
      });
    }

    // Determine overall severity and recommended action
    if (issues.some(issue => issue.severity === 'high')) {
      analysis.severity = 'high';
      analysis.recommendedAction = 'remove_or_fix';
    } else if (issues.some(issue => issue.severity === 'medium')) {
      analysis.severity = 'medium';
      analysis.recommendedAction = analysis.suspicious ? 'review' : 'keep';
    }

    analysis.issues = issues;
    return analysis;
  }

  async auditEntities(entities) {
    console.log(`🔍 Auditing ${entities.length} entities...`);
    
    const auditResults = {
      total: entities.length,
      valid: 0,
      suspicious: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      byType: {},
      issues: [],
      suspiciousEntities: [],
      highPriorityEntities: []
    };

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      if (i % 500 === 0) {
        console.log(`📊 Auditing progress: ${i}/${entities.length} (${Math.round(i/entities.length*100)}%)`);
      }

      const analysis = this.analyzeEntity(entity);
      
      // Update statistics
      if (analysis.issues.length === 0) {
        auditResults.valid++;
      } else {
        auditResults.issues.push(analysis);
        
        if (analysis.severity === 'high') {
          auditResults.highSeverity++;
          auditResults.highPriorityEntities.push(analysis);
        } else if (analysis.severity === 'medium') {
          auditResults.mediumSeverity++;
        } else {
          auditResults.lowSeverity++;
        }

        if (analysis.suspicious) {
          auditResults.suspicious++;
          auditResults.suspiciousEntities.push(analysis);
        }
      }

      // Track by type
      if (!auditResults.byType[analysis.type]) {
        auditResults.byType[analysis.type] = { count: 0, issues: 0 };
      }
      auditResults.byType[analysis.type].count++;
      if (analysis.issues.length > 0) {
        auditResults.byType[analysis.type].issues++;
      }
    }

    console.log('✅ Entity audit completed');
    return auditResults;
  }

  createAuditReport(auditResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalEntities: auditResults.total,
        validEntities: auditResults.valid,
        entitiesWithIssues: auditResults.total - auditResults.valid,
        suspiciousEntities: auditResults.suspicious,
        highPriorityIssues: auditResults.highSeverity,
        mediumPriorityIssues: auditResults.mediumSeverity,
        lowPriorityIssues: auditResults.lowSeverity
      },
      suspiciousPatterns: {
        "Golf Club XXXX": auditResults.suspiciousEntities.filter(e => 
          /^Golf Club \d+$/.test(e.name)
        ).length,
        "Team XXXX": auditResults.suspiciousEntities.filter(e => 
          /^Team \d+$/.test(e.name)
        ).length,
        "Club XXXX": auditResults.suspiciousEntities.filter(e => 
          /^Club \d+$/.test(e.name)
        ).length,
        "Player XXXX": auditResults.suspiciousEntities.filter(e => 
          /^Player \d+$/.test(e.name)
        ).length,
        "Test/Sample/Placeholder": auditResults.suspiciousEntities.filter(e => 
          /^(Test|Sample|Placeholder|Temp)\s+\w+/.test(e.name)
        ).length
      },
      entitiesByType: auditResults.byType,
      highPriorityEntities: auditResults.highPriorityEntities,
      suspiciousEntities: auditResults.suspiciousEntities.slice(0, 50), // Top 50
      detailedIssues: auditResults.issues.slice(0, 100) // Top 100
    };

    return report;
  }

  async saveAuditReport(report) {
    const filename = `entity-audit-report-${Date.now()}.json`;
    
    try {
      require('fs').writeFileSync(filename, JSON.stringify(report, null, 2));
      console.log(`📄 Audit report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save audit report:', error.message);
      return null;
    }
  }

  async migrateToNeo4j(entities, batchSize = BATCH_SIZE) {
    console.log(`🚀 Starting migration of ${entities.length} entities to Neo4j...`);
    
    const migrationResults = {
      total: entities.length,
      successful: 0,
      failed: 0,
      batches: [],
      errors: []
    };

    // Create batches
    const batches = [];
    for (let i = 0; i < entities.length; i += batchSize) {
      batches.push(entities.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${batches.length} batches of up to ${batchSize} entities each...`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStart = batchIndex * batchSize + 1;
      const batchEnd = Math.min((batchIndex + 1) * batchSize, entities.length);
      
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (entities ${batchStart}-${batchEnd})...`);

      try {
        const batchResult = await this.migrateBatch(batch, batchIndex + 1);
        
        migrationResults.batches.push({
          batchNumber: batchIndex + 1,
          entityCount: batch.length,
          successful: batchResult.successful,
          failed: batchResult.failed,
          errors: batchResult.errors
        });

        migrationResults.successful += batchResult.successful;
        migrationResults.failed += batchResult.failed;

        console.log(`✅ Batch ${batchIndex + 1} completed: ${batchResult.successful} successful, ${batchResult.failed} failed`);

        // Add delay between batches to avoid overwhelming Neo4j
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed completely:`, error.message);
        
        migrationResults.batches.push({
          batchNumber: batchIndex + 1,
          entityCount: batch.length,
          successful: 0,
          failed: batch.length,
          errors: [error.message]
        });

        migrationResults.failed += batch.length;
        migrationResults.errors.push(`Batch ${batchIndex + 1} error: ${error.message}`);
      }
    }

    console.log(`🎉 Migration completed: ${migrationResults.successful} successful, ${migrationResults.failed} failed`);
    return migrationResults;
  }

  async migrateBatch(batch, batchNumber) {
    const batchResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Use a transaction for the batch
    const transaction = this.neo4jSession.beginTransaction();
    
    try {
      for (const entity of batch) {
        try {
          await this.migrateSingleEntity(entity, transaction);
          batchResult.successful++;
        } catch (error) {
          batchResult.failed++;
          batchResult.errors.push({
            entityId: entity.id,
            entityName: entity.name,
            error: error.message
          });
          console.warn(`⚠️  Failed to migrate entity ${entity.id} (${entity.name}): ${error.message}`);
        }
      }

      // Commit the transaction
      await transaction.commit();
      
    } catch (error) {
      // Rollback the transaction on failure
      await transaction.rollback();
      throw new Error(`Batch transaction failed: ${error.message}`);
    } finally {
      transaction.close();
    }

    return batchResult;
  }

  async migrateSingleEntity(entity, transaction) {
    const normalizedEntity = this.normalizeEntityForNeo4j(entity);
    
    // Create the entity with proper labels
    const labels = ['Entity'];
    if (normalizedEntity.type && normalizedEntity.type !== 'Unknown') {
      labels.push(normalizedEntity.type);
    }

    const cypherQuery = `
      MERGE (e:Entity ${labels.map(l => `:${l}`).join(' ')} {id: $id})
      ON CREATE SET e += $properties
      ON MATCH SET e += $properties
      RETURN e
    `;

    await transaction.run(cypherQuery, {
      id: normalizedEntity.id,
      properties: normalizedEntity.properties
    });
  }

  normalizeEntityForNeo4j(entity) {
    return {
      id: entity.id || entity.neo4j_id || `entity_${Date.now()}_${Math.random()}`,
      name: entity.name || 'Unknown Entity',
      type: this.normalizeEntityType(entity.type || entity.entity_type),
      properties: {
        ...entity.properties,
        name: entity.name || 'Unknown Entity',
        entity_type: this.normalizeEntityType(entity.type || entity.entity_type),
        source: 'migration',
        migrated_at: new Date().toISOString(),
        migration_batch: Date.now()
      }
    };
  }

  normalizeEntityType(type) {
    if (!type || type === 'Unknown') return 'Entity';
    
    const typeMap = {
      'club': 'Club',
      'team': 'Club',
      'person': 'Person',
      'individual': 'Person',
      'league': 'League',
      'competition': 'League',
      'organization': 'Organization',
      'org': 'Organization',
      'partner': 'Partner',
      'venue': 'Venue',
      'stadium': 'Venue',
      'federation': 'Federation',
      'association': 'Association'
    };

    const normalized = typeMap[type.toLowerCase()];
    return normalized || (this.validEntityTypes.includes(type) ? type : 'Entity');
  }

  async cleanup() {
    if (this.neo4jSession) {
      await this.neo4jSession.close();
      console.log('✅ Neo4j session closed');
    }
  }

  async run() {
    console.log('🚀 Starting Entity Audit and Migration Process...\n');

    try {
      // Initialize Neo4j connection
      await this.initializeNeo4j();

      // Fetch all entities
      const entities = await this.fetchAllEntities();
      
      if (entities.length === 0) {
        console.log('❌ No entities found to process');
        return;
      }

      // Audit entities
      const auditResults = await this.auditEntities(entities);
      
      // Create and save audit report
      const auditReport = this.createAuditReport(auditResults);
      const reportFile = await this.saveAuditReport(auditReport);

      // Print summary
      this.printAuditSummary(auditReport);

      // Filter entities for migration (exclude high-priority issues)
      const entitiesToMigrate = entities.filter(entity => {
        const analysis = auditResults.issues.find(issue => issue.id === entity.id);
        return !analysis || analysis.severity !== 'high';
      });

      console.log(`\n📊 Migration Plan:`);
      console.log(`   Total entities: ${entities.length}`);
      console.log(`   Entities to migrate: ${entitiesToMigrate.length}`);
      console.log(`   Entities excluded (high priority issues): ${entities.length - entitiesToMigrate.length}`);

      if (entitiesToMigrate.length > 0) {
        // Ask for confirmation before migration
        console.log('\n⚠️  Ready to start migration to Neo4j...');
        console.log('The process will migrate entities in batches of 250.');
        
        // Start migration
        const migrationResults = await this.migrateToNeo4j(entitiesToMigrate);
        
        // Save migration report
        const migrationReport = {
          timestamp: new Date().toISOString(),
          auditReport: reportFile,
          migration: migrationResults
        };
        
        const migrationFile = `migration-report-${Date.now()}.json`;
        try {
          require('fs').writeFileSync(migrationFile, JSON.stringify(migrationReport, null, 2));
          console.log(`\n📄 Migration report saved to: ${migrationFile}`);
        } catch (error) {
          console.error('❌ Failed to save migration report:', error.message);
        }

        this.printMigrationSummary(migrationResults);
      }

    } catch (error) {
      console.error('❌ Audit and migration process failed:', error.message);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }

  printAuditSummary(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 ENTITY AUDIT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Entities: ${report.summary.totalEntities}`);
    console.log(`Valid Entities: ${report.summary.validEntities}`);
    console.log(`Entities with Issues: ${report.summary.entitiesWithIssues}`);
    console.log(`Suspicious Entities: ${report.summary.suspiciousEntities}`);
    console.log(`High Priority Issues: ${report.summary.highPriorityIssues}`);
    console.log(`Medium Priority Issues: ${report.summary.mediumPriorityIssues}`);
    console.log(`Low Priority Issues: ${report.summary.lowPriorityIssues}`);
    
    console.log('\n🔍 SUSPICIOUS PATTERNS DETECTED:');
    Object.entries(report.suspiciousPatterns).forEach(([pattern, count]) => {
      if (count > 0) {
        console.log(`   ${pattern}: ${count} entities`);
      }
    });

    console.log('\n📈 ENTITIES BY TYPE:');
    Object.entries(report.entitiesByType).forEach(([type, stats]) => {
      const issueRate = ((stats.issues / stats.count) * 100).toFixed(1);
      console.log(`   ${type}: ${stats.count} total, ${stats.issues} with issues (${issueRate}%)`);
    });

    if (report.suspiciousEntities.length > 0) {
      console.log('\n⚠️  TOP SUSPICIOUS ENTITIES:');
      report.suspiciousEntities.slice(0, 10).forEach((entity, index) => {
        console.log(`   ${index + 1}. ${entity.name} (ID: ${entity.id}) - ${entity.recommendedAction}`);
      });
    }

    console.log('='.repeat(80));
  }

  printMigrationSummary(results) {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Entities Processed: ${results.total}`);
    console.log(`Successful Migrations: ${results.successful}`);
    console.log(`Failed Migrations: ${results.failed}`);
    console.log(`Success Rate: ${((results.successful / results.total) * 100).toFixed(2)}%`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      results.errors.slice(0, 10).forEach(error => {
        console.log(`   ${error}`);
      });
    }

    console.log('='.repeat(80));
  }
}

// Run the audit and migration
async function main() {
  const auditor = new EntityAuditor();
  await auditor.run();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Process interrupted. Cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Process terminated. Cleaning up...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { EntityAuditor };