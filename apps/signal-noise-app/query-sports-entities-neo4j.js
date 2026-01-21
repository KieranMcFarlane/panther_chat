const neo4j = require('neo4j-driver');

async function querySportsEntities() {
  console.log('🔗 Connecting to Neo4j...');
  
  // Create driver using the same credentials as the application
  const driver = neo4j.driver(
    'neo4j+s://cce1f84b.databases.neo4j.io',
    neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
  );

  try {
    // Verify connectivity
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j successfully');

    // Create session
    const session = driver.session();

    try {
      // Execute the query
      console.log('📊 Querying for 50 sports entities starting from offset 1350...');
      
      const result = await session.run(`
        MATCH (e:Entity)
        WHERE e.type IN ['Club','League','Federation','Tournament']
        RETURN e.name, e.sport, e.country
        SKIP 1350 LIMIT 50
      `);

      console.log(`✅ Found ${result.records.length} entities:`);
      console.log('');

      // Display results
      result.records.forEach((record, index) => {
        const name = record.get('e.name') || 'N/A';
        const sport = record.get('e.sport') || 'N/A';
        const country = record.get('e.country') || 'N/A';
        
        console.log(`${index + 1350 + 1}. ${name} | ${sport} | ${country}`);
      });

      // Also return as structured data for programmatic use
      const entities = result.records.map((record, index) => ({
        index: index + 1350 + 1,
        name: record.get('e.name') || null,
        sport: record.get('e.sport') || null,
        country: record.get('e.country') || null
      }));

      console.log('');
      console.log('📄 Structured data for RFP processing:');
      console.log(JSON.stringify(entities, null, 2));

      return entities;

    } catch (error) {
      console.error('❌ Query failed:', error);
      throw error;
    } finally {
      await session.close();
    }

  } catch (error) {
    console.error('❌ Connection failed:', error);
    throw error;
  } finally {
    await driver.close();
    console.log('🔌 Neo4j connection closed');
  }
}

// Run the query
querySportsEntities()
  .then(entities => {
    console.log(`\n✅ Successfully retrieved ${entities.length} entities for RFP detection processing`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to query entities:', error);
    process.exit(1);
  });