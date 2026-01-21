require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Badge data from Neo4j that needs to be synced to Supabase
const neo4jBadgeData = [
  // Premier League teams (English Premier League)
  { name: 'Brentford FC', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/brentford-fc-badge.png' },
  { name: 'Brighton & Hove Albion', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/brighton-and-hove-albion-badge.png' },
  { name: 'Burnley', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/burnley-badge.png' },
  { name: 'Fulham', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/fulham-badge.png' },
  { name: 'Leeds United', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/leeds-united-badge.png' },
  { name: 'Sunderland', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/sunderland-badge.png' },
  { name: 'Tottenham', league: 'Premier League', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/tottenham-badge.png' },
  
  // Championship teams (English League Championship)
  { name: 'Coventry City', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/coventry-city-badge.png' },
  { name: 'Derby County', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/derby-county-badge.png' },
  { name: 'Ipswich Town', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/ipswich-town-badge.png' },
  { name: 'Middlesbrough', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/middlesbrough-badge.png' },
  { name: 'Millwall', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/millwall-badge.png' },
  { name: 'Norwich City', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/norwich-city-badge.png' },
  { name: 'Sheffield United', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/sheffield-united-badge.png' },
  { name: 'Sheffield Wednesday', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/sheffield-wednesday-badge.png' },
  { name: 'Southampton', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/southampton-badge.png' },
  { name: 'Swansea City', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/swansea-city-badge.png' },
  { name: 'Watford', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/watford-badge.png' },
  { name: 'West Bromwich Albion', league: 'English League Championship', badge_url: 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/west-bromwich-albion-badge.png' }
];

async function syncNeo4jBadgesToSupabase() {
  console.log('🔄 SYNCING NEO4J BADGE DATA TO SUPABASE');
  console.log('='.repeat(60));
  
  console.log(`📊 Syncing ${neo4jBadgeData.length} teams with badges from Neo4j to Supabase`);
  
  let syncedCount = 0;
  let errorCount = 0;
  
  for (const team of neo4jBadgeData) {
    try {
      console.log(`\n🔄 Syncing: ${team.name} (${team.league})`);
      
      // First, try to update existing entity
      const { data: updateResult, error: updateError } = await supabase
        .from('cached_entities')
        .update({ 
          badge_s3_url: team.badge_url,
          updated_at: new Date().toISOString()
        })
        .eq('properties->>name', team.name)
        .eq('properties->>sport', 'Football');
      
      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`);
      }
      
      if (updateResult.length === 0) {
        // Entity doesn't exist, insert it
        console.log(`   📝 Entity not found, inserting new record...`);
        
        const { data: insertResult, error: insertError } = await supabase
          .from('cached_entities')
          .insert({
            properties: {
              name: team.name,
              sport: 'Football',
              league: team.league,
              type: 'Club'
            },
            badge_s3_url: team.badge_url,
            cache_version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }
        
        console.log(`   ✅ Inserted new entity: ${team.name}`);
      } else {
        console.log(`   ✅ Updated existing entity: ${team.name}`);
      }
      
      syncedCount++;
      console.log(`   🏷️ Badge: ${team.badge_url}`);
      
    } catch (error) {
      console.error(`   ❌ Error syncing ${team.name}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏆 SYNC RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   • Total teams: ${neo4jBadgeData.length}`);
  console.log(`   ✅ Successfully synced: ${syncedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Success rate: ${((syncedCount / neo4jBadgeData.length) * 100).toFixed(1)}%`);
  
  return {
    total: neo4jBadgeData.length,
    synced: syncedCount,
    errors: errorCount,
    successRate: ((syncedCount / neo4jBadgeData.length) * 100).toFixed(1)
  };
}

async function verifySupabaseSync() {
  console.log('\n🔍 VERIFYING SYNC RESULTS...');
  
  try {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('properties->>name as name, properties->>league as league, badge_s3_url')
      .eq('properties->>sport', 'Football')
      .in('properties->>league', ['Premier League', 'English League Championship', 'League One', 'League Two'])
      .not('badge_s3_url', 'is', null)
      .order('properties->>league', 'properties->>name');
    
    if (error) {
      console.error('❌ Error verifying sync:', error);
      return;
    }
    
    console.log(`✅ Found ${data.length} Football entities with badges in Supabase`);
    
    // Group by league
    const byLeague = {};
    data.forEach(item => {
      const league = item.league || 'Unknown';
      if (!byLeague[league]) {
        byLeague[league] = [];
      }
      byLeague[league].push(item);
    });
    
    Object.entries(byLeague).forEach(([league, teams]) => {
      console.log(`\n📋 ${league}: ${teams.length} teams with badges`);
      teams.slice(0, 5).forEach(team => {
        console.log(`   • ${team.name}`);
      });
      if (teams.length > 5) {
        console.log(`   ... and ${teams.length - 5} more`);
      }
    });
    
    return data;
  } catch (error) {
    console.error('❌ Error in verification:', error);
    return [];
  }
}

async function main() {
  console.log('🔗 BADGE SYNC: NEO4J → SUPABASE');
  console.log('🎯 Syncing Premier League and Championship badges to fix navigator');
  
  const syncResults = await syncNeo4jBadgesToSupabase();
  const verificationData = await verifySupabaseSync();
  
  // Save results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    syncResults: syncResults,
    verificationData: verificationData
  };
  
  fs.writeFileSync('neo4j-supabase-badge-sync.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Sync report saved to: neo4j-supabase-badge-sync.json');
  
  if (syncResults.successRate >= 90) {
    console.log('\n🎉 SUCCESS! Badge sync completed successfully!');
    console.log('🚀 Navigator should now show complete Premier League and Championship coverage');
  } else {
    console.log('\n⚠️ PARTIAL SUCCESS - Some badges may not have synced properly');
  }
}

main().catch(console.error);