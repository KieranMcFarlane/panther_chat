#!/usr/bin/env node

/**
 * Arsenal Search Script for Neo4j
 * Searches for Arsenal-related entities in the knowledge graph
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

async function searchArsenalData() {
  console.log('🔍 Searching for Arsenal-related data in Neo4j...');
  console.log(`📍 URI: ${process.env.NEO4J_URI}`);
  console.log(`👤 User: ${process.env.NEO4J_USERNAME || process.env.NEO4J_USER}`);

  try {
    const driver = createNeo4jService();
    const session = driver.session();

    // 1. First, test basic connectivity
    console.log('\n1️⃣ Testing Neo4j connection...');
    const basicResult = await session.run('RETURN 1 as test');
    console.log('✅ Neo4j connection successful!');

    // 2. Get overall graph statistics
    console.log('\n2️⃣ Getting graph statistics...');
    const statsResult = await session.run(`
      MATCH (n)
      RETURN count(n) as total_nodes,
             collect(DISTINCT labels(n)[0])[..10] as node_types,
             count(DISTINCT labels(n)[0]) as unique_types
    `);

    const statsRecord = statsResult.records[0];
    const totalNodes = statsRecord.get('total_nodes').toNumber();
    const nodeTypes = statsRecord.get('node_types');
    const uniqueTypes = statsRecord.get('unique_types').toNumber();

    console.log(`📊 Total nodes: ${totalNodes}`);
    console.log(`🏷️  Node types (${uniqueTypes}): ${nodeTypes.join(', ')}`);

    // 3. Search for Arsenal-related entities
    console.log('\n3️⃣ Searching for Arsenal entities...');
    const arsenalResult = await session.run(`
      MATCH (n)
      WHERE toLower(n.name) CONTAINS toLower('arsenal')
         OR toLower(n.description) CONTAINS toLower('arsenal')
         OR toLower(n.type) CONTAINS toLower('arsenal')
         OR toLower(n.club) CONTAINS toLower('arsenal')
         OR toLower(n.team) CONTAINS toLower('arsenal')
      RETURN n, labels(n) as labels
      LIMIT 20
    `);

    console.log(`🎯 Found ${arsenalResult.records.length} Arsenal-related entities:`);

    const arsenalEntities = [];
    arsenalResult.records.forEach((record, index) => {
      const node = record.get('n');
      const labels = record.get('labels');
      const properties = node.properties;

      console.log(`\n${index + 1}. ${properties.name || 'No name'} (${labels.join(', ')})`);
      console.log(`   ID: ${node.identity.toString()}`);
      console.log(`   Type: ${properties.type || 'No type'}`);
      console.log(`   Sport: ${properties.sport || 'No sport'}`);
      console.log(`   Description: ${properties.description || 'No description'}`);
      console.log(`   Country: ${properties.country || 'No country'}`);

      arsenalEntities.push({
        id: node.identity.toString(),
        name: properties.name,
        labels: labels,
        properties: properties
      });
    });

    // 4. For each Arsenal entity, get its relationships
    if (arsenalEntities.length > 0) {
      console.log('\n4️⃣ Analyzing Arsenal relationships...');

      for (let i = 0; i < Math.min(arsenalEntities.length, 5); i++) {
        const entity = arsenalEntities[i];
        console.log(`\n🔗 Relationships for "${entity.name}":`);

        const relResult = await session.run(`
          MATCH (n)-[r]-(related)
          WHERE id(n) = $entityId
          RETURN type(r) as relationship,
                 labels(related)[0] as related_type,
                 related.name as related_name,
                 related.type as related_entity_type,
                 properties(r) as rel_props
          LIMIT 10
        `, { entityId: parseInt(entity.id) });

        if (relResult.records.length === 0) {
          console.log('   No relationships found');
        } else {
          relResult.records.forEach((record, idx) => {
            const relationship = record.get('relationship');
            const relatedType = record.get('related_type');
            const relatedName = record.get('related_name');
            const relatedEntityType = record.get('related_entity_type');

            console.log(`   ${idx + 1}. [${relationship}] → ${relatedName || 'No name'} (${relatedType || relatedEntityType || 'Unknown'})`);
          });
        }
      }
    }

    // 5. Look for football/soccer entities that might be related to Arsenal
    console.log('\n5️⃣ Searching for football entities that might be Arsenal-related...');
    const footballResult = await session.run(`
      MATCH (n)
      WHERE (toLower(n.sport) CONTAINS toLower('football')
             OR toLower(n.sport) CONTAINS toLower('soccer')
             OR toLower(n.type) CONTAINS toLower('football')
             OR toLower(n.type) CONTAINS toLower('soccer')
             OR n:Club
             OR n:Team)
        AND (toLower(n.country) CONTAINS toLower('england')
             OR toLower(n.league) CONTAINS toLower('premier')
             OR toLower(n.league) CONTAINS toLower('london'))
      RETURN n, labels(n) as labels
      LIMIT 15
    `);

    console.log(`⚽ Found ${footballResult.records.length} potentially related football entities:`);

    footballResult.records.forEach((record, index) => {
      const node = record.get('n');
      const labels = record.get('labels');
      const properties = node.properties;

      console.log(`${index + 1}. ${properties.name || 'No name'} (${labels.join(', ')})`);
      console.log(`   Sport: ${properties.sport || 'No sport'}`);
      console.log(`   Country: ${properties.country || 'No country'}`);
      console.log(`   League: ${properties.league || 'No league'}`);
    });

    // 6. Search for any Premier League or London-based entities
    console.log('\n6️⃣ Searching for Premier League/London entities...');
    const premierLeagueResult = await session.run(`
      MATCH (n)
      WHERE toLower(n.league) CONTAINS toLower('premier')
         OR toLower(n.competition) CONTAINS toLower('premier')
         OR toLower(n.city) CONTAINS toLower('london')
         OR toLower(n.location) CONTAINS toLower('london')
      RETURN n, labels(n) as labels
      LIMIT 10
    `);

    console.log(`🏆 Found ${premierLeagueResult.records.length} Premier League/London entities:`);

    premierLeagueResult.records.forEach((record, index) => {
      const node = record.get('n');
      const labels = record.get('labels');
      const properties = node.properties;

      console.log(`${index + 1}. ${properties.name || 'No name'} (${labels.join(', ')})`);
      console.log(`   League: ${properties.league || properties.competition || 'No league'}`);
      console.log(`   City: ${properties.city || properties.location || 'No city'}`);
    });

    await session.close();
    await driver.close();

    // 7. Summary
    console.log('\n📋 ARSENAL SEARCH SUMMARY:');
    console.log(`- Direct Arsenal matches: ${arsenalEntities.length}`);
    console.log(`- Related football entities: ${footballResult.records.length}`);
    console.log(`- Premier League/London entities: ${premierLeagueResult.records.length}`);
    console.log(`- Total nodes in graph: ${totalNodes}`);

    if (arsenalEntities.length > 0) {
      console.log('\n✅ Arsenal data found in the knowledge graph!');
      console.log('Key Arsenal entity types:');
      const arsenalTypes = [...new Set(arsenalEntities.flatMap(e => e.labels))];
      arsenalTypes.forEach(type => console.log(`- ${type}`));
    } else {
      console.log('\n⚠️  No direct Arsenal entities found, but related football data exists');
    }

    return {
      arsenalEntities,
      footballEntities: footballResult.records.length,
      premierLeagueEntities: premierLeagueResult.records.length,
      totalNodes
    };

  } catch (error) {
    console.error('❌ Arsenal search failed:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

async function main() {
  const results = await searchArsenalData();

  if (results) {
    console.log('\n🎉 Arsenal search completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Arsenal search failed');
    process.exit(1);
  }
}

main().catch(console.error);