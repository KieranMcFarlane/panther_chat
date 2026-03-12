#!/usr/bin/env node

/**
 * Simple Neo4j Test Script
 * Tests the connection to your Neo4j database
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Import the Neo4j service (simulate import)
function createNeo4jService() {
  const neo4j = require('neo4j-driver');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD
    )
  );
  
  return driver;
}

async function testNeo4jConnection() {
  console.log('🔍 Testing Neo4j connection...');
  console.log(`📍 URI: ${process.env.NEO4J_URI}`);
  console.log(`👤 User: ${process.env.NEO4J_USERNAME || process.env.NEO4J_USER}`);
  
  try {
    const driver = createNeo4jService();
    const session = driver.session();
    
    // Test basic connectivity
    const result = await session.run('RETURN 1 as test');
    console.log('✅ Neo4j connection successful!');
    
    // Test entity query - check what exists
    const entityResult = await session.run(`
      MATCH (n)
      RETURN count(n) as total_nodes,
             collect(DISTINCT labels(n)[0])[..10] as node_types
    `);
    
    const record = entityResult.records[0];
    const totalEntities = record.get('total_nodes').toNumber();
    const types = record.get('node_types');
    
    console.log(`📊 Found ${totalEntities} total nodes`);
    console.log(`🏷️  Types: ${types.join(', ')}`);
    
    // Get some sample nodes
    const sampleResult = await session.run(`
      MATCH (n)
      RETURN labels(n)[0] as label, n.name as name, n.type as type
      LIMIT 5
    `);
    
    console.log('\n📋 Sample nodes:');
    sampleResult.records.forEach((record, index) => {
      console.log(`${index + 1}. ${record.get('name') || 'No name'} (${record.get('label') || record.get('type') || 'No label'})`);
    });
    
    await session.close();
    await driver.close();
    
    return true;
  } catch (error) {
    console.error('❌ Neo4j connection failed:', error.message);
    return false;
  }
}

async function main() {
  const success = await testNeo4jConnection();
  
  if (success) {
    console.log('\n🎉 Neo4j is ready for Smart Sync!');
  } else {
    console.log('\n❌ Using fallback entities for demo');
  }
  
  process.exit(success ? 0 : 1);
}

main().catch(console.error);