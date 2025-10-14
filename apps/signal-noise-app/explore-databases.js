const neo4j = require('neo4j-driver');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

async function exploreNeo4jDatabase() {
  console.log('🔍 Exploring Neo4j Database...\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // 1. Database Overview
    console.log('📊 DATABASE OVERVIEW');
    const statsResult = await session.run(`
      CALL db.info() 
      YIELD name, version, kernelVersion, storeSize, relationshipCount, nodeCount
      RETURN name, version, kernelVersion, storeSize, relationshipCount, nodeCount
    `);
    
    if (statsResult.records.length > 0) {
      const stats = statsResult.records[0];
      console.log(`Database: ${stats.get('name')}`);
      console.log(`Version: ${stats.get('version')}`);
      console.log(`Nodes: ${stats.get('nodeCount').toLocaleString()}`);
      console.log(`Relationships: ${stats.get('relationshipCount').toLocaleString()}`);
      console.log(`Store Size: ${(stats.get('storeSize') / 1024 / 1024).toFixed(2)} MB\n`);
    }

    // 2. Entity Distribution by Type
    console.log('🏷️ ENTITY DISTRIBUTION BY TYPE');
    const labelResult = await session.run(`
      CALL db.labels() YIELD label
      CALL apoc.cypher.run('MATCH (n:' + label + ') RETURN count(n) as count', {})
      YIELD value
      RETURN label, value.count as count
      ORDER BY value.count DESC
    `);
    
    console.log('Labels and counts:');
    labelResult.records.forEach(record => {
      console.log(`  ${record.get('label')}: ${record.get('count').toLocaleString()}`);
    });
    console.log();

    // 3. Dossier Data Analysis
    console.log('📋 DOSSIER DATA ANALYSIS');
    const dossierResult = await session.run(`
      MATCH (n)
      WHERE n.dossier_data IS NOT NULL
      RETURN 
        COUNT(n) as total_with_dossiers,
        COUNT(DISTINCT labels(n)) as unique_entity_types_with_dossiers
    `);
    
    if (dossierResult.records.length > 0) {
      const dossierStats = dossierResult.records[0];
      console.log(`Entities with dossier_data: ${dossierStats.get('total_with_dossiers')}`);
      console.log(`Unique entity types with dossiers: ${dossierStats.get('unique_entity_types_with_dossiers')}`);
    }
    
    // Show detailed dossier breakdown
    const detailedDossierResult = await session.run(`
      MATCH (n)
      WHERE n.dossier_data IS NOT NULL
      UNWIND labels(n) as label
      RETURN label, COUNT(n) as count
      ORDER BY count DESC
    `);
    
    console.log('Dossier breakdown by entity type:');
    detailedDossierResult.records.forEach(record => {
      console.log(`  ${record.get('label')}: ${record.get('count')}`);
    });
    console.log();

    // 4. Key Personnel and Connections
    console.log('👥 KEY PERSONNEL & CONNECTIONS');
    const personnelResult = await session.run(`
      MATCH (n)
      WHERE n.role IS NOT NULL OR n.influence_level IS NOT NULL
      RETURN 
        COUNT(n) as total_personnel,
        COUNT(DISTINCT n.role) as unique_roles,
        COUNT(DISTINCT n.influence_level) as unique_influence_levels
    `);
    
    if (personnelResult.records.length > 0) {
      const personnelStats = personnelResult.records[0];
      console.log(`Total personnel: ${personnelStats.get('total_personnel')}`);
      console.log(`Unique roles: ${personnelStats.get('unique_roles')}`);
      console.log(`Unique influence levels: ${personnelStats.get('unique_influence_levels')}`);
    }
    console.log();

    // 5. Technology Partners
    console.log('💻 TECHNOLOGY PARTNERS');
    const techPartnersResult = await session.run(`
      MATCH (n)-[r:HAS_PARTNERSHIP_WITH]-(tech)
      WHERE tech:TechnologyPartner
      RETURN 
        COUNT(DISTINCT tech) as unique_tech_partners,
        COUNT(r) as total_partnerships,
        COLLECT(DISTINCT tech.name)[0..5] as sample_partners
    `);
    
    if (techPartnersResult.records.length > 0) {
      const techStats = techPartnersResult.records[0];
      console.log(`Unique technology partners: ${techStats.get('unique_tech_partners')}`);
      console.log(`Total partnerships: ${techStats.get('total_partnerships')}`);
      console.log(`Sample partners: ${techStats.get('sample_partners').join(', ')}`);
    }
    console.log();

    // 6. Yellow Panther Connections
    console.log('🐆 YELLOW PANTHER CONNECTIONS');
    const ypResult = await session.run(`
      MATCH (entity)-[r:HAS_CONNECTION_TO]-(yp:YellowPanther)
      RETURN 
        COUNT(DISTINCT entity) as entities_connected_to_yp,
        COUNT(DISTINCT yp) as yp_team_members,
        COUNT(r) as total_connections,
        COLLECT(DISTINCT yp.name)[0..10] as yp_team
    `);
    
    if (ypResult.records.length > 0) {
      const ypStats = ypResult.records[0];
      console.log(`Entities connected to Yellow Panther: ${ypStats.get('entities_connected_to_yp')}`);
      console.log(`YP team members in database: ${ypStats.get('yp_team_members')}`);
      console.log(`Total YP connections: ${ypStats.get('total_connections')}`);
      console.log(`YP team: ${ypStats.get('yp_team').join(', ')}`);
    }
    console.log();

    // 7. Sports Coverage
    console.log('⚽ SPORTS COVERAGE');
    const sportsResult = await session.run(`
      MATCH (n)
      WHERE n.sport IS NOT NULL
      RETURN n.sport as sport, COUNT(n) as count
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('Top sports by entity count:');
    sportsResult.records.forEach(record => {
      console.log(`  ${record.get('sport')}: ${record.get('count')}`);
    });
    console.log();

    // 8. Geographic Distribution
    console.log('🌍 GEOGRAPHIC DISTRIBUTION');
    const geoResult = await session.run(`
      MATCH (n)
      WHERE n.country IS NOT NULL
      RETURN n.country as country, COUNT(n) as count
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('Top countries by entity count:');
    geoResult.records.forEach(record => {
      console.log(`  ${record.get('country')}: ${record.get('count')}`);
    });
    console.log();

    // 9. Sample High-Value Entities
    console.log('💎 HIGH-VALUE ENTITIES');
    const highValueResult = await session.run(`
      MATCH (n)
      WHERE n.priorityScore >= 80 OR n.opportunity_score >= 80
      RETURN n.name as name, n.sport as sport, 
             COALESCE(n.priorityScore, n.opportunity_score) as score,
             labels(n)[0] as type
      ORDER BY score DESC
      LIMIT 10
    `);
    
    console.log('Top high-value entities:');
    highValueResult.records.forEach(record => {
      console.log(`  ${record.get('name')} (${record.get('sport')}) - Score: ${record.get('score')} - ${record.get('type')}`);
    });

  } catch (error) {
    console.error('❌ Neo4j Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

async function exploreSupabaseCache() {
  console.log('\n\n🗄️ Exploring Supabase Cached Entities...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase credentials not found');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. Cached Entities Overview
    console.log('📊 CACHED ENTITIES OVERVIEW');
    const { count, error: countError } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Error counting cached entities:', countError.message);
    } else {
      console.log(`Total cached entities: ${count?.toLocaleString() || 0}`);
    }

    // 2. Teams and Leagues Overview
    console.log('\n⚽ TEAMS AND LEAGUES OVERVIEW');
    
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, sport, country, level, league_id, priority, opportunity_score, badge_path', { count: 'exact' });
    
    if (teamsError) {
      console.log('❌ Error fetching teams:', teamsError.message);
    } else {
      console.log(`Total teams: ${teamsData?.length.toLocaleString() || 0}`);
      
      // Sport distribution
      const sportCounts = {};
      teamsData?.forEach(team => {
        sportCounts[team.sport] = (sportCounts[team.sport] || 0) + 1;
      });
      
      console.log('Teams by sport:');
      Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count}`);
      });
      
      // High-value teams
      const highValueTeams = teamsData?.filter(team => 
        (team.priority && team.priority >= 80) || 
        (team.opportunity_score && team.opportunity_score >= 80)
      );
      console.log(`High-value teams (score >= 80): ${highValueTeams?.length || 0}`);
      
      // Badge coverage
      const teamsWithBadges = teamsData?.filter(team => team.badge_path || team.badge_s3_url);
      console.log(`Teams with badges: ${teamsWithBadges?.length || 0} (${((teamsWithBadges?.length || 0) / (teamsData?.length || 1) * 100).toFixed(1)}%)`);
    }

    const { data: leaguesData, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name, sport, country, badge_path, priority_score', { count: 'exact' });
    
    if (leaguesError) {
      console.log('❌ Error fetching leagues:', leaguesError.message);
    } else {
      console.log(`Total leagues: ${leaguesData?.length.toLocaleString() || 0}`);
      
      // Sport distribution for leagues
      const leagueSportCounts = {};
      leaguesData?.forEach(league => {
        leagueSportCounts[league.sport] = (leagueSportCounts[league.sport] || 0) + 1;
      });
      
      console.log('Leagues by sport:');
      Object.entries(leagueSportCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count}`);
      });
      
      // Badge coverage for leagues
      const leaguesWithBadges = leaguesData?.filter(league => league.badge_path || league.badge_s3_url);
      console.log(`Leagues with badges: ${leaguesWithBadges?.length || 0} (${((leaguesWithBadges?.length || 0) / (leaguesData?.length || 1) * 100).toFixed(1)}%)`);
    }

    // 3. Data Freshness
    console.log('\n📅 DATA FRESHNESS');
    
    // Check for created_at/updated_at columns in teams
    const { data: recentTeams, error: recentError } = await supabase
      .from('teams')
      .select('id, name, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentError) {
      console.log('❌ Error checking data freshness:', recentError.message);
    } else if (recentTeams && recentTeams.length > 0) {
      console.log('Most recently added teams:');
      recentTeams.forEach(team => {
        const created = new Date(team.created_at).toLocaleDateString();
        const updated = new Date(team.updated_at).toLocaleDateString();
        console.log(`  ${team.name} - Created: ${created}, Updated: ${updated}`);
      });
    }

    // 4. Entity Dossiers Table (if exists)
    console.log('\n📋 ENTITY DOSSIERS');
    
    const { data: dossiersData, error: dossiersError } = await supabase
      .from('entity_dossiers')
      .select('*', { count: 'exact', head: true });
    
    if (dossiersError) {
      console.log(`entity_dossiers table: ${dossiersError.message.includes('does not exist') ? 'Does not exist' : 'Error: ' + dossiersError.message}`);
    } else {
      console.log(`Entity dossiers count: ${dossiersData?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Supabase Error:', error.message);
  }
}

async function compareDataSources() {
  console.log('\n\n🔄 DATA SOURCE COMPARISON');
  console.log('================================');
  
  // Quick comparison based on what we've seen
  console.log('📊 SUMMARY:');
  console.log('- Neo4j: Rich graph relationships, LinkedIn analysis, dynamic dossier generation');
  console.log('- Supabase: Structured tables, badge management, API caching layer');
  console.log('- Synchronization: API routes handle Neo4j ↔ Supabase data sync');
  console.log('- Backup Strategy: Supabase serves as cache backup for Neo4j graph data');
}

async function main() {
  await exploreNeo4jDatabase();
  await exploreSupabaseCache();
  await compareDataSources();
}

main().catch(console.error);