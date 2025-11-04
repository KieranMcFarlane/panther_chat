#!/usr/bin/env node

// Verify existing data in Neo4j
const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '.env.local' });

async function verifyExistingData() {
  console.log('🔍 Verifying Existing Sports Entities...\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Check if database has any data at all
    console.log('1. Database Content Check:');
    const totalNodes = await session.run('MATCH (n) RETURN count(n) as total');
    const totalCount = totalNodes.records[0].get('total');
    console.log(`   Total nodes in database: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('   ⚠️  Database is empty - need to seed initial data');
      return;
    }
    
    // Get entity statistics
    console.log('2. Entity Statistics:');
    const stats = await session.run(`
      MATCH (n:Entity)
      RETURN n.type as type, count(n) as count
      ORDER BY count DESC
    `);
    
    stats.records.forEach(record => {
      console.log(`   ${record.get('type')}: ${record.get('count')} entities`);
    });
    
    // Get sample entities
    console.log('\n3. Sample Entities:');
    const sampleQuery = `
      MATCH (n:Entity)
      RETURN n.name as name, n.type as type, n.sport as sport
      LIMIT 10
    `;
    
    const samples = await session.run(sampleQuery);
    samples.records.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.get('name')} (${record.get('type')}) - ${record.get('sport') || 'N/A'}`);
    });
    
    // Get relationship statistics
    console.log('\n4. Relationship Statistics:');
    const relStats = await session.run(`
      MATCH ()-[r]->()
      RETURN type(r) as relationship, count(r) as count
      ORDER BY count DESC
      LIMIT 10
    `);
    
    relStats.records.forEach(record => {
      console.log(`   ${record.get('relationship')}: ${record.get('count')} relationships`);
    });
    
    // Check for enrichment data
    console.log('\n5. Enrichment Status:');
    const enriched = await session.run(`
      MATCH (n:Entity)
      WHERE n.opportunity_score IS NOT NULL OR n.digital_maturity IS NOT NULL
      RETURN 
        count(CASE WHEN n.opportunity_score IS NOT NULL THEN 1 END) as with_opportunity_score,
        count(CASE WHEN n.digital_maturity IS NOT NULL THEN 1 END) as with_digital_maturity,
        count(CASE WHEN n.last_enriched IS NOT NULL THEN 1 END) as enriched_count
    `);
    
    const enrichmentData = enriched.records[0];
    console.log(`   With opportunity scores: ${enrichmentData.get('with_opportunity_score')}`);
    console.log(`   With digital maturity: ${enrichmentData.get('with_digital_maturity')}`);
    console.log(`   Enriched entities: ${enrichmentData.get('enriched_count')}`);
    
    console.log('\n✅ Data verification complete!');
    
  } catch (error) {
    console.error('❌ Error verifying data:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

verifyExistingData().catch(console.error);