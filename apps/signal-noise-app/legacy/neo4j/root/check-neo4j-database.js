/**
 * Neo4j Database Check Script
 * 
 * This script will analyze the current state of the Neo4j database:
 * - Count total entities by type
 * - Check schema and labels
 * - Analyze relationships
 * - Verify data quality
 * - Sample entity structures
 */

const neo4j = require('neo4j-driver');

class Neo4jChecker {
  constructor() {
    this.driver = null;
    this.session = null;
    this.results = {
      overview: {},
      entityCounts: {},
      labelDistribution: {},
      relationships: {},
      dataQuality: {},
      samples: []
    };
  }

  async initialize() {
    console.log('🔌 Connecting to Neo4j...');
    
    try {
      this.driver = neo4j.driver(
        process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
        neo4j.auth.basic(
          process.env.NEO4J_USERNAME || 'neo4j',
          process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
        )
      );

      this.session = this.driver.session({
        database: 'neo4j',
        defaultAccessMode: neo4j.session.READ
      });

      // Test connection
      await this.session.run('RETURN 1');
      console.log('✅ Neo4j connection established');
      
    } catch (error) {
      console.error('❌ Failed to connect to Neo4j:', error.message);
      throw error;
    }
  }

  async getOverview() {
    console.log('📊 Getting database overview...');
    
    try {
      // Get total node count
      const nodeCountResult = await this.session.run('MATCH (n) RETURN count(n) as totalNodes');
      const totalNodes = nodeCountResult.records[0].get('totalNodes');
      
      // Get total relationship count
      const relCountResult = await this.session.run('MATCH ()-[r]->() RETURN count(r) as totalRelationships');
      const totalRelationships = relCountResult.records[0].get('totalRelationships');
      
      // Get all distinct labels
      const labelResult = await this.session.run('CALL db.labels() YIELD label RETURN collect(label) as labels');
      const labels = labelResult.records[0].get('labels');
      
      // Get all relationship types
      const relTypeResult = await this.session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types');
      const relationshipTypes = relTypeResult.records[0].get('types');
      
      this.results.overview = {
        totalNodes,
        totalRelationships,
        labels,
        relationshipTypes
      };
      
      console.log(`✅ Found ${totalNodes} nodes and ${totalRelationships} relationships`);
      
    } catch (error) {
      console.error('❌ Error getting overview:', error.message);
      throw error;
    }
  }

  async getEntityCountsByType() {
    console.log('📈 Getting entity counts by type...');
    
    try {
      const result = await this.session.run(`
        MATCH (n) 
        RETURN labels(n) as labels, count(n) as count 
        ORDER BY count DESC
      `);
      
      const entityCounts = {};
      result.records.forEach(record => {
        const labels = record.get('labels');
        const count = record.get('count');
        const primaryLabel = labels[0] || 'Unknown';
        
        entityCounts[primaryLabel] = {
          count,
          labels
        };
      });
      
      this.results.entityCounts = entityCounts;
      console.log(`✅ Found ${Object.keys(entityCounts).length} entity types`);
      
    } catch (error) {
      console.error('❌ Error getting entity counts:', error.message);
      throw error;
    }
  }

  async getRelationshipDistribution() {
    console.log('🔗 Analyzing relationships...');
    
    try {
      const result = await this.session.run(`
        MATCH ()-[r]->() 
        RETURN type(r) as type, count(r) as count 
        ORDER BY count DESC
      `);
      
      const relationships = {};
      result.records.forEach(record => {
        relationships[record.get('type')] = record.get('count');
      });
      
      this.results.relationships = relationships;
      console.log(`✅ Found ${Object.keys(relationships).length} relationship types`);
      
    } catch (error) {
      console.error('❌ Error analyzing relationships:', error.message);
    }
  }

