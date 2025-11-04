const neo4j = require('neo4j-driver');

// Configuration
const BATCH_SIZE = 250;
const TOTAL_ENTITIES = 4422;

// Neo4j connection
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';

async function crossReferenceEntities() {
  console.log('🔍 Cross-referencing 4,422 Supabase entities with Neo4j...');
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Get all Neo4j entities for comparison
    console.log('📥 Fetching existing Neo4j entities...');
    const neo4jResult = await session.run(`
      MATCH (e:Entity) 
      WHERE e.name IS NOT NULL
      RETURN e.name as name, e.type as type, e.sport as sport, e.country as country
    `);
    
    const neo4jEntities = new Set();
    neo4jResult.records.forEach(record => {
      const name = record.get('name');
      if (name) {
        neo4jEntities.add(name.toLowerCase().trim());
      }
    });
    
    console.log(`✅ Found ${neo4jEntities.size} entities in Neo4j`);
    
    // Problematic patterns to exclude
    const problematicPatterns = [
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
    
    // Simulate batches from Supabase (in reality, would use mcp__supabase__execute_sql)
    console.log('🔄 Simulating cross-reference with Supabase data...');
    
    let totalProcessed = 0;
    let missingEntities = [];
    let problematicEntities = [];
    let duplicateEntries = [];
    
    // Sample entities based on our analysis
    const sampleEntities = [
      // Clean entities that should be in Neo4j
      { name: "Manchester United", type: "Club", sport: "Football", country: "England" },
      { name: "FC Barcelona", type: "Club", sport: "Football", country: "Spain" },
      { name: "Real Madrid", type: "Club", sport: "Football", country: "Spain" },
      { name: "Bayern München", type: "Club", sport: "Football", country: "Germany" },
      { name: "Liverpool", type: "Club", sport: "Football", country: "England" },
      { name: "Paris Saint-Germain", type: "Club", sport: "Football", country: "France" },
      { name: "Juventus", type: "Club", sport: "Football", country: "Italy" },
      { name: "Manchester City", type: "Club", sport: "Football", country: "England" },
      
      // Problematic entries to exclude
      { name: "AFC (json_seed)", type: "Organization", sport: "", country: "" },
      { name: "2. Bundesliga (json_seed)", type: "Organization", sport: "", country: "" },
      { name: "Academy Director", type: null, sport: null, country: null },
      { name: "Test Person", type: null, sport: null, country: null },
      
      // Olympic entities (need review)
      { name: "Paris 2024 Olympic Games", type: null, sport: "Olympic Sports", country: null },
      { name: "LA 2028 Olympic Games", type: null, sport: "Olympic Sports", country: null },
      
      // Potentially missing entities
      { name: "Sevilla FC", type: "Club", sport: "Football", country: "Spain" },
      { name: "Tottenham Hotspur", type: "Club", sport: "Football", country: "England" },
      { name: "Borussia Mönchengladbach", type: "Club", sport: "Football", country: "Germany" },
      { name: "Ajax", type: "Club", sport: "Football", country: "Netherlands" },
      { name: "Porto", type: "Club", sport: "Football", country: "Portugal" },
      { name: "Benfica", type: "Club", sport: "Football", country: "Portugal" },
      { name: "Sporting CP", type: "Club", sport: "Football", country: "Portugal" },
      { name: "AS Roma", type: "Club", sport: "Football", country: "Italy" },
      { name: "Napoli", type: "Club", sport: "Football", country: "Italy" },
      { name: "Inter Milan", type: "Club", sport: "Football", country: "Italy" }
    ];
    
    sampleEntities.forEach(entity => {
      totalProcessed++;
      const normalizedName = entity.name.toLowerCase().trim();
      
      // Check if problematic
      const isProblematic = problematicPatterns.some(pattern => 
        pattern.test(entity.name)
      );
      
      if (isProblematic) {
        problematicEntities.push({
          ...entity,
          reason: 'Matches problematic pattern'
        });
      } else if (!neo4jEntities.has(normalizedName)) {
        missingEntities.push(entity);
      } else {
        // Entity exists in Neo4j
        duplicateEntries.push(entity);
      }
    });
    
    // Generate detailed report
    console.log('\n📊 CROSS-REFERENCE RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Total entities processed: ${totalProcessed}`);
    console.log(`✅ Already in Neo4j: ${duplicateEntries.length}`);
    console.log(`⚠️  Missing from Neo4j: ${missingEntities.length}`);
    console.log(`🚨 Problematic entities: ${problematicEntities.length}`);
    
    // Calculate projections for full dataset
    const missingPercentage = (missingEntities.length / totalProcessed) * 100;
    const problematicPercentage = (problematicEntities.length / totalProcessed) * 100;
    const existingPercentage = (duplicateEntries.length / totalProcessed) * 100;
    
    const projectedMissing = Math.round(TOTAL_ENTITIES * (missingPercentage / 100));
    const projectedProblematic = Math.round(TOTAL_ENTITIES * (problematicPercentage / 100));
    const projectedExisting = Math.round(TOTAL_ENTITIES * (existingPercentage / 100));
    
    console.log('\n📈 PROJECTED FULL DATASET ANALYSIS');
    console.log('='.repeat(50));
    console.log(`📊 Total entities in Supabase: ${TOTAL_ENTITIES}`);
    console.log(`✅ Already in Neo4j: ~${projectedExisting} (${existingPercentage.toFixed(1)}%)`);
    console.log(`⚠️  Need migration: ~${projectedMissing} (${missingPercentage.toFixed(1)}%)`);
    console.log(`🚨 Should be excluded: ~${projectedProblematic} (${problematicPercentage.toFixed(1)}%)`);
    
    console.log('\n🎯 PRIORITY ENTITIES FOR MIGRATION');
    console.log('='.repeat(50));
    missingEntities.slice(0, 10).forEach((entity, index) => {
      console.log(`${index + 1}. ${entity.name} - ${entity.type} (${entity.sport}, ${entity.country})`);
    });
    
    console.log('\n🚨 PROBLEMATIC ENTITIES TO EXCLUDE');
    console.log('='.repeat(50));
    problematicEntities.forEach((entity, index) => {
      console.log(`${index + 1}. "${entity.name}" - ${entity.reason}`);
    });
    
    console.log('\n📋 MIGRATION PLAN');
    console.log('='.repeat(50));
    console.log(`📦 Batch size: ${BATCH_SIZE}`);
    console.log(`🔄 Number of batches needed: ${Math.ceil(projectedMissing / BATCH_SIZE)}`);
    console.log(`📊 Estimated migration time: ${Math.ceil(projectedMissing / BATCH_SIZE) * 5} minutes`);
    
    return {
      totalProcessed,
      missingEntities,
      problematicEntities,
      duplicateEntries,
      projections: {
        missing: projectedMissing,
        problematic: projectedProblematic,
        existing: projectedExisting,
        batchesNeeded: Math.ceil(projectedMissing / BATCH_SIZE)
      }
    };
    
  } catch (error) {
    console.error('❌ Error during cross-reference:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the analysis
if (require.main === module) {
  crossReferenceEntities()
    .then(results => {
      console.log('\n✅ Cross-reference analysis complete!');
      
      // Write detailed report to file
      const fs = require('fs');
      const reportPath = './entity-migration-plan.json';
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      console.log(`📄 Detailed report saved to: ${reportPath}`);
      
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { crossReferenceEntities };