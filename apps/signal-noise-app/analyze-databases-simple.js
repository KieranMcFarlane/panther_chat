const neo4j = require('neo4j-driver');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

async function analyzeDatabases() {
  console.log('🔍 DATABASE ANALYSIS: Neo4j + Supabase\n');
  
  // === NEO4J ANALYSIS ===
  console.log('📊 NEO4J GRAPH DATABASE');
  console.log('========================');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Basic stats
    console.log('\n🔢 BASIC STATISTICS:');
    const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as totalNodes');
    const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as totalRels');
    
    const totalNodes = nodeCountResult.records[0].get('totalNodes');
    const totalRels = relCountResult.records[0].get('totalRels');
    
    console.log(`  • Total Nodes: ${totalNodes.toLocaleString()}`);
    console.log(`  • Total Relationships: ${totalRels.toLocaleString()}`);
    console.log(`  • Avg Relationships per Node: ${(totalRels / totalNodes).toFixed(1)}`);

    // Label distribution
    console.log('\n🏷️ ENTITY DISTRIBUTION:');
    const labelQuery = `
      MATCH (n)
      WITH labels(n) as labels
      UNWIND labels as label
      RETURN label, count(*) as count
      ORDER BY count DESC
    `;
    const labelResult = await session.run(labelQuery);
    
    labelResult.records.forEach(record => {
      const label = record.get('label');
      const count = record.get('count');
      const percentage = ((count / totalNodes) * 100).toFixed(1);
      console.log(`  • ${label}: ${count.toLocaleString()} (${percentage}%)`);
    });

    // Dossier analysis
    console.log('\n📋 DOSSIER DATA COVERAGE:');
    const dossierQuery = `
      MATCH (n)
      RETURN 
        COUNT(CASE WHEN n.dossier_data IS NOT NULL THEN 1 END) as withDossier,
        COUNT(CASE WHEN n.dossier_data IS NULL THEN 1 END) as withoutDossier
    `;
    const dossierResult = await session.run(dossierQuery);
    
    if (dossierResult.records.length > 0) {
      const withDossier = dossierResult.records[0].get('withDossier');
      const withoutDossier = dossierResult.records[0].get('withoutDossier');
      const coverage = ((withDossier / totalNodes) * 100).toFixed(1);
      
      console.log(`  • Entities with dossier_data: ${withDossier.toLocaleString()}`);
      console.log(`  • Entities without dossier_data: ${withoutDossier.toLocaleString()}`);
      console.log(`  • Coverage: ${coverage}%`);
    }

    // Named entities sample
    console.log('\n🏟️ SAMPLE NAMED ENTITIES:');
    const namedQuery = `
      MATCH (n) 
      WHERE n.name IS NOT NULL 
      RETURN n.name as name, labels(n) as labels, n.sport as sport
      ORDER BY n.name
      LIMIT 15
    `;
    const namedResult = await session.run(namedQuery);
    
    namedResult.records.forEach(record => {
      const name = record.get('name');
      const labels = record.get('labels').join(', ');
      const sport = record.get('sport') || 'N/A';
      console.log(`  • ${name} (${labels}) - ${sport}`);
    });

    // Sport distribution
    console.log('\n⚽ SPORTS COVERAGE:');
    const sportQuery = `
      MATCH (n) 
      WHERE n.sport IS NOT NULL 
      RETURN n.sport as sport, count(*) as count
      ORDER BY count DESC
      LIMIT 10
    `;
    const sportResult = await session.run(sportQuery);
    
    sportResult.records.forEach(record => {
      const sport = record.get('sport');
      const count = record.get('count');
      console.log(`  • ${sport}: ${count.toLocaleString()}`);
    });

    // Yellow Panther network
    console.log('\n🐆 YELLOW PANTHER NETWORK:');
    const ypQuery = `
      MATCH (yp:YellowPanther)
      OPTIONAL MATCH (entity)-[:HAS_CONNECTION_TO]-(yp)
      RETURN 
        COUNT(DISTINCT yp) as ypMembers,
        COUNT(DISTINCT entity) as connectedEntities,
        COLLECT(DISTINCT yp.name) as ypTeam
    `;
    const ypResult = await session.run(ypQuery);
    
    if (ypResult.records.length > 0) {
      const record = ypResult.records[0];
      const ypMembers = record.get('ypMembers');
      const connectedEntities = record.get('connectedEntities');
      const ypTeam = record.get('ypTeam');
      
      console.log(`  • YP Team Members: ${ypMembers}`);
      console.log(`  • Connected Entities: ${connectedEntities.toLocaleString()}`);
      console.log(`  • YP Team: ${ypTeam.join(', ')}`);
    }

    // High-value entities
    console.log('\n💎 HIGH-VALUE ENTITIES:');
    const highValueQuery = `
      MATCH (n) 
      WHERE n.priorityScore >= 80 OR n.opportunity_score >= 80
      RETURN n.name as name, COALESCE(n.priorityScore, n.opportunity_score) as score, 
             n.sport as sport, labels(n)[0] as type
      ORDER BY score DESC
      LIMIT 10
    `;
    const highValueResult = await session.run(highValueQuery);
    
    if (highValueResult.records.length > 0) {
      highValueResult.records.forEach(record => {
        const name = record.get('name');
        const score = record.get('score');
        const sport = record.get('sport') || 'N/A';
        const type = record.get('type');
        console.log(`  • ${name} (${sport}) - Score: ${score} - ${type}`);
      });
    } else {
      console.log('  • No high-value entities found (score >= 80)');
    }

  } catch (error) {
    console.error('❌ Neo4j Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }

  // === SUPABASE ANALYSIS ===
  console.log('\n\n🗄️ SUPABASE POSTGRESQL CACHE');
  console.log('=============================');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase credentials not configured');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Cached entities overview
    console.log('\n📊 CACHED ENTITIES OVERVIEW:');
    const { count: cachedCount, error: cacheError } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });
    
    if (cacheError) {
      console.log(`❌ Error accessing cached_entities: ${cacheError.message}`);
    } else {
      console.log(`  • Total cached entities: ${cachedCount?.toLocaleString() || 0}`);
    }

    // Teams table
    console.log('\n⚽ TEAMS TABLE:');
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, sport, country, priority, opportunity_score, badge_path, neo4j_id', 
              { count: 'exact' });
    
    if (teamsError) {
      console.log(`❌ Error accessing teams: ${teamsError.message}`);
    } else {
      console.log(`  • Total teams: ${teamsData?.length.toLocaleString() || 0}`);
      
      // Sport distribution
      const sportCounts = {};
      teamsData?.forEach(team => {
        sportCounts[team.sport] = (sportCounts[team.sport] || 0) + 1;
      });
      
      console.log('  • Teams by sport:');
      Object.entries(sportCounts).forEach(([sport, count]) => {
        console.log(`    - ${sport}: ${count}`);
      });
      
      // High-value teams
      const highValueTeams = teamsData?.filter(team => 
        (team.priority && team.priority >= 80) || 
        (team.opportunity_score && team.opportunity_score >= 80)
      );
      console.log(`  • High-value teams: ${highValueTeams?.length || 0}`);
      
      // Badge coverage
      const teamsWithBadges = teamsData?.filter(team => team.badge_path || team.badge_s3_url);
      const badgeCoverage = teamsData?.length ? ((teamsWithBadges?.length || 0) / teamsData.length * 100).toFixed(1) : 0;
      console.log(`  • Teams with badges: ${teamsWithBadges?.length || 0} (${badgeCoverage}%)`);
    }

    // Leagues table
    console.log('\n🏆 LEAGUES TABLE:');
    const { data: leaguesData, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name, sport, country, priority_score, badge_path, neo4j_id', 
              { count: 'exact' });
    
    if (leaguesError) {
      console.log(`❌ Error accessing leagues: ${leaguesError.message}`);
    } else {
      console.log(`  • Total leagues: ${leaguesData?.length.toLocaleString() || 0}`);
      
      // Sport distribution for leagues
      const leagueSportCounts = {};
      leaguesData?.forEach(league => {
        leagueSportCounts[league.sport] = (leagueSportCounts[league.sport] || 0) + 1;
      });
      
      console.log('  • Leagues by sport:');
      Object.entries(leagueSportCounts).forEach(([sport, count]) => {
        console.log(`    - ${sport}: ${count}`);
      });
      
      // Badge coverage for leagues
      const leaguesWithBadges = leaguesData?.filter(league => league.badge_path || league.badge_s3_url);
      const leagueBadgeCoverage = leaguesData?.length ? ((leaguesWithBadges?.length || 0) / leaguesData.length * 100).toFixed(1) : 0;
      console.log(`  • Leagues with badges: ${leaguesWithBadges?.length || 0} (${leagueBadgeCoverage}%)`);
    }

    // Sample teams with neo4j_id mapping
    if (teamsData && teamsData.length > 0) {
      console.log('\n🔗 NEO4J-SUPABASE MAPPING SAMPLE:');
      teamsData.slice(0, 5).forEach(team => {
        console.log(`  • ${team.name} (Supabase ID: ${team.id} ↔ Neo4j ID: ${team.neo4j_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
  }

  // === SYNCHRONIZATION ANALYSIS ===
  console.log('\n\n🔄 SYNCHRONIZATION & BACKUP STRATEGY');
  console.log('===================================');
  console.log('📋 ARCHITECTURE SUMMARY:');
  console.log('  • Neo4j: Primary graph database for entities and relationships');
  console.log('  • Supabase: Structured cache for API performance and backup');
  console.log('  • API Routes: Handle Neo4j ↔ Supabase data synchronization');
  console.log('  • Badge System: Managed in Supabase with S3 storage');
  console.log('  • Dossier Generation: Automatic in Neo4j, cached on-demand');
  
  console.log('\n🔄 DATA FLOW:');
  console.log('  1. Primary data stored in Neo4j graph structure');
  console.log('  2. API routes check Supabase cache first (performance)');
  console.log('  3. Cache miss → Query Neo4j and update Supabase');
  console.log('  4. Badge assets stored in S3, metadata in Supabase');
  console.log('  5. Generated dossiers cached in Neo4j node properties');
  
  console.log('\n💾 BACKUP STRATEGY:');
  console.log('  • Supabase serves as structured backup of key entities');
  console.log('  • Teams/Leagues tables provide relational structure');
  console.log('  • cached_entities table provides graph backup');
  console.log('  • S3 provides badge asset backup');
  console.log('  • Neo4j handles dynamic dossier generation and relationships');
}

analyzeDatabases().catch(console.error);