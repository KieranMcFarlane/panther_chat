/**
 * Simple Entity Audit Script
 * 
 * This script will:
 * 1. Fetch all entities via the API
 * 2. Analyze them for patterns and issues  
 * 3. Create logs of suspicious entities
 * 4. Prepare migration data for Neo4j
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

class SimpleEntityAuditor {
  constructor() {
    this.baseUrl = 'http://localhost:3005';
    this.entities = [];
    this.auditResults = {
      total: 0,
      valid: 0,
      suspicious: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      suspiciousEntities: [],
      highPriorityEntities: [],
      issuesByType: {},
      suspiciousPatterns: {}
    };
    
    this.suspiciousPatterns = [
      { name: 'Golf Club XXXX', pattern: /^Golf Club \d+$/, severity: 'high' },
      { name: 'Team XXXX', pattern: /^Team \d+$/, severity: 'high' },
      { name: 'Club XXXX', pattern: /^Club \d+$/, severity: 'high' },
      { name: 'Player XXXX', pattern: /^Player \d+$/, severity: 'high' },
      { name: 'Just Numbers', pattern: /^\d+$/, severity: 'high' },
      { name: 'Test Entities', pattern: /^Test \w+/, severity: 'medium' },
      { name: 'Sample Entities', pattern: /^Sample \w+/, severity: 'medium' },
      { name: 'Placeholder', pattern: /^Placeholder \w+/, severity: 'medium' },
      { name: 'Temp Entities', pattern: /^Temp \w+/, severity: 'medium' },
      { name: 'Duplicate Copy', pattern: /^\w+Copy$/i, severity: 'medium' },
      { name: 'Name with Numbers', pattern: /^\w+\s*\d+\s*$/, severity: 'low' },
      { name: 'Single Letter + Numbers', pattern: /^[A-Z]\d+$/, severity: 'medium' },
    ];
    
    this.validEntityTypes = [
      'Club', 'Person', 'League', 'Organization', 'Partner', 
      'Venue', 'Competition', 'Federation', 'Association', 'Entity'
    ];
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const req = protocol.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async fetchAllEntities() {
    console.log('📖 Fetching all entities from API...');
    
    try {
      // First get the total count
      const countResponse = await this.makeRequest(`${this.baseUrl}/api/entities?limit=1`);
      const total = countResponse.pagination?.total || 4422;
      console.log(`📊 Total entities to fetch: ${total}`);
      
      const allEntities = [];
      const limit = 1000; // Fetch in larger batches for efficiency
      
      for (let offset = 0; offset < total; offset += limit) {
        console.log(`📄 Fetching entities ${offset + 1}-${Math.min(offset + limit, total)}...`);
        
        try {
          const response = await this.makeRequest(
            `${this.baseUrl}/api/entities?limit=${limit}&offset=${offset}&sortBy=name&sortOrder=asc`
          );
          
          if (response.entities && response.entities.length > 0) {
            allEntities.push(...response.entities);
            console.log(`✅ Fetched ${response.entities.length} entities`);
          } else {
            console.log(`⚠️  No entities returned for offset ${offset}`);
            break;
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ Error fetching batch at offset ${offset}:`, error.message);
          // Continue with next batch
        }
      }
      
      console.log(`🎉 Successfully fetched ${allEntities.length} entities`);
      return allEntities;
      
    } catch (error) {
      console.error('❌ Failed to fetch entities:', error.message);
      throw error;
    }
  }

  analyzeEntity(entity) {
    const issues = [];
    const analysis = {
      id: entity.id,
      name: entity.properties?.name || entity.name || 'Unknown',
      type: this.extractEntityType(entity),
      issues: [],
      severity: 'low',
      suspicious: false,
      recommendedAction: 'keep'
    };

    // Check for missing or invalid name
    if (!analysis.name || analysis.name.trim() === '') {
      issues.push({
        type: 'missing_name',
        severity: 'high',
        message: 'Entity has no name'
      });
    } else {
      const name = analysis.name.trim();
      
      // Check against suspicious patterns
      for (const suspiciousPattern of this.suspiciousPatterns) {
        if (suspiciousPattern.pattern.test(name)) {
          issues.push({
            type: 'suspicious_name',
            severity: suspiciousPattern.severity,
            message: `Name matches suspicious pattern: ${suspiciousPattern.name}`,
            pattern: suspiciousPattern.name
          });
          analysis.suspicious = true;
          
          // Track pattern statistics
          if (!this.auditResults.suspiciousPatterns[suspiciousPattern.name]) {
            this.auditResults.suspiciousPatterns[suspiciousPattern.name] = [];
          }
          this.auditResults.suspiciousPatterns[suspiciousPattern.name].push({
            id: entity.id,
            name: name
          });
        }
      }

      // Check for very short names
      if (name.length < 2) {
        issues.push({
          type: 'too_short_name',
          severity: 'medium',
          message: 'Name is too short'
        });
      }

      // Check for very long names
      if (name.length > 200) {
        issues.push({
          type: 'too_long_name',
          severity: 'low',
          message: 'Name is unusually long'
        });
      }

      // Check for special characters
      if (/[^a-zA-Z0-9\s\-\.\'&\(\)\[\]\/\\,°]/.test(name)) {
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
        severity: 'medium',
        message: 'Entity has no clear type'
      });
    } else if (!this.validEntityTypes.includes(analysis.type)) {
      issues.push({
        type: 'invalid_type',
        severity: 'low',
        message: `Unusual entity type: ${analysis.type}`
      });
    }

    // Check for missing properties
    if (!entity.properties || Object.keys(entity.properties).length === 0) {
      issues.push({
        type: 'missing_properties',
        severity: 'medium',
        message: 'Entity has no properties'
      });
    }

    // Determine overall severity
    const highSeverityIssues = issues.filter(issue => issue.severity === 'high');
    const mediumSeverityIssues = issues.filter(issue => issue.severity === 'medium');
    
    if (highSeverityIssues.length > 0) {
      analysis.severity = 'high';
      analysis.recommendedAction = 'remove_or_fix';
    } else if (mediumSeverityIssues.length > 0) {
      analysis.severity = 'medium';
      analysis.recommendedAction = analysis.suspicious ? 'review' : 'keep';
    }

    analysis.issues = issues;
    return analysis;
  }

  extractEntityType(entity) {
    // Try to extract entity type from labels or properties
    if (entity.labels && entity.labels.length > 0) {
      for (const label of entity.labels) {
        if (this.validEntityTypes.includes(label)) {
          return label;
        }
      }
    }
    
    if (entity.properties) {
      const typeCandidates = [
        entity.properties.type,
        entity.properties.entity_type,
        entity.properties.category,
        entity.properties.entityType
      ];
      
      for (const candidate of typeCandidates) {
        if (candidate && this.validEntityTypes.includes(candidate)) {
          return candidate;
        }
      }
    }
    
    return 'Entity'; // Default type
  }

  async auditEntities() {
    console.log(`🔍 Starting audit of ${this.entities.length} entities...`);
    
    for (let i = 0; i < this.entities.length; i++) {
      const entity = this.entities[i];
      
      if (i % 500 === 0) {
        console.log(`📊 Audit progress: ${i}/${this.entities.length} (${Math.round(i/this.entities.length*100)}%)`);
      }

      const analysis = this.analyzeEntity(entity);
      
      // Update statistics
      this.auditResults.total++;
      
      if (analysis.issues.length === 0) {
        this.auditResults.valid++;
      } else {
        if (analysis.severity === 'high') {
          this.auditResults.highSeverity++;
          this.auditResults.highPriorityEntities.push(analysis);
        } else if (analysis.severity === 'medium') {
          this.auditResults.mediumSeverity++;
        } else {
          this.auditResults.lowSeverity++;
        }

        if (analysis.suspicious) {
          this.auditResults.suspicious++;
          this.auditResults.suspiciousEntities.push(analysis);
        }

        // Track issues by type
        if (!this.auditResults.issuesByType[analysis.type]) {
          this.auditResults.issuesByType[analysis.type] = { count: 0, issues: 0 };
        }
        this.auditResults.issuesByType[analysis.type].count++;
        this.auditResults.issuesByType[analysis.type].issues++;
      }
    }

    console.log('✅ Entity audit completed');
  }

  createAuditReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalEntities: this.auditResults.total,
        validEntities: this.auditResults.valid,
        entitiesWithIssues: this.auditResults.total - this.auditResults.valid,
        suspiciousEntities: this.auditResults.suspicious,
        highPriorityIssues: this.auditResults.highSeverity,
        mediumPriorityIssues: this.auditResults.mediumSeverity,
        lowPriorityIssues: this.auditResults.lowSeverity,
        suspiciousPatterns: {}
      },
      suspiciousPatterns: {},
      entitiesByType: this.auditResults.issuesByType,
      highPriorityEntities: this.auditResults.highPriorityEntities.slice(0, 50),
      suspiciousEntities: this.auditResults.suspiciousEntities.slice(0, 100),
      detailedIssues: this.auditResults.suspiciousEntities.slice(0, 200)
    };

    // Process suspicious patterns for cleaner output
    Object.entries(this.auditResults.suspiciousPatterns).forEach(([pattern, entities]) => {
      report.summary.suspiciousPatterns[pattern] = entities.length;
      report.suspiciousPatterns[pattern] = {
        count: entities.length,
        examples: entities.slice(0, 10)
      };
    });

    return report;
  }

  saveAuditReport(report) {
    const filename = `entity-audit-report-${Date.now()}.json`;
    
    try {
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      console.log(`📄 Audit report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save audit report:', error.message);
      return null;
    }
  }

  saveMigrationData() {
    // Prepare entities for migration (exclude high priority issues)
    const entitiesToMigrate = this.entities.filter(entity => {
      const analysis = this.auditResults.highPriorityEntities.find(
        issue => issue.id === entity.id
      );
      return !analysis; // Keep entities without high priority issues
    });

    // Normalize entities for Neo4j migration
    const migrationData = entitiesToMigrate.map(entity => ({
      id: entity.id,
      neo4j_id: entity.neo4j_id || entity.id,
      labels: entity.labels || ['Entity'],
      properties: {
        ...entity.properties,
        name: entity.properties?.name || entity.name || 'Unknown Entity',
        entity_type: this.extractEntityType(entity),
        source: 'migration_audit',
        migrated_at: new Date().toISOString()
      }
    }));

    const filename = `migration-data-${Date.now()}.json`;
    
    try {
      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalEntities: this.entities.length,
        entitiesToMigrate: migrationData.length,
        excludedEntities: this.entities.length - migrationData.length,
        migrationBatches: this.createBatches(migrationData),
        entities: migrationData
      }, null, 2));
      
      console.log(`📄 Migration data saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save migration data:', error.message);
      return null;
    }
  }

  createBatches(entities, batchSize = 250) {
    const batches = [];
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      batches.push({
        batchNumber: Math.floor(i / batchSize) + 1,
        entityCount: batch.length,
        startEntity: i + 1,
        endEntity: Math.min(i + batchSize, entities.length),
        entities: batch
      });
    }
    return batches;
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
    Object.entries(report.summary.suspiciousPatterns).forEach(([pattern, count]) => {
      if (count > 0) {
        console.log(`   ${pattern}: ${count} entities`);
      }
    });

    console.log('\n📈 ENTITIES BY TYPE:');
    Object.entries(report.entitiesByType).forEach(([type, stats]) => {
      const issueRate = stats.count > 0 ? ((stats.issues / stats.count) * 100).toFixed(1) : '0.0';
      console.log(`   ${type}: ${stats.count} total, ${stats.issues} with issues (${issueRate}%)`);
    });

    if (report.suspiciousEntities.length > 0) {
      console.log('\n⚠️  TOP SUSPICIOUS ENTITIES:');
      report.suspiciousEntities.slice(0, 20).forEach((entity, index) => {
        const pattern = entity.issues.find(issue => issue.type === 'suspicious_name')?.pattern || 'Unknown';
        console.log(`   ${index + 1}. "${entity.name}" (ID: ${entity.id}) - Pattern: ${pattern}`);
      });
    }

    if (report.highPriorityEntities.length > 0) {
      console.log('\n🚨 HIGH PRIORITY ISSUES:');
      report.highPriorityEntities.slice(0, 10).forEach((entity, index) => {
        console.log(`   ${index + 1}. "${entity.name}" (ID: ${entity.id}) - ${entity.recommendedAction}`);
        entity.issues.forEach(issue => {
          console.log(`      - ${issue.message}`);
        });
      });
    }

    console.log('='.repeat(80));
  }

  async run() {
    console.log('🚀 Starting Simple Entity Audit Process...\n');

    try {
      // Fetch all entities
      this.entities = await this.fetchAllEntities();
      
      if (this.entities.length === 0) {
        console.log('❌ No entities found to process');
        return;
      }

      // Audit entities
      await this.auditEntities();
      
      // Create and save audit report
      const auditReport = this.createAuditReport();
      const reportFile = this.saveAuditReport(auditReport);

      // Save migration data
      const migrationFile = this.saveMigrationData();

      // Print summary
      this.printAuditSummary(auditReport);

      if (reportFile) {
        console.log(`\n📄 Full audit report: ${reportFile}`);
      }
      
      if (migrationFile) {
        console.log(`📄 Migration data file: ${migrationFile}`);
        
        const migrationData = JSON.parse(fs.readFileSync(migrationFile, 'utf8'));
        console.log(`\n📊 Migration Summary:`);
        console.log(`   Total entities: ${migrationData.totalEntities}`);
        console.log(`   Entities ready for migration: ${migrationData.entitiesToMigrate}`);
        console.log(`   Entities excluded: ${migrationData.excludedEntities}`);
        console.log(`   Number of batches: ${migrationData.migrationBatches.length}`);
      }

    } catch (error) {
      console.error('❌ Audit process failed:', error.message);
      console.error(error.stack);
    }
  }
}

// Run the audit
async function main() {
  const auditor = new SimpleEntityAuditor();
  await auditor.run();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Process terminated.');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { SimpleEntityAuditor };