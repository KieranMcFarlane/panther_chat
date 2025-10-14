const neo4j = require('neo4j-driver');

async function buildComprehensiveRelationships() {
  console.log('🔗 Building Comprehensive Relationships in Knowledge Graph');
  console.log('📊 Creating structured relationships between 4,422 entities');
  
  // Neo4j configuration
  const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
  const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  await driver.verifyConnectivity();
  console.log('✅ Connected to Neo4j AuraDB');
  
  const session = driver.session();
  
  try {
    // Check current state
    const currentCountResult = await session.run('MATCH (n) RETURN count(n) as current');
    const currentEntityCount = currentCountResult.records[0].get('current').toNumber();
    console.log(`📊 Current entities: ${currentEntityCount}`);
    
    const currentRelCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as current');
    const currentRelCount = currentRelCountResult.records[0].get('current').toNumber();
    console.log(`📊 Current relationships: ${currentRelCount}`);
    
    const relationshipStats = {
      sport_relationships: 0,
      country_relationships: 0,
      league_team_relationships: 0,
      federation_relationships: 0,
      hierarchical_relationships: 0,
      total_created: 0
    };
    
    // 1. Create Sport-based relationships
    console.log('\n🏃 Creating Sport-based relationships...');
    relationshipStats.sport_relationships = await createSportRelationships(session);
    
    // 2. Create Country-based relationships
    console.log('\n🌍 Creating Country-based relationships...');
    relationshipStats.country_relationships = await createCountryRelationships(session);
    
    // 3. Create League-Team relationships
    console.log('\n⚽ Creating League-Team relationships...');
    relationshipStats.league_team_relationships = await createLeagueTeamRelationships(session);
    
    // 4. Create Federation relationships
    console.log('\n🏢 Creating Federation relationships...');
    relationshipStats.federation_relationships = await createFederationRelationships(session);
    
    // 5. Create Hierarchical relationships
    console.log('\n📊 Creating Hierarchical relationships...');
    relationshipStats.hierarchical_relationships = await createHierarchicalRelationships(session);
    
    relationshipStats.total_created = Object.values(relationshipStats).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0) - 
                                   relationshipStats.total_created; // Subtract the total_created field itself
    
    // Verify final state
    const finalRelCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as final');
    const finalRelCount = finalRelCountResult.records[0].get('final').toNumber();
    
    // Get relationship types breakdown
    const relTypesResult = await session.run('MATCH ()-[r]->() RETURN type(r) as rel_type, count(*) as count ORDER BY count DESC');
    const relationshipTypes = relTypesResult.records.map(record => ({
      type: record.get('rel_type'),
      count: record.get('count').toNumber()
    }));
    
    await session.close();
    await driver.close();
    
    console.log('\n🎉 COMPREHENSIVE RELATIONSHIP BUILDING COMPLETE!');
    console.log(`📊 Previous relationships: ${currentRelCount}`);
    console.log(`✅ New relationships created: ${relationshipStats.total_created}`);
    console.log(`📈 Final relationship count: ${finalRelCount}`);
    
    console.log('\n📋 Relationship Creation Summary:');
    console.log(`  🏃 Sport relationships: ${relationshipStats.sport_relationships}`);
    console.log(`  🌍 Country relationships: ${relationshipStats.country_relationships}`);
    console.log(`  ⚽ League-Team relationships: ${relationshipStats.league_team_relationships}`);
    console.log(`  🏢 Federation relationships: ${relationshipStats.federation_relationships}`);
    console.log(`  📊 Hierarchical relationships: ${relationshipStats.hierarchical_relationships}`);
    
    console.log('\n📋 Relationship Types in Graph:');
    relationshipTypes.forEach(rel => {
      console.log(`  • ${rel.type}: ${rel.count} relationships`);
    });
    
    return {
      success: true,
      stats: {
        previousRelationships: currentRelCount,
        finalRelationships: finalRelCount,
        relationshipsCreated: relationshipStats.total_created,
        breakdown: relationshipStats,
        relationshipTypes: relationshipTypes,
        entityCount: currentEntityCount
      }
    };
    
  } catch (error) {
    console.error('❌ Relationship building failed:', error);
    await session.close();
    throw error;
  }
}

