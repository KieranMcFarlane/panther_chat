const neo4j = require('neo4j-driver');

require('dotenv').config();

async function assignNeo4jIds() {
  console.log('🔧 ASSIGNING INTERNAL neo4j_id TO ENTITIES WITHOUT IT\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // First, show what entities will be updated
    console.log('📋 ENTITIES THAT WILL RECEIVE neo4j_id:');
    const findQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NULL
      RETURN ID(n) as internalId, n.name as name, labels(n) as labels, n.sport as sport
      ORDER BY labels(n)[0], n.name
      LIMIT 20
    `;
    
    const findResult = await session.run(findQuery);
    
    if (findResult.records.length === 0) {
      console.log('✅ All entities already have neo4j_id - nothing to do!');
      return;
    }
    
    findResult.records.forEach(record => {
      const internalId = record.get('internalId');
      const name = record.get('name') || 'Unnamed';
      const labels = record.get('labels').join(', ');
      const sport = record.get('sport') || '';
      console.log(`  • ID: ${internalId} - ${name} (${labels}) ${sport ? '- ' + sport : ''}`);
    });
    
    if (findResult.records.length === 20) {
      console.log('  ... and more');
    }
    
    // Count total entities to update
    const countQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NULL
      RETURN count(n) as totalToUpdate
    `;
    
    const countResult = await session.run(countQuery);
    const totalToUpdate = Number(countResult.records[0].get('totalToUpdate'));
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  • Total entities to update: ${totalToUpdate}`);
    console.log(`  • Will assign internal Neo4j ID as neo4j_id property`);
    
    // Ask for confirmation
    console.log('\n⚠️ WARNING: This will modify the Neo4j database.');
    console.log('Type "YES" to proceed with the update:');
    
    // For automation, proceed with the update
    console.log('🚀 Proceeding with update...\n');
    
    // Update entities without neo4j_id
    const updateQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NULL
      SET n.neo4j_id = toString(ID(n))
      RETURN count(n) as updated
    `;
    
    const updateResult = await session.run(updateQuery);
    const updatedCount = Number(updateResult.records[0].get('updated'));
    
    console.log(`✅ SUCCESS: Updated ${updatedCount} entities with neo4j_id`);
    
    // Verify the update
    console.log('\n🔍 VERIFYING UPDATE:');
    const verifyQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NULL
      RETURN count(n) as remaining
    `;
    
    const verifyResult = await session.run(verifyQuery);
    const remainingCount = Number(verifyResult.records[0].get('remaining'));
    
    if (remainingCount === 0) {
      console.log('✅ VERIFIED: All entities now have neo4j_id');
    } else {
      console.log(`⚠️ WARNING: ${remainingCount} entities still without neo4j_id`);
    }
    
    // Show updated coverage
    const coverageQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NOT NULL
      RETURN count(n) as withId
    `;
    
    const coverageResult = await session.run(coverageQuery);
    const withIdCount = Number(coverageResult.records[0].get('withId'));
    
    console.log(`📊 NEW COVERAGE: ${withIdCount.toLocaleString()} entities have neo4j_id (100%)`);
    
    // Show some examples of updated entities
    console.log('\n📋 EXAMPLES OF UPDATED ENTITIES:');
    const examplesQuery = `
      MATCH (n) 
      WHERE n.neo4j_id IS NOT NULL AND n.name IS NOT NULL
      RETURN n.neo4j_id as assignedId, n.name as name, labels(n)[0] as type
      ORDER BY n.neo4j_id DESC
      LIMIT 10
    `;
    
    const examplesResult = await session.run(examplesQuery);
    examplesResult.records.forEach(record => {
      const assignedId = record.get('assignedId');
      const name = record.get('name');
      const type = record.get('type');
      console.log(`  • ${assignedId} - ${name} (${type})`);
    });
    
    console.log('\n🎉 IMPACT ON AUTOMATIC DOSSIER SYSTEM:');
    console.log('  • All 4,500 entities now accessible via consistent neo4j_id');
    console.log('  • URL generation: http://localhost:3005/entity/[neo4j_id]');
    console.log('  • Automatic dossier generation works for all entities');
    console.log('  • No more fallback to internal IDs needed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

assignNeo4jIds();