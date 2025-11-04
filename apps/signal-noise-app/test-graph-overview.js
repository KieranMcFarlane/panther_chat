#!/usr/bin/env node

/**
 * Graph Overview Script for Neo4j
 * Provides a complete overview of the knowledge graph structure
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
      process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
    )
  );

  return driver;
}

async function getGraphOverview() {
  console.log('🗺️  Getting complete Neo4j graph overview...');

  try {
    const driver = createNeo4jService();
    const session = driver.session();

    // 1. Basic graph statistics
    console.log('\n1️⃣ Basic graph statistics...');
    const basicStatsResult = await session.run(`
      MATCH (n)
      RETURN count(n) as total_nodes,
             count(DISTINCT labels(n)[0]) as unique_labels
    `);

    const basicStats = basicStatsResult.records[0];
    const totalNodes = basicStats.get('total_nodes').toNumber();
    const uniqueLabels = basicStats.get('unique_labels').toNumber();

    console.log(`📊 Total nodes: ${totalNodes}`);
    console.log(`🏷️  Unique labels: ${uniqueLabels}`);

    // 2. Detailed label analysis
    console.log('\n2️⃣ Detailed label analysis...');
    const labelAnalysisResult = await session.run(`
      MATCH (n)
      WITH labels(n)[0] as primary_label, count(n) as count
      RETURN primary_label, count
      ORDER BY count DESC
    `);

    console.log('📋 Node types and counts:');
    labelAnalysisResult.records.forEach((record) => {
      const label = record.get('primary_label');
      const count = record.get('count').toNumber();
      console.log(`   ${label}: ${count}`);
    });

    // 3. Relationship analysis
    console.log('\n3️⃣ Relationship analysis...');
    const relAnalysisResult = await session.run(`
      MATCH ()-[r]->()
      RETURN type(r) as relationship_type, count(r) as count
      ORDER BY count DESC
    `);

    console.log('🔗 Relationship types and counts:');
    relAnalysisResult.records.forEach((record) => {
      const relType = record.get('relationship_type');
      const count = record.get('count').toNumber();
      console.log(`   ${relType}: ${count}`);
    });

    // 4. Property analysis
    console.log('\n4️⃣ Property analysis...');
    const propAnalysisResult = await session.run(`
      MATCH (n)
      WITH keys(n) as props
      UNWIND props as prop
      RETURN prop, count(*) as count
      ORDER BY count DESC
      LIMIT 15
    `);

    console.log('🏷️  Most common properties:');
    propAnalysisResult.records.forEach((record) => {
      const prop = record.get('prop');
      const count = record.get('count').toNumber();
      console.log(`   ${prop}: ${count}`);
    });

    // 5. Sports analysis
    console.log('\n5️⃣ Sports analysis...');
    const sportsAnalysisResult = await session.run(`
      MATCH (n)
      WHERE n.sport IS NOT NULL
      RETURN n.sport as sport, count(n) as count
      ORDER BY count DESC
    `);

    console.log('⚽ Sports in the graph:');
    sportsAnalysisResult.records.forEach((record) => {
      const sport = record.get('sport');
      const count = record.get('count').toNumber();
      console.log(`   ${sport}: ${count}`);
    });

    // 6. Country analysis
    console.log('\n6️⃣ Country analysis...');
    const countryAnalysisResult = await session.run(`
      MATCH (n)
      WHERE n.country IS NOT NULL
      RETURN n.country as country, count(n) as count
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('🌍 Countries in the graph:');
    countryAnalysisResult.records.forEach((record) => {
      const country = record.get('country');
      const count = record.get('count').toNumber();
      console.log(`   ${country}: ${count}`);
    });

    // 7. Entity types analysis
    console.log('\n7️⃣ Entity types analysis...');
    const entityTypesResult = await session.run(`
      MATCH (n)
      WHERE n.type IS NOT NULL
      RETURN n.type as type, count(n) as count
      ORDER BY count DESC
    `);

    console.log('🏷️  Entity types in the graph:');
    entityTypesResult.records.forEach((record) => {
      const type = record.get('type');
      const count = record.get('count').toNumber();
      console.log(`   ${type}: ${count}`);
    });

    // 8. Recent entities
    console.log('\n8️⃣ Recently created entities...');
    const recentEntitiesResult = await session.run(`
      MATCH (n)
      WHERE n.created_at IS NOT NULL
      RETURN n.name as name, labels(n)[0] as label, n.created_at as created_at
      ORDER BY n.created_at DESC
      LIMIT 10
    `);

    console.log('🕐 Recent entities:');
    recentEntitiesResult.records.forEach((record) => {
      const name = record.get('name');
      const label = record.get('label');
      const createdAt = record.get('created_at');
      console.log(`   ${name} (${label}) - ${createdAt}`);
    });

    // 9. High-value entities (opportunityScore)
    console.log('\n9️⃣ High-value entities...');
    const highValueResult = await session.run(`
      MATCH (n)
      WHERE n.opportunityScore IS NOT NULL
      RETURN n.name as name, labels(n)[0] as label, n.opportunityScore as score
      ORDER BY n.opportunityScore DESC
      LIMIT 10
    `);

    console.log('💎 High-value entities:');
    highValueResult.records.forEach((record) => {
      const name = record.get('name');
      const label = record.get('label');
      const score = record.get('score');
      console.log(`   ${name} (${label}) - Score: ${score}`);
    });

    // 10. Intelligence sources
    console.log('\n🔟 Intelligence sources...');
    const intelSourcesResult = await session.run(`
      MATCH (n)
      WHERE n.intelligenceSource IS NOT NULL
      RETURN n.intelligenceSource as source, count(n) as count
      ORDER BY count DESC
    `);

    console.log('📡 Intelligence sources:');
    intelSourcesResult.records.forEach((record) => {
      const source = record.get('source');
      const count = record.get('count').toNumber();
      console.log(`   ${source}: ${count}`);
    });

    // 11. Connected components analysis (simplified)
    console.log('\n1️⃣1️⃣ Graph connectivity...');
    const connectivityResult = await session.run(`
      MATCH (n)
      OPTIONAL MATCH (n)-[r]-(connected)
      WITH n, count(DISTINCT connected) as connections
      RETURN
        avg(connections) as avg_connections,
        max(connections) as max_connections,
        count(CASE WHEN connections = 0 THEN 1 END) as isolated_nodes
    `);

    const connectivity = connectivityResult.records[0];
    console.log(`📊 Average connections: ${Math.round(connectivity.get('avg_connections').toNumber() * 100) / 100}`);
    console.log(`📊 Maximum connections: ${connectivity.get('max_connections').toNumber()}`);
    console.log(`📊 Isolated nodes: ${connectivity.get('isolated_nodes').toNumber()}`);

    await session.close();
    await driver.close();

    // 12. Summary
    console.log('\n📋 GRAPH OVERVIEW SUMMARY:');
    console.log('='.repeat(50));
    console.log(`📊 Total nodes: ${totalNodes}`);
    console.log(`🏷️  Unique labels: ${uniqueLabels}`);
    console.log(`⚽ Sports: ${sportsAnalysisResult.records.length}`);
    console.log(`🌍 Countries: ${countryAnalysisResult.records.length}`);
    console.log(`🔗 Relationship types: ${relAnalysisResult.records.length}`);
    console.log(`💎 High-value entities: ${highValueResult.records.length}`);
    console.log(`🕐 Recent entities: ${recentEntitiesResult.records.length}`);

    console.log('\n🎯 Key Graph Characteristics:');
    console.log(`- Graph contains ${totalNodes} entities across ${uniqueLabels} types`);
    console.log(`- Primary focus on ${sportsAnalysisResult.records.map(r => r.get('sport')).join(', ')}`);
    console.log(`- Main relationship types: ${relAnalysisResult.records.slice(0, 3).map(r => r.get('relationship_type')).join(', ')}`);
    console.log(`- High-value entities identified: ${highValueResult.records.length}`);
    console.log(`- Recent data additions: ${recentEntitiesResult.records.length}`);

    return {
      totalNodes,
      uniqueLabels,
      relationshipTypes: relAnalysisResult.records.length,
      sports: sportsAnalysisResult.records.length,
      countries: countryAnalysisResult.records.length,
      highValueEntities: highValueResult.records.length
    };

  } catch (error) {
    console.error('❌ Graph overview failed:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

async function main() {
  const results = await getGraphOverview();

  if (results) {
    console.log('\n🎉 Graph overview completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Graph overview failed');
    process.exit(1);
  }
}

main().catch(console.error);