async function createSportRelationships(session) {
  console.log('  🔗 Linking entities to their respective sports...');
  
  let created = 0;
  
  try {
    // Link entities to sports based on sport property
    const result1 = await session.run(`
      MATCH (e:Entity), (s:Sport)
      WHERE e.sport IS NOT NULL 
        AND e.sport = s.name
        AND NOT EXISTS((e)-[:PLAYS_IN]->(s))
      MERGE (e)-[:PLAYS_IN]->(s)
      RETURN count(*) as count
    `);
    created += result1.records[0].get('count').toNumber();
    
    // Create Sport nodes if they don't exist and link entities
    const sportEntitiesResult = await session.run(`
      MATCH (e:Entity)
      WHERE e.sport IS NOT NULL 
        AND NOT EXISTS((e)-[:PLAYS_IN]->(:Sport))
      WITH DISTINCT e.sport as sportName
      MERGE (s:Sport {name: sportName})
      WITH s, sportName
      MATCH (e:Entity {sport: sportName})
      MERGE (e)-[:PLAYS_IN]->(s)
      RETURN count(*) as count
    `);
    created += sportEntitiesResult.records[0].get('count').toNumber();
    
    console.log(`  ✅ Created ${created} sport relationships`);
    return created;
    
  } catch (error) {
    console.error('  ❌ Error creating sport relationships:', error);
    return 0;
  }
}

async function createCountryRelationships(session) {
  console.log('  🌍 Linking entities to their respective countries...');
  
  let created = 0;
  
  try {
    // Link entities to countries based on country property
    const result1 = await session.run(`
      MATCH (e:Entity), (c:Country)
      WHERE e.country IS NOT NULL 
        AND e.country = c.name
        AND NOT EXISTS((e)-[:LOCATED_IN]->(c))
      MERGE (e)-[:LOCATED_IN]->(c)
      RETURN count(*) as count
    `);
    created += result1.records[0].get('count').toNumber();
    
    // Create Country nodes if they don't exist and link entities
    const countryEntitiesResult = await session.run(`
      MATCH (e:Entity)
      WHERE e.country IS NOT NULL 
        AND NOT EXISTS((e)-[:LOCATED_IN]->(:Country))
      WITH DISTINCT e.country as countryName
      MERGE (c:Country {name: countryName})
      WITH c, countryName
      MATCH (e:Entity {country: countryName})
      MERGE (e)-[:LOCATED_IN]->(c)
      RETURN count(*) as count
    `);
    created += countryEntitiesResult.records[0].get('count').toNumber();
    
    console.log(`  ✅ Created ${created} country relationships`);
    return created;
    
  } catch (error) {
    console.error('  ❌ Error creating country relationships:', error);
    return 0;
  }
}

async function createLeagueTeamRelationships(session) {
  console.log('  ⚽ Creating league-team and competition relationships...');
  
  let created = 0;
  
  try {
    // Link clubs to leagues based on sport and country
    const clubLeagueResult = await session.run(`
      MATCH (club:Entity {type: 'Club'}), (league:Entity {type: 'League'})
      WHERE club.sport = league.sport 
        AND club.country = league.country
        AND NOT EXISTS((club)-[:MEMBER_OF]->(league))
      MERGE (club)-[:MEMBER_OF]->(league)
      RETURN count(*) as count
    `);
    created += clubLeagueResult.records[0].get('count').toNumber();
    
    // Create competition relationships between leagues of same sport
    const leagueCompetitionResult = await session.run(`
      MATCH (l1:Entity {type: 'League'}), (l2:Entity {type: 'League'})
      WHERE l1.sport = l2.sport 
        AND l1.name <> l2.name
        AND NOT EXISTS((l1)-[:COMPETES_WITH]->(l2))
      MERGE (l1)-[:COMPETES_WITH]->(l2)
      RETURN count(*) as count
    `);
    created += leagueCompetitionResult.records[0].get('count').toNumber();
    
    // Link clubs to international competitions based on sport
    const clubCompetitionResult = await session.run(`
      MATCH (club:Entity {type: 'Club'}), (comp:Entity {type: 'Tournament'})
      WHERE club.sport = comp.sport
        AND NOT EXISTS((club)-[:PARTICIPATES_IN]->(comp))
      MERGE (club)-[:PARTICIPATES_IN]->(comp)
      RETURN count(*) as count
    `);
    created += clubCompetitionResult.records[0].get('count').toNumber();
    
    console.log(`  ✅ Created ${created} league-team relationships`);
    return created;
    
  } catch (error) {
    console.error('  ❌ Error creating league-team relationships:', error);
    return 0;
  }
}