  async getDataQualityStats() {
    console.log('🔍 Analyzing data quality...');
    
    try {
      // Check entities with missing names
      const missingNamesResult = await this.session.run(`
        MATCH (n) WHERE n.name IS NULL OR n.name = '' 
        RETURN count(n) as missingNames
      `);
      
      // Check entities without types
      const noTypeResult = await this.session.run(`
        MATCH (n) WHERE n.entity_type IS NULL OR n.entity_type = '' 
        RETURN count(n) as noType
      `);
      
      // Check enriched entities
      const enrichedResult = await this.session.run(`
        MATCH (n) WHERE n.enriched = true 
        RETURN count(n) as enriched
      `);
      
      // Check entities with LinkedIn data
      const linkedInResult = await this.session.run(`
        MATCH (n) WHERE n.linkedin IS NOT NULL AND n.linkedin <> '' 
        RETURN count(n) as hasLinkedIn
      `);
      
      // Check entities with websites
      const websiteResult = await this.session.run(`
        MATCH (n) WHERE n.website IS NOT NULL AND n.website <> '' 
        RETURN count(n) as hasWebsite
      `);
      
      this.results.dataQuality = {
        missingNames: missingNamesResult.records[0]?.get('missingNames') || 0,
        noType: noTypeResult.records[0]?.get('noType') || 0,
        enriched: enrichedResult.records[0]?.get('enriched') || 0,
        hasLinkedIn: linkedInResult.records[0]?.get('hasLinkedIn') || 0,
        hasWebsite: websiteResult.records[0]?.get('hasWebsite') || 0
      };
      
      console.log('✅ Data quality analysis completed');
      
    } catch (error) {
      console.error('❌ Error analyzing data quality:', error.message);
    }
  }

  async getSampleEntities() {
    console.log('📋 Getting sample entities...');
    
    try {
      // Get samples of different entity types
      const sampleTypes = ['Entity', 'Club', 'Person', 'League', 'Organization'];
      const samples = [];
      
      for (const type of sampleTypes) {
        try {
          const result = await this.session.run(`
            MATCH (n:${type}) 
            RETURN n, labels(n) as labels
            LIMIT 3
          `);
          
          result.records.forEach(record => {
            const node = record.get('n');
            const labels = record.get('labels');
            samples.push({
              id: node.id,
              labels,
              properties: node.properties,
              type: labels[0]
            });
          });
        } catch (error) {
          console.warn(`⚠️  Could not get samples for type ${type}:`, error.message);
        }
      }
      
      this.results.samples = samples;
      console.log(`✅ Collected ${samples.length} sample entities`);
      
    } catch (error) {
      console.error('❌ Error getting sample entities:', error.message);
    }
  }

  async getSportDistribution() {
    console.log('⚽ Analyzing sport distribution...');
    
    try {
      const result = await this.session.run(`
        MATCH (n) WHERE n.sport IS NOT NULL AND n.sport <> ''
        RETURN n.sport as sport, count(n) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      
      const sportDistribution = {};
      result.records.forEach(record => {
        sportDistribution[record.get('sport')] = record.get('count');
      });
      
      this.results.sportDistribution = sportDistribution;
      console.log(`✅ Analyzed sports distribution`);
      
    } catch (error) {
      console.error('❌ Error analyzing sports distribution:', error.message);
    }
  }

  async getCountryDistribution() {
    console.log('🌍 Analyzing country distribution...');
    
    try {
      const result = await this.session.run(`
        MATCH (n) WHERE n.country IS NOT NULL AND n.country <> ''
        RETURN n.country as country, count(n) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      
      const countryDistribution = {};
      result.records.forEach(record => {
        countryDistribution[record.get('country')] = record.get('count');
      });
      
      this.results.countryDistribution = countryDistribution;
      console.log(`✅ Analyzed country distribution`);
      
    } catch (error) {
      console.error('❌ Error analyzing country distribution:', error.message);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 NEO4J DATABASE ANALYSIS RESULTS');
    console.log('='.repeat(80));
    
    // Overview
    console.log('\n📈 DATABASE OVERVIEW:');
    console.log(`   Total Nodes: ${this.results.overview.totalNodes || 0}`);
    console.log(`   Total Relationships: ${this.results.overview.totalRelationships || 0}`);
    console.log(`   Entity Labels: ${this.results.overview.labels?.join(', ') || 'None'}`);
    console.log(`   Relationship Types: ${this.results.overview.relationshipTypes?.join(', ') || 'None'}`);
    
    // Entity Counts
    console.log('\n🏷️  ENTITY COUNTS BY TYPE:');
    Object.entries(this.results.entityCounts).forEach(([type, data]) => {
      console.log(`   ${type}: ${data.count} (${data.labels.join(', ')})`);
    });
    
    // Sports Distribution
    if (this.results.sportDistribution) {
      console.log('\n⚽ SPORT DISTRIBUTION:');
      Object.entries(this.results.sportDistribution).forEach(([sport, count]) => {
        console.log(`   ${sport}: ${count} entities`);
      });
    }
    
    // Country Distribution
    if (this.results.countryDistribution) {
      console.log('\n🌍 COUNTRY DISTRIBUTION:');
      Object.entries(this.results.countryDistribution).forEach(([country, count]) => {
        console.log(`   ${country}: ${count} entities`);
      });
    }
    
    // Relationships
    if (this.results.relationships && Object.keys(this.results.relationships).length > 0) {
      console.log('\n🔗 RELATIONSHIP DISTRIBUTION:');
      Object.entries(this.results.relationships).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} relationships`);
      });
    }
    
    // Data Quality
    console.log('\n✅ DATA QUALITY METRICS:');
    console.log(`   Missing Names: ${this.results.dataQuality.missingNames || 0}`);
    console.log(`   Missing Entity Types: ${this.results.dataQuality.noType || 0}`);
    console.log(`   Enriched Entities: ${this.results.dataQuality.enriched || 0}`);
    console.log(`   Has LinkedIn: ${this.results.dataQuality.hasLinkedIn || 0}`);
    console.log(`   Has Website: ${this.results.dataQuality.hasWebsite || 0}`);
    
    // Sample Entities
    if (this.results.samples.length > 0) {
      console.log('\n📋 SAMPLE ENTITIES:');
      this.results.samples.slice(0, 5).forEach((sample, index) => {
        console.log(`\n   ${index + 1}. ${sample.properties.name || 'Unknown'} (${sample.type})`);
        console.log(`      ID: ${sample.id}`);
        console.log(`      Labels: ${sample.labels.join(', ')}`);
        
        if (sample.properties.sport) {
          console.log(`      Sport: ${sample.properties.sport}`);
        }
        if (sample.properties.country) {
          console.log(`      Country: ${sample.properties.country}`);
        }
        if (sample.properties.enriched) {
          console.log(`      Enriched: ${sample.properties.enriched}`);
        }
        if (sample.properties.entity_type) {
          console.log(`      Entity Type: ${sample.properties.entity_type}`);
        }
        
        // Show key properties
        const keyProps = ['website', 'linkedin', 'mobileApp', 'level', 'tier'];
        const presentProps = keyProps.filter(prop => sample.properties[prop] && sample.properties[prop] !== '');
        if (presentProps.length > 0) {
          console.log(`      Properties: ${presentProps.join(', ')}`);
        }
      });
    }
    
    console.log('='.repeat(80));
  }

  async saveReport() {
    const filename = `neo4j-database-analysis-${Date.now()}.json`;
    
    try {
      require('fs').writeFileSync(filename, JSON.stringify(this.results, null, 2));
      console.log(`\n📄 Full analysis report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save analysis report:', error.message);
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
    console.log('🚀 Starting Neo4j Database Analysis...\n');

    try {
      await this.initialize();
      
      await this.getOverview();
      await this.getEntityCountsByType();
      await this.getRelationshipDistribution();
      await this.getDataQualityStats();
      await this.getSportDistribution();
      await this.getCountryDistribution();
      await this.getSampleEntities();
      
      this.printResults();
      const reportFile = await this.saveReport();
      
      if (reportFile) {
        console.log(`\n📄 Detailed analysis report: ${reportFile}`);
      }

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the analysis
async function main() {
  const checker = new Neo4jChecker();
  await checker.run();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Analysis interrupted. Cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Analysis terminated. Cleaning up...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { Neo4jChecker };