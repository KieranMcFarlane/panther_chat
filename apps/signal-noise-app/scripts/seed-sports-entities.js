#!/usr/bin/env node

// Sports Entities Seeding Script
const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '.env.local' });

// Load live demo entities
const { entities } = require('../live-demo-entities.json');

async function seedSportsEntities() {
  console.log('🏆 Seeding Sports Entities into Neo4j...\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Clear existing entities
    console.log('1. Clearing existing entities...');
    await session.run('MATCH (n) DETACH DELETE n');
    
    // Create constraints and indexes (handle existing ones)
    console.log('2. Creating constraints and indexes...');
    try {
      await session.run('DROP INDEX entity_name_index IF EXISTS');
    } catch (e) { /* ignore if doesn't exist */ }
    
    try {
      await session.run('CREATE CONSTRAINT entity_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE');
    } catch (e) { 
      console.log('   ⚠️  Entity constraint already exists');
    }
    
    await session.run('CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type)');
    await session.run('CREATE INDEX entity_sport_index IF NOT EXISTS FOR (e:Entity) ON (e.sport)');
    
    // Seed entities from live demo data
    console.log('3. Seeding entities...');
    let createdCount = 0;
    
    for (const entity of entities) {
      const { id, name, type, industry, data, lastUpdated } = entity;
      
      // Determine entity labels based on type
      const labels = [];
      if (type === 'club') labels.push('Club', 'Entity');
      else if (type === 'league') labels.push('League', 'Entity');
      else if (type === 'competition') labels.push('Competition', 'Entity');
      else if (type === 'venue') labels.push('Venue', 'Entity');
      else labels.push('Entity');
      
      // Create properties
      const properties = {
        name,
        type,
        sport: industry || 'football',
        original_id: id,
        last_updated: lastUpdated,
        created_at: new Date().toISOString(),
        opportunity_score: Math.floor(Math.random() * 40) + 60, // 60-100
        relationship_score: Math.floor(Math.random() * 30) + 70, // 70-100
        digital_maturity: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
        yellow_panther_priority: Math.floor(Math.random() * 50) + 50, // 50-100
        ...data
      };
      
      // Create entity with proper labels
      const labelString = labels.join(':');
      const query = `
        CREATE (n:${labelString} $properties)
        RETURN n.name as name, n.type as type
      `;
      
      const result = await session.run(query, { properties });
      createdCount++;
      
      console.log(`   ✅ Created ${name} (${type})`);
    }
    
    // Create some sample relationships
    console.log('4. Creating sample relationships...');
    
    // Create Premier League membership relationships
    const premierLeague = await session.run('MATCH (l:League {name: "Premier League"}) RETURN l');
    if (premierLeague.records.length > 0) {
      const clubs = [
        'Manchester United FC', 'Liverpool FC', 'Chelsea FC', 
        'Arsenal FC', 'Manchester City FC', 'Tottenham Hotspur'
      ];
      
      for (const clubName of clubs) {
        await session.run(`
          MATCH (c:Club {name: $clubName}), (l:League {name: "Premier League"})
          CREATE (c)-[:MEMBER_OF {membership_type: "FULL", join_date: "1992-08-15", status: "ACTIVE", division: "Premier League"}]->(l)
        `, { clubName });
        
        console.log(`   ✅ Linked ${clubName} to Premier League`);
      }
    }
    
    // Create competition relationships
    const championsLeague = await session.run('MATCH (cl:Competition {name: "UEFA Champions League"}) RETURN cl');
    if (championsLeague.records.length > 0) {
      const topClubs = ['Manchester United FC', 'Liverpool FC', 'Chelsea FC', 'Arsenal FC', 'Real Madrid CF'];
      
      for (const clubName of topClubs) {
        await session.run(`
          MATCH (c:Club {name: $clubName}), (cl:Competition {name: "UEFA Champions League"})
          CREATE (c)-[:COMPETES_IN {competition_type: "EUROPEAN", participation: "HISTORICAL", achievements: ["Winner", "Finalist"]}]->(cl)
        `, { clubName });
        
        console.log(`   ✅ Linked ${clubName} to Champions League`);
      }
    }
    
    // Create venue relationships
    const venues = [
      { club: 'Manchester United FC', venue: 'Old Trafford', capacity: 74800 },
      { club: 'Liverpool FC', venue: 'Anfield', capacity: 53394 },
      { club: 'Chelsea FC', venue: 'Stamford Bridge', capacity: 40343 },
      { club: 'Arsenal FC', venue: 'Emirates Stadium', capacity: 60704 },
      { club: 'Manchester City FC', venue: 'Etihad Stadium', capacity: 55197 }
    ];
    
    for (const { club, venue, capacity } of venues) {
      await session.run(`
        MATCH (c:Club {name: $club}), (v:Venue {name: $venue})
        CREATE (c)-[:PLAYS_AT {since: "2000-01-01", capacity: $capacity}]->(v)
      `, { club, venue, capacity });
      
      console.log(`   ✅ Linked ${club} to ${venue}`);
    }
    
    console.log(`\n🎉 Successfully seeded ${createdCount} entities with relationships!`);
    
    // Get summary statistics
    const stats = await session.run(`
      MATCH (n:Entity)
      RETURN n.type as type, count(n) as count
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Database Statistics:');
    stats.records.forEach(record => {
      console.log(`   ${record.get('type')}: ${record.get('count')} entities`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding entities:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

seedSportsEntities().catch(console.error);