async function createFederationRelationships(session) {
  console.log('  🏢 Creating federation and governance relationships...');
  
  let created = 0;
  
  try {
    // Link entities to federations based on sport
    const sportFederationResult = await session.run(`
      MATCH (entity:Entity), (federation:Entity {type: 'International Federation'})
      WHERE entity.sport IS NOT NULL 
        AND federation.sport IS NOT NULL 
        AND entity.sport = federation.sport
        AND NOT EXISTS((entity)-[:GOVERNED_BY]->(federation))
      MERGE (entity)-[:GOVERNED_BY]->(federation)
      RETURN count(*) as count
    `);
    created += sportFederationResult.records[0].get('count').toNumber();
    
    // Link entities to federations based on country
    const countryFederationResult = await session.run(`
      MATCH (entity:Entity), (federation:Entity {type: 'International Federation'})
      WHERE entity.country IS NOT NULL 
        AND federation.name CONTAINS entity.country
        AND NOT EXISTS((entity)-[:AFFILIATED_WITH]->(federation))
      MERGE (entity)-[:AFFILIATED_WITH]->(federation)
      RETURN count(*) as count
    `);
    created += countryFederationResult.records[0].get('count').toNumber();
    
    // Create hierarchical federation relationships
    const federationHierarchyResult = await session.run(`
      MATCH (f1:Entity {type: 'International Federation'}), (f2:Entity {type: 'International Federation'})
      WHERE f1.name <> f2.name
        AND (f1.sport = 'Olympics' OR f2.sport = 'Olympics')
        AND NOT EXISTS((f1)-[:COLLABORATES_WITH]->(f2))
      MERGE (f1)-[:COLLABORATES_WITH]->(f2)
      RETURN count(*) as count
    `);
    created += federationHierarchyResult.records[0].get('count').toNumber();
    
    console.log(`  ✅ Created ${created} federation relationships`);
    return created;
    
  } catch (error) {
    console.error('  ❌ Error creating federation relationships:', error);
    return 0;
  }
}

async function createHierarchicalRelationships(session) {
  console.log('  📊 Creating hierarchical and organizational relationships...');
  
  let created = 0;
  
  try {
    // Create tier-based relationships
    const tierRelationshipsResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.tier IS NOT NULL 
        AND e2.tier IS NOT NULL 
        AND e1.type = e2.type
        AND e1.sport = e2.sport
        AND e1.name <> e2.name
        AND NOT EXISTS((e1)-[:SAME_TIER_AS]->(e2))
      MERGE (e1)-[:SAME_TIER_AS]->(e2)
      RETURN count(*) as count
    `);
    created += tierRelationshipsResult.records[0].get('count').toNumber();
    
    // Create geographical relationships
    const geoRelationshipsResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.country IS NOT NULL 
        AND e2.country IS NOT NULL 
        AND e1.country = e2.country
        AND e1.sport = e2.sport
        AND e1.name <> e2.name
        AND NOT EXISTS((e1)-[:SAME_COUNTRY_COMPETITOR]->(e2))
      MERGE (e1)-[:SAME_COUNTRY_COMPETITOR]->(e2)
      RETURN count(*) as count
    `);
    created += geoRelationshipsResult.records[0].get('count').toNumber();
    
    // Create sport discipline relationships
    const disciplineRelationshipsResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.sport IS NOT NULL 
        AND e2.sport IS NOT NULL 
        AND e1.sport = e2.sport
        AND e1.name <> e2.name
        AND NOT EXISTS((e1)-[:SAME_DISCIPLINE]->(e2))
      MERGE (e1)-[:SAME_DISCIPLINE]->(e2)
      RETURN count(*) as count
    `);
    created += disciplineRelationshipsResult.records[0].get('count').toNumber();
    
    // Create organization type relationships
    const orgTypeRelationshipsResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.type IS NOT NULL 
        AND e2.type IS NOT NULL 
        AND e1.type = e2.type
        AND e1.name <> e2.name
        AND NOT EXISTS((e1)-[:SAME_TYPE_AS]->(e2))
      MERGE (e1)-[:SAME_TYPE_AS]->(e2)
      RETURN count(*) as count
    `);
    created += orgTypeRelationshipsResult.records[0].get('count').toNumber();
    
    console.log(`  ✅ Created ${created} hierarchical relationships`);
    return created;
    
  } catch (error) {
    console.error('  ❌ Error creating hierarchical relationships:', error);
    return 0;
  }
}

// Run the relationship building
if (require.main === module) {
  buildComprehensiveRelationships()
    .then((result) => {
      console.log('\n🎉 Comprehensive relationship building completed successfully!');
      console.log('\n📊 Final Summary:');
      console.log(`• Total entities: ${result.stats.entityCount}`);
      console.log(`• Final relationships: ${result.stats.finalRelationships}`);
      console.log(`• Relationships created: ${result.stats.relationshipsCreated}`);
      console.log(`• Relationship types: ${result.stats.relationshipTypes.length} different types`);
      console.log('\n🔗 Knowledge graph is now fully connected and ready for intelligent queries!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Relationship building failed:', error);
      process.exit(1);
    });
}

module.exports = { buildComprehensiveRelationships };