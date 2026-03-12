const neo4j = require('neo4j-driver');

// Test connection to the full Neo4j AuraDB with 4,422+ entities
async function testFullNeo4jConnection() {
  console.log('🔧 Testing full Neo4j AuraDB connection...');
  
  try {
    const driver = neo4j.driver(
      'neo4j+s://cce1f84b.databases.neo4j.io',
      neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
    );

    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j AuraDB successfully');

    const session = driver.session();
    
    // Test 1: Count ALL nodes without restrictions
    console.log('\n📊 Test 1: Counting ALL nodes in database...');
    const totalNodesResult = await session.run(`
      MATCH (n)
      RETURN count(n) as totalNodes
    `);
    const totalNodes = totalNodesResult.records[0].get('totalNodes').toNumber();
    console.log(`Total nodes in database: ${totalNodes}`);

    // Test 2: Count nodes with names (no label restrictions)
    console.log('\n📊 Test 2: Counting nodes with names...');
    const namedNodesResult = await session.run(`
      MATCH (n)
      WHERE n.name IS NOT NULL
      RETURN count(n) as namedNodes
    `);
    const namedNodes = namedNodesResult.records[0].get('namedNodes').toNumber();
    console.log(`Nodes with names: ${namedNodes}`);

    // Test 3: Get all node labels
    console.log('\n📊 Test 3: Getting all node labels...');
    const labelsResult = await session.run(`
      CALL db.labels() YIELD label
      RETURN collect(label) as allLabels
    `);
    const allLabels = labelsResult.records[0].get('allLabels');
    console.log('All labels in database:', allLabels);

    // Test 4: Count nodes by label
    console.log('\n📊 Test 4: Counting nodes by label...');
    const labelCountsResult = await session.run(`
      MATCH (n)
      RETURN labels(n) as labels, count(n) as count
      ORDER BY count DESC
    `);
    console.log('Nodes by label:');
    labelCountsResult.records.forEach(record => {
      console.log(`  ${record.get('labels')}: ${record.get('count').toNumber()}`);
    });

    // Test 5: Get sample nodes from each label
    console.log('\n📊 Test 5: Sample nodes from each label...');
    for (const label of allLabels) {
      const sampleResult = await session.run(`
        MATCH (n:${label})
        WHERE n.name IS NOT NULL
        RETURN n.name as name, n
        LIMIT 3
      `);
      console.log(`Sample ${label} nodes:`);
      sampleResult.records.forEach(record => {
        console.log(`  - ${record.get('name')}`);
      });
    }

    // Test 6: Try the current query without label filtering
    console.log('\n📊 Test 6: Testing current query without restrictions...');
    const currentQueryResult = await session.run(`
      MATCH (n)
      WHERE n.name IS NOT NULL
      RETURN n
      ORDER BY n.name
      LIMIT 50
    `);
    console.log(`Current query returns: ${currentQueryResult.records.length} nodes`);

    // Test 7: Check if there are any access restrictions
    console.log('\n📊 Test 7: Checking database access...');
    const dbInfoResult = await session.run(`
      CALL db.info() YIELD name, value
      RETURN name, value
    `);
    console.log('Database info:');
    dbInfoResult.records.forEach(record => {
      console.log(`  ${record.get('name')}: ${record.get('value')}`);
    });

    await session.close();
    await driver.close();
    
    console.log(`\n✅ SUCCESS: Found ${totalNodes} total nodes, ${namedNodes} with names`);
    
  } catch (error) {
    console.error('❌ Neo4j connection test failed:', error);
  }
}

testFullNeo4jConnection();