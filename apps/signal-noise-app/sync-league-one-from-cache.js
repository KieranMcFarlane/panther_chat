// SYNC LEAGUE ONE FROM CACHED_ENTITIES TO NEO4J
// Transfers missing League One teams from Supabase cached_entities to Neo4j knowledge graph

require('dotenv').config({ path: '.env.local' });

console.log('🔄 LEAGUE ONE SYNC: cached_entities → Neo4j');
console.log('=' .repeat(80));

const { createClient } = require('@supabase/supabase-js');
const neo4j = require('neo4j-driver');

// Configuration - use the exact env var names from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const neo4jUri = process.env.NEO4J_URI;
const neo4jUser = process.env.NEO4J_USERNAME;
const neo4jPassword = process.env.NEO4J_PASSWORD;

// Debug environment variables
console.log('🔧 Environment Variables Check:');
console.log(`   Supabase URL: ${supabaseUrl ? '✅' : '❌'}`);
console.log(`   Supabase Key: ${supabaseKey ? '✅' : '❌'}`);
console.log(`   Neo4j URI: ${neo4jUri ? '✅' : '❌'}`);
console.log(`   Neo4j User: ${neo4jUser ? '✅' : '❌'}`);
console.log(`   Neo4j Password: ${neo4jPassword ? '✅' : '❌'}`);

if (!supabaseUrl || !supabaseKey || !neo4jUri || !neo4jUser || !neo4jPassword) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));

async function syncLeagueOneTeams() {
  const session = driver.session();
  
  try {
    console.log('\n📊 STEP 1: Fetching League One teams from cached_entities...');
    
    // Get all League One teams from cached_entities
    const { data: cachedTeams, error: fetchError } = await supabase
      .from('cached_entities')
      .select('*')
      .eq('properties->>sport', 'Football')
      .eq('properties->>league', 'League One')
      .eq('properties->>level', 'Tier 3')
      .order('properties->>name');
    
    if (fetchError) {
      console.error('❌ Error fetching cached teams:', fetchError);
      throw fetchError;
    }
    
    console.log(`✅ Found ${cachedTeams.length} League One teams in cached_entities`);
    
    console.log('\n🔍 STEP 2: Checking existing teams in Neo4j...');
    
    // Get existing League One teams in Neo4j
    const existingResult = await session.run(`
      MATCH (e:Entity {sport: 'Football'})
      WHERE e.league = 'League One' OR e.level = 'League One' OR e.level = 'EFL League One' OR e.level = 'Tier 3'
      RETURN e.name as team_name, e.neo4j_id as neo4j_id
      ORDER BY e.name
    `);
    
    const existingTeams = existingResult.records.map(record => ({
      name: record.get('team_name'),
      neo4j_id: record.get('neo4j_id')
    }));
    
    console.log(`✅ Found ${existingTeams.length} League One teams already in Neo4j`);
    
    console.log('\n🔄 STEP 3: Identifying missing teams...');
    
    // Find teams missing from Neo4j
    const missingTeams = cachedTeams.filter(cachedTeam => {
      const teamName = cachedTeam.properties?.name;
      return !existingTeams.some(existing => existing.name === teamName);
    });
    
    console.log(`📝 Need to add ${missingTeams.length} teams to Neo4j:`);
    missingTeams.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.properties?.name} (${team.properties?.country})`);
    });
    
    if (missingTeams.length === 0) {
      console.log('\n🎉 All teams are already in Neo4j - sync complete!');
      return;
    }
    
    console.log('\n💾 STEP 4: Adding missing teams to Neo4j...');
    
    let addedCount = 0;
    
    for (const team of missingTeams) {
      const properties = team.properties;
      const teamName = properties?.name;
      const neo4jId = team.neo4j_id;
      
      try {
        const result = await session.run(`
          MERGE (e:Entity {name: $teamName, sport: 'Football'})
          ON CREATE SET 
            e.neo4j_id = $neo4jId,
            e.supabase_id = $supabaseId,
            e.league = $league,
            e.level = $level,
            e.country = $country,
            e.sport = 'Football',
            e.entity_type = 'Club',
            e.created_at = datetime(),
            e.updated_at = datetime(),
            e.properties = $properties
          ON MATCH SET
            e.league = $league,
            e.level = $level,
            e.country = $country,
            e.updated_at = datetime(),
            e.properties = $properties
          RETURN e.name as team_name, e.neo4j_id as neo4j_id
        `, {
          teamName,
          neo4jId,
          supabaseId: team.id,
          league: properties?.league || 'League One',
          level: properties?.level || 'Tier 3',
          country: properties?.country || 'England',
          properties: properties
        });
        
        addedCount++;
        console.log(`   ✅ Added: ${teamName} (Neo4j ID: ${result.records[0].get('neo4j_id')})`);
        
      } catch (error) {
        console.error(`   ❌ Failed to add ${teamName}:`, error.message);
      }
    }
    
    console.log(`\n🎉 STEP 5: Sync Summary:`);
    console.log(`   • Total cached_entities teams: ${cachedTeams.length}`);
    console.log(`   • Existing Neo4j teams: ${existingTeams.length}`);
    console.log(`   • Teams added: ${addedCount}`);
    console.log(`   • Expected total in Neo4j: ${existingTeams.length + addedCount}`);
    
    console.log('\n🔗 STEP 6: Creating League One relationships...');
    
    // Create relationships between League One teams
    const relationshipResult = await session.run(`
      MATCH (team1:Entity {sport: 'Football', league: 'League One'})
      MATCH (team2:Entity {sport: 'Football', league: 'League One'})
      WHERE team1.name < team2.name
      MERGE (team1)-[r:COMPETES_IN_SAME_LEAGUE]->(team2)
      SET r.league = 'League One',
          r.season = '2024-25',
          r.competition_level = 'Tier 3',
          r.updated_at = datetime()
      RETURN count(r) as relationships_created
    `);
    
    const relationshipsCreated = relationshipResult.records[0].get('relationships_created');
    console.log(`   ✅ Created ${relationshipsCreated} league relationships`);
    
    console.log('\n🏆 SYNC COMPLETE: League One data is now consistent between cached_entities and Neo4j');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  } finally {
    await session.close();
  }
}

async function verifySync() {
  const session = driver.session();
  
  try {
    console.log('\n🔎 VERIFYING SYNC RESULTS...');
    
    const result = await session.run(`
      MATCH (e:Entity {sport: 'Football'})
      WHERE e.league = 'League One' OR e.level = 'League One' OR e.level = 'EFL League One' OR e.level = 'Tier 3'
      RETURN e.name as team_name, e.league, e.level, e.country
      ORDER BY e.name
    `);
    
    console.log(`✅ Neo4j now has ${result.records.length} League One teams:`);
    result.records.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.get('team_name')} (${record.get('league')} / ${record.get('level')})`);
    });
    
  } finally {
    await session.close();
  }
}

// Main execution
async function main() {
  try {
    await syncLeagueOneTeams();
    await verifySync();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await driver.close();
    console.log('\n👋 Database connections closed');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { syncLeagueOneTeams, verifySync };