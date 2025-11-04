/**
 * Missing Entity Analysis Script using MCP
 * 
 * This script uses direct MCP connections to compare Supabase cached_entities with Neo4j
 * to identify which entities are missing from the Neo4j database and need migration.
 */

class MissingEntityAnalyzerMCP {
  constructor() {
    this.results = {
      supabaseTotal: 0,
      neo4jTotal: 0,
      missingEntities: [],
      foundEntities: [],
      supabaseSample: [],
      neo4jSample: [],
      analysis: {
        missingCount: 0,
        foundCount: 0,
        missingPercentage: 0,
        potentialIssues: [],
        missingByType: {},
        namePatterns: {}
      }
    };
  }

  async getSupabaseEntities() {
    console.log('📊 Getting entities from Supabase cached_entities...');
    
    try {
      // Use MCP to get total count
      const countResponse = await fetch('http://localhost:3000/api/supabase-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'SELECT COUNT(*) as count FROM cached_entities'
        })
      });
      
      const countResult = await countResponse.json();
      this.results.supabaseTotal = countResult.data[0]?.count || 0;
      console.log(`✅ Found ${this.results.supabaseTotal} entities in Supabase`);
      
      // Get all entities for comparison (in batches)
      const batchSize = 500;
      let allEntities = [];
      let offset = 0;
      
      while (offset < this.results.supabaseTotal) {
        const entitiesResponse = await fetch('http://localhost:3000/api/supabase-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `SELECT id, neo4j_id, labels, properties FROM cached_entities ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`
          })
        });
        
        const entitiesResult = await entitiesResponse.json();
        allEntities = allEntities.concat(entitiesResult.data || []);
        offset += batchSize;
        
        console.log(`Fetched ${allEntities.length}/${this.results.supabaseTotal} entities from Supabase...`);
      }
      
      // Take sample for analysis
      this.results.supabaseSample = allEntities.slice(0, 10);
      
      console.log(`✅ Retrieved all ${allEntities.length} entities from Supabase`);
      return allEntities;
    } catch (error) {
      console.error('❌ Error getting Supabase entities:', error.message);
      throw error;
    }
  }

  async getNeo4jEntities() {
    console.log('📊 Getting entities from Neo4j...');
    
    try {
      // Use MCP to query Neo4j
      const response = await fetch('http://localhost:3000/api/neo4j-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'MATCH (n) RETURN count(n) as totalNodes'
        })
      });
      
      const result = await response.json();
      this.results.neo4jTotal = result.data[0]?.totalNodes || 0;
      console.log(`✅ Found ${this.results.neo4jTotal} nodes in Neo4j`);
      
      // Get sample entities for comparison
      const sampleResponse = await fetch('http://localhost:3000/api/neo4j-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            MATCH (n) 
            RETURN n.id as id, n.name as name, labels(n) as labels
            ORDER BY n.id DESC
            LIMIT 10
          `
        })
      });
      
      const sampleResult = await sampleResponse.json();
      this.results.neo4jSample = sampleResult.data || [];
      
      return this.results.neo4jTotal;
    } catch (error) {
      console.error('❌ Error getting Neo4j entities:', error.message);
      throw error;
    }
  }

  async checkMissingEntities(supabaseEntities) {
    console.log('🔍 Checking for missing entities in Neo4j...');
    
    const batchSize = 50;
    const missingEntities = [];
    const foundEntities = [];
    
    for (let i = 0; i < supabaseEntities.length; i += batchSize) {
      const batch = supabaseEntities.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(supabaseEntities.length/batchSize)} (${batch.length} entities)...`);
      
      for (const entity of batch) {
        try {
          // Check if entity exists in Neo4j by ID
          const neo4jId = entity.neo4j_id || entity.id.toString();
          
          const response = await fetch('http://localhost:3000/api/neo4j-query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                MATCH (n) WHERE n.id = $id OR toString(n.id) = $id
                RETURN n.id as foundId, n.name as name, labels(n) as labels
                LIMIT 1
              `,
              params: { id: neo4jId }
            })
          });
          
          const result = await response.json();
          
          if (!result.data || result.data.length === 0) {
            // Entity missing from Neo4j
            missingEntities.push({
              supabaseId: entity.id,
              neo4jId: entity.neo4j_id,
              name: entity.properties?.name || 'Unknown',
              labels: entity.labels,
              properties: entity.properties,
              missingReason: 'not_found_in_neo4j'
            });
          } else {
            // Entity found in Neo4j
            const foundRecord = result.data[0];
            foundEntities.push({
              supabaseId: entity.id,
              neo4jId: entity.neo4j_id,
              foundId: foundRecord.foundId,
              name: foundRecord.name,
              supabaseName: entity.properties?.name || 'Unknown',
              labels: foundRecord.labels,
              status: 'found'
            });
          }
        } catch (error) {
          console.warn(`⚠️  Error checking entity ${entity.id}:`, error.message);
          missingEntities.push({
            supabaseId: entity.id,
            neo4jId: entity.neo4j_id,
            name: entity.properties?.name || 'Unknown',
            error: error.message,
            missingReason: 'check_error'
          });
        }
      }
      
      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.results.missingEntities = missingEntities;
    this.results.foundEntities = foundEntities;
    this.results.analysis.missingCount = missingEntities.length;
    this.results.analysis.foundCount = foundEntities.length;
    this.results.analysis.missingPercentage = ((missingEntities.length / supabaseEntities.length) * 100).toFixed(2);
    
    console.log(`✅ Analysis complete: ${missingEntities.length} missing, ${foundEntities.length} found`);
  }

  analyzeMissingPatterns() {
    console.log('📈 Analyzing missing entity patterns...');
    
    const missing = this.results.missingEntities;
    const analysis = this.results.analysis;
    
    // Analyze missing entities by type
    const missingByType = {};
    missing.forEach(entity => {
      const primaryLabel = entity.labels?.[0] || 'Unknown';
      missingByType[primaryLabel] = (missingByType[primaryLabel] || 0) + 1;
    });
    
    // Analyze missing entities by name patterns
    const patterns = {
      'Club-like names': 0,
      'Person-like names': 0,
      'Generic/Placeholder': 0,
      'Numeric IDs': 0,
      'Unknown entities': 0
    };
    
    missing.forEach(entity => {
      const name = entity.name || '';
      
      if (name === 'Unknown Entity') {
        patterns['Unknown entities']++;
      } else if (/Club|Team|FC|United|City|Rangers|Athletic|Sporting/i.test(name)) {
        patterns['Club-like names']++;
      } else if (/\\s+\\d+$|^\\d+$|Club \\d+|Team \\d+/i.test(name)) {
        patterns['Numeric IDs']++;
      } else if (/Unknown|Entity|Organization|Person|Club|Team/i.test(name) && name.length < 15) {
        patterns['Generic/Placeholder']++;
      } else if (name.length > 3 && /[A-Z][a-z]+ [A-Z][a-z]+/.test(name)) {
        patterns['Person-like names']++;
      }
    });
    
    // Identify potential issues
    const potentialIssues = [];
    
    if (analysis.missingPercentage > 40) {
      potentialIssues.push({
        severity: 'high',
        issue: `Very high percentage of missing entities (${analysis.missingPercentage}%)`,
        recommendation: 'May indicate migration process issue or data sync problem'
      });
    }
    
    if (patterns['Numeric IDs'] > 100) {
      potentialIssues.push({
        severity: 'medium',
        issue: `Many entities with numeric IDs (${patterns['Numeric IDs']})`,
        recommendation: 'May indicate placeholder or test data that needs cleaning'
      });
    }
    
    if (patterns['Generic/Placeholder'] > 50) {
      potentialIssues.push({
        severity: 'low',
        issue: `Generic placeholder names (${patterns['Generic/Placeholder']})`,
        recommendation: 'Consider enriching or cleaning up generic entity names'
      });
    }
    
    if (patterns['Unknown entities'] > 200) {
      potentialIssues.push({
        severity: 'high',
        issue: `Many "Unknown Entity" entries (${patterns['Unknown entities']})`,
        recommendation: 'Data quality issue - requires investigation'
      });
    }
    
    analysis.missingByType = missingByType;
    analysis.namePatterns = patterns;
    analysis.potentialIssues = potentialIssues;
    
    console.log('✅ Pattern analysis completed');
  }

  printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 MISSING ENTITY ANALYSIS RESULTS');
    console.log('='.repeat(80));
    
    console.log('\n📊 SUMMARY:');
    console.log(`   Supabase cached_entities: ${this.results.supabaseTotal}`);
    console.log(`   Neo4j nodes: ${this.results.neo4jTotal}`);
    console.log(`   Missing from Neo4j: ${this.results.analysis.missingCount}`);
    console.log(`   Found in Neo4j: ${this.results.analysis.foundCount}`);
    console.log(`   Missing percentage: ${this.results.analysis.missingPercentage}%`);
    
    console.log('\n🏷️  MISSING ENTITIES BY TYPE:');
    Object.entries(this.results.analysis.missingByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} entities`);
    });
    
    console.log('\n📝 NAME PATTERNS IN MISSING ENTITIES:');
    Object.entries(this.results.analysis.namePatterns).forEach(([pattern, count]) => {
      console.log(`   ${pattern}: ${count} entities`);
    });
    
    if (this.results.analysis.potentialIssues.length > 0) {
      console.log('\n⚠️  POTENTIAL ISSUES:');
      this.results.analysis.potentialIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.issue}`);
        console.log(`      Recommendation: ${issue.recommendation}`);
      });
    }
    
    console.log('\n📋 SAMPLE MISSING ENTITIES:');
    this.results.missingEntities.slice(0, 10).forEach((entity, index) => {
      console.log(`   ${index + 1}. ${entity.name} (ID: ${entity.supabaseId}, Neo4j ID: ${entity.neo4jId})`);
      console.log(`      Labels: ${(entity.labels || []).join(', ')}`);
      console.log(`      Reason: ${entity.missingReason}`);
    });
    
    if (this.results.missingEntities.length > 10) {
      console.log(`   ... and ${this.results.missingEntities.length - 10} more missing entities`);
    }
    
    console.log('\n📋 SAMPLE FOUND ENTITIES:');
    this.results.foundEntities.slice(0, 5).forEach((entity, index) => {
      console.log(`   ${index + 1}. ${entity.name} (Supabase ID: ${entity.supabaseId}, Neo4j ID: ${entity.foundId})`);
    });
    
    console.log('\n📋 SUPABASE SAMPLE:');
    this.results.supabaseSample.slice(0, 5).forEach((entity, index) => {
      console.log(`   ${index + 1}. ${entity.properties?.name || 'Unknown'} (ID: ${entity.id}, Neo4j ID: ${entity.neo4j_id})`);
      console.log(`      Labels: ${(entity.labels || []).join(', ')}`);
    });
    
    console.log('\n📋 NEO4J SAMPLE:');
    this.results.neo4jSample.slice(0, 5).forEach((entity, index) => {
      console.log(`   ${index + 1}. ${entity.name} (ID: ${entity.id})`);
      console.log(`      Labels: ${entity.labels.join(', ')}`);
    });
    
    console.log('='.repeat(80));
  }

  async saveReport() {
    const filename = `missing-entity-analysis-${Date.now()}.json`;
    
    try {
      require('fs').writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        results: this.results
      }, null, 2));
      
      console.log(`\n📄 Detailed analysis report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Failed to save analysis report:', error.message);
      return null;
    }
  }

  async run() {
    console.log('🚀 Starting Missing Entity Analysis (using MCP)...\n');

    try {
      // Get data from both sources
      const supabaseEntities = await this.getSupabaseEntities();
      await this.getNeo4jEntities();
      
      // Check for missing entities
      await this.checkMissingEntities(supabaseEntities);
      
      // Analyze patterns
      this.analyzeMissingPatterns();
      
      // Print results
      this.printResults();
      
      // Save report
      const reportFile = await this.saveReport();
      
      if (reportFile) {
        console.log(`\n📄 Detailed analysis report: ${reportFile}`);
      }

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      console.error(error.stack);
    }
  }
}

// Run the analysis
async function main() {
  const analyzer = new MissingEntityAnalyzerMCP();
  await analyzer.run();
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

module.exports = { MissingEntityAnalyzerMCP };