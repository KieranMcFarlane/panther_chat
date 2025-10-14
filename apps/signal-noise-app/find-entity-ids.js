const neo4j = require('neo4j-driver');

require('dotenv').config();

async function findEntityIds() {
  console.log('🔍 FINDING ENTITY IDs\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // 1. Search by name
    console.log('📝 SEARCH BY NAME:');
    console.log('Usage: node find-entity-ids.js [search-term]');
    console.log('Example: node find-entity-ids.js arsenal');
    console.log('');
    
    // 2. Get all entities with IDs
    console.log('🏷️ ALL ENTITIES WITH IDS:');
    const allEntitiesQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NOT NULL AND n.name IS NOT NULL
      RETURN n.neo4j_id as id, n.name as name, labels(n)[0] as type, n.sport as sport
      ORDER BY n.name
      LIMIT 20
    `;
    
    const allResult = await session.run(allEntitiesQuery);
    allResult.records.forEach(record => {
      const id = record.get('id');
      const name = record.get('name');
      const type = record.get('type');
      const sport = record.get('sport') || '';
      console.log(`  • ID: ${id} - ${name} (${type}) ${sport ? '- ' + sport : ''}`);
    });
    
    // 3. Search for specific terms if provided
    const searchTerm = process.argv[2];
    if (searchTerm) {
      console.log(`\n🔍 SEARCH RESULTS FOR "${searchTerm}":`);
      const searchQuery = `
        MATCH (n) 
        WHERE toLower(n.name) CONTAINS toLower($searchTerm) AND n.neo4j_id IS NOT NULL
        RETURN n.neo4j_id as id, n.name as name, labels(n)[0] as type, n.sport as sport
        ORDER BY n.name
        LIMIT 10
      `;
      
      const searchResult = await session.run(searchQuery, { searchTerm });
      if (searchResult.records.length > 0) {
        searchResult.records.forEach(record => {
          const id = record.get('id');
          const name = record.get('name');
          const type = record.get('type');
          const sport = record.get('sport') || '';
          console.log(`  • ID: ${id} - ${name} (${type}) ${sport ? '- ' + sport : ''}`);
          console.log(`    URL: http://localhost:3005/entity/${id}`);
        });
      } else {
        console.log(`  • No results found for "${searchTerm}"`);
      }
    }
    
    // 4. High-value entities
    console.log('\n💎 HIGH-VALUE ENTITIES:');
    const highValueQuery = `
      MATCH (n) 
      WHERE (n.priorityScore >= 70 OR n.opportunity_score >= 70) AND n.neo4j_id IS NOT NULL
      RETURN n.neo4j_id as id, n.name as name, COALESCE(n.priorityScore, n.opportunity_score) as score, labels(n)[0] as type
      ORDER BY score DESC
      LIMIT 10
    `;
    
    const highValueResult = await session.run(highValueQuery);
    if (highValueResult.records.length > 0) {
      highValueResult.records.forEach(record => {
        const id = record.get('id');
        const name = record.get('name');
        const score = record.get('score');
        const type = record.get('type');
        console.log(`  • ID: ${id} - ${name} (Score: ${score}) - ${type}`);
      });
    } else {
      console.log('  • No high-value entities found (score >= 70)');
    }
    
    // 5. Football clubs specifically
    console.log('\n⚽ FOOTBALL CLUBS:');
    const footballQuery = `
      MATCH (n) 
      WHERE n.sport = 'Football' AND n.neo4j_id IS NOT NULL AND n.name IS NOT NULL
      RETURN n.neo4j_id as id, n.name as name, n.country as country
      ORDER BY n.name
      LIMIT 15
    `;
    
    const footballResult = await session.run(footballQuery);
    footballResult.records.forEach(record => {
      const id = record.get('id');
      const name = record.get('name');
      const country = record.get('country') || '';
      console.log(`  • ID: ${id} - ${name} ${country ? '(' + country + ')' : ''}`);
    });
    
    console.log('\n📋 QUICK REFERENCE:');
    console.log('• Sunderland: ID 148 - http://localhost:3005/entity/148');
    console.log('• Arsenal: ID 126 - http://localhost:3005/entity/126');
    console.log('• Manchester United: ID 139 - http://localhost:3005/entity/139');
    console.log('• São Paulo FC: ID 115 - http://localhost:3005/entity/115');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Show usage if no arguments
if (process.argv.length === 2) {
  console.log('Usage: node find-entity-ids.js [search-term]');
  console.log('Example: node find-entity-ids.js arsenal');
  console.log('       node find-entity-ids.js "manchester united"');
  console.log('');
}

findEntityIds();