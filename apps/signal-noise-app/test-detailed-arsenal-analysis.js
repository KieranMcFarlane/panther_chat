#!/usr/bin/env node

/**
 * Detailed Arsenal Analysis Script for Neo4j
 * Provides comprehensive analysis of Arsenal-related data and relationships
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

async function analyzeArsenalComprehensive() {
  console.log('🔍 Comprehensive Arsenal Analysis in Neo4j...');

  try {
    const driver = createNeo4jService();
    const session = driver.session();

    // 1. Get Arsenal FC detailed information
    console.log('\n1️⃣ Getting Arsenal FC detailed information...');
    const arsenalDetailsResult = await session.run(`
      MATCH (n)
      WHERE toLower(n.name) CONTAINS toLower('arsenal')
      RETURN n, labels(n) as labels
    `);

    if (arsenalDetailsResult.records.length === 0) {
      console.log('❌ No Arsenal entity found');
      return null;
    }

    const arsenalNode = arsenalDetailsResult.records[0].get('n');
    const arsenalLabels = arsenalDetailsResult.records[0].get('labels');
    const arsenalId = arsenalNode.identity.toString();
    const arsenalProps = arsenalNode.properties;

    console.log('🎯 Arsenal FC Details:');
    console.log(`   Name: ${arsenalProps.name}`);
    console.log(`   ID: ${arsenalId}`);
    console.log(`   Labels: ${arsenalLabels.join(', ')}`);
    console.log(`   Type: ${arsenalProps.type}`);
    console.log(`   Sport: ${arsenalProps.sport}`);
    console.log(`   Country: ${arsenalProps.country}`);
    console.log(`   Description: ${arsenalProps.description || 'No description'}`);

    // Show all properties
    console.log('\n📋 All Arsenal Properties:');
    Object.keys(arsenalProps).forEach(key => {
      console.log(`   ${key}: ${arsenalProps[key]}`);
    });

    // 2. Get all Arsenal relationships with details
    console.log('\n2️⃣ Analyzing Arsenal relationships...');
    const relationshipsResult = await session.run(`
      MATCH (n)-[r]-(related)
      WHERE id(n) = $arsenalId
      RETURN type(r) as relationship,
             startNode(r).name as from_node,
             endNode(r).name as to_node,
             labels(related)[0] as related_type,
             related.name as related_name,
             properties(r) as rel_props,
             labels(related) as related_labels,
             properties(related) as related_props
      ORDER BY type(r), related_name
    `, { arsenalId: parseInt(arsenalId) });

    console.log(`🔗 Found ${relationshipsResult.records.length} relationships:`);

    const relationshipTypes = {};
    relationshipsResult.records.forEach((record, index) => {
      const relationship = record.get('relationship');
      const relatedName = record.get('related_name');
      const relatedType = record.get('related_type');
      const relatedLabels = record.get('related_labels');
      const fromNode = record.get('from_node');
      const toNode = record.get('to_node');
      const relatedProps = record.get('related_props');

      console.log(`\n${index + 1}. [${relationship}]`);
      console.log(`   From: ${fromNode}`);
      console.log(`   To: ${toNode}`);
      console.log(`   Related entity: ${relatedName} (${relatedLabels.join(', ') || relatedType})`);

      // Show key properties of related entities
      if (relatedProps) {
        const keyProps = ['name', 'type', 'sport', 'country', 'position', 'age', 'nationality'];
        const importantProps = keyProps.filter(key => relatedProps[key]);
        if (importantProps.length > 0) {
          console.log('   Key properties:');
          importantProps.forEach(prop => {
            console.log(`     ${prop}: ${relatedProps[prop]}`);
          });
        }
      }

      // Count relationship types
      relationshipTypes[relationship] = (relationshipTypes[relationship] || 0) + 1;
    });

    console.log('\n📊 Relationship Type Summary:');
    Object.entries(relationshipTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    // 3. Analyze Arsenal players specifically
    console.log('\n3️⃣ Analyzing Arsenal players...');
    const playersResult = await session.run(`
      MATCH (arsenal)-[r:PLAYS_FOR]-(player:Player)
      WHERE toLower(arsenal.name) CONTAINS toLower('arsenal')
      RETURN player, labels(player) as labels
    `);

    console.log(`⚽ Found ${playersResult.records.length} Arsenal players:`);

    playersResult.records.forEach((record, index) => {
      const playerNode = record.get('player');
      const playerLabels = record.get('labels');
      const playerProps = playerNode.properties;

      console.log(`\n${index + 1}. ${playerProps.name || 'No name'} (${playerLabels.join(', ')})`);

      // Display all player properties
      Object.keys(playerProps).forEach(key => {
        if (playerProps[key] && key !== 'name') {
          console.log(`   ${key}: ${playerProps[key]}`);
        }
      });
    });

    // 4. Find Arsenal's competitions/leagues
    console.log('\n4️⃣ Finding Arsenal competitions and leagues...');
    const competitionsResult = await session.run(`
      MATCH (arsenal)-[r:RELATED_TO]-(comp)
      WHERE toLower(arsenal.name) CONTAINS toLower('arsenal')
        AND (comp:League OR comp:Competition OR toLower(comp.type) CONTAINS toLower('league'))
      RETURN comp, labels(comp) as labels
    `);

    console.log(`🏆 Found ${competitionsResult.records.length} competitions/leagues:`);

    competitionsResult.records.forEach((record, index) => {
      const compNode = record.get('comp');
      const compLabels = record.get('labels');
      const compProps = compNode.properties;

      console.log(`${index + 1}. ${compProps.name || 'No name'} (${compLabels.join(', ')})`);

      Object.keys(compProps).forEach(key => {
        if (compProps[key] && key !== 'name') {
          console.log(`   ${key}: ${compProps[key]}`);
        }
      });
    });

    // 5. Look for other English clubs for comparison
    console.log('\n5️⃣ Finding other English clubs for context...');
    const englishClubsResult = await session.run(`
      MATCH (club)
      WHERE club:Club
        AND toLower(club.sport) CONTAINS toLower('football')
        AND toLower(club.country) CONTAINS toLower('england')
        AND NOT toLower(club.name) CONTAINS toLower('arsenal')
      RETURN club, labels(club) as labels
      ORDER BY club.name
      LIMIT 10
    `);

    console.log(`🏴󐁧󐁢󐁥󐁮󐁧󐁿 Found ${englishClubsResult.records.length} other English clubs:`);

    englishClubsResult.records.forEach((record, index) => {
      const clubNode = record.get('club');
      const clubLabels = record.get('labels');
      const clubProps = clubNode.properties;

      console.log(`${index + 1}. ${clubProps.name || 'No name'} (${clubLabels.join(', ')})`);
    });

    // 6. Find entities connected to Arsenal's players (transfer targets, etc.)
    console.log('\n6️⃣ Analyzing Arsenal player connections...');
    if (playersResult.records.length > 0) {
      const playerConnectionsResult = await session.run(`
        MATCH (arsenal)-[:PLAYS_FOR]-(player:Player)-[r]-(connected)
        WHERE toLower(arsenal.name) CONTAINS toLower('arsenal')
        RETURN player.name as player_name,
               type(r) as connection_type,
               connected.name as connected_entity,
               labels(connected)[0] as connected_type
        LIMIT 20
      `);

      console.log(`🔗 Found ${playerConnectionsResult.records.length} player connections:`);

      const playerConnections = {};
      playerConnectionsResult.records.forEach((record) => {
        const playerName = record.get('player_name');
        const connectionType = record.get('connection_type');
        const connectedEntity = record.get('connected_entity');
        const connectedType = record.get('connected_type');

        if (!playerConnections[playerName]) {
          playerConnections[playerName] = [];
        }
        playerConnections[playerName].push({
          type: connectionType,
          entity: connectedEntity,
          entityType: connectedType
        });
      });

      Object.entries(playerConnections).forEach(([playerName, connections]) => {
        console.log(`\n👤 ${playerName}:`);
        connections.forEach((conn, idx) => {
          console.log(`   ${idx + 1}. [${conn.type}] → ${conn.entity} (${conn.entityType})`);
        });
      });
    }

    // 7. Graph structure analysis around Arsenal
    console.log('\n7️⃣ Graph structure analysis around Arsenal...');
    const graphAnalysisResult = await session.run(`
      MATCH (arsenal)-[r1*1..2]-(connected)
      WHERE toLower(arsenal.name) CONTAINS toLower('arsenal')
      RETURN DISTINCT
             labels(connected)[0] as entity_type,
             count(connected) as count,
             collect(DISTINCT connected.name)[..5] as examples
      ORDER BY count DESC
    `);

    console.log('📊 Arsenal Network Analysis:');
    graphAnalysisResult.records.forEach((record) => {
      const entityType = record.get('entity_type');
      const count = record.get('count').toNumber();
      const examples = record.get('examples');

      console.log(`\n${entityType} (${count} entities):`);
      examples.slice(0, 3).forEach((example, idx) => {
        console.log(`   ${idx + 1}. ${example}`);
      });
      if (examples.length > 3) {
        console.log(`   ... and ${examples.length - 3} more`);
      }
    });

    await session.close();
    await driver.close();

    // 8. Generate comprehensive summary
    console.log('\n📋 COMPREHENSIVE ARSENAL ANALYSIS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Arsenal FC found in knowledge graph`);
    console.log(`📍 Node ID: ${arsenalId}`);
    console.log(`🏷️  Labels: ${arsenalLabels.join(', ')}`);
    console.log(`⚽ Sport: ${arsenalProps.sport}`);
    console.log(`🏴 Country: ${arsenalProps.country}`);
    console.log(`🔗 Total relationships: ${relationshipsResult.records.length}`);
    console.log(`👥 Players: ${playersResult.records.length}`);
    console.log(`🏆 Competitions: ${competitionsResult.records.length}`);
    console.log(`🏴 Other English clubs: ${englishClubsResult.records.length}`);

    console.log('\n🎯 Key Insights:');
    if (playersResult.records.length > 0) {
      console.log(`- Arsenal has ${playersResult.records.length} players in the graph`);
      console.log('- Players appear to be transfer targets or linked players');
    }
    if (competitionsResult.records.length > 0) {
      console.log(`- Arsenal competes in ${competitionsResult.records.length} competitions/leagues`);
    }
    if (Object.keys(relationshipTypes).length > 0) {
      console.log(`- Arsenal has ${Object.keys(relationshipTypes).length} types of relationships`);
      console.log(`- Main relationship types: ${Object.keys(relationshipTypes).join(', ')}`);
    }

    return {
      arsenalId,
      arsenalProps,
      relationships: relationshipsResult.records.length,
      players: playersResult.records.length,
      competitions: competitionsResult.records.length,
      englishClubs: englishClubsResult.records.length,
      relationshipTypes
    };

  } catch (error) {
    console.error('❌ Comprehensive Arsenal analysis failed:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

async function main() {
  const results = await analyzeArsenalComprehensive();

  if (results) {
    console.log('\n🎉 Comprehensive Arsenal analysis completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Comprehensive Arsenal analysis failed');
    process.exit(1);
  }
}

main().catch(console.error);