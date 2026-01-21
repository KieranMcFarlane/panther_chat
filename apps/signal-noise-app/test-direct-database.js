// Test direct database connection to verify our fixes

require('dotenv').config({ path: '.env' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌ Missing')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌ Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDirectDatabase() {
  console.log('🔍 TESTING DIRECT DATABASE CONNECTION');
  console.log('='.repeat(60));
  
  try {
    // Get all English football teams
    const { data: teams, error } = await supabase
      .from('cached_entities')
      .select('*')
      .eq('properties->>sport', 'Football')
      .in('properties->>league', ['Premier League', 'English League Championship', 'League One', 'League Two'])
    
    if (error) {
      console.error('❌ Database error:', error)
      return
    }
    
    console.log(`📊 Total English football teams: ${teams.length}`);
    
    // Group by league
    const leagues = {};
    teams.forEach(team => {
      const league = team.properties.league;
      if (!leagues[league]) {
        leagues[league] = [];
      }
      leagues[league].push(team.properties.name);
    });
    
    console.log('\n🏆 ENGLISH FOOTBALL LEAGUES:');
    Object.entries(leagues)
      .sort(([a], [b]) => {
        const order = ['Premier League', 'English League Championship', 'League One', 'League Two'];
        const aIndex = order.findIndex(l => a === l);
        const bIndex = order.findIndex(l => b === l);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
      .forEach(([league, teamNames]) => {
        console.log(`  ${league}: ${teamNames.length} teams`);
        const uniqueTeams = [...new Set(teamNames)]; // Remove duplicates
        if (uniqueTeams.length !== teamNames.length) {
          console.log(`    ⚠️  Contains ${teamNames.length - uniqueTeams.length} duplicates`);
          uniqueTeams.sort().forEach(team => {
            console.log(`    - ${team}`);
          });
        } else {
          teamNames.sort().forEach(team => {
            console.log(`    - ${team}`);
          });
        }
      });
    
    // Check for expected totals
    const premierLeague = leagues['Premier League'] || [];
    const championship = leagues['English League Championship'] || [];
    const leagueOne = leagues['League One'] || [];
    const leagueTwo = leagues['League Two'] || [];
    
    console.log('\n✅ VERIFICATION RESULTS:');
    console.log(`Premier League: ${premierLeague.length} teams (expected: 21)`);
    console.log(`Championship: ${championship.length} teams (expected: 13)`);
    console.log(`League One: ${leagueOne.length} teams (expected: 25) ${leagueOne.length === 25 ? '✅' : '⚠️'}`);
    console.log(`League Two: ${leagueTwo.length} teams (expected: 24) ${leagueTwo.length === 24 ? '✅' : '⚠️'}`);
    
    const totalUnique = [
      ...new Set(premierLeague),
      ...new Set(championship), 
      ...new Set(leagueOne),
      ...new Set(leagueTwo)
    ].length;
    
    console.log(`Total unique teams: ${totalUnique} (expected: 83)`);
    
    if (premierLeague.length >= 21 && championship.length >= 13) {
      console.log('\n🎉 SUCCESS: Premier League and Championship coverage complete!');
      console.log('The LeagueNav dialog should now show all teams correctly.');
    } else {
      console.log('\n⚠️  ISSUE: Still missing some teams');
      console.log(`Missing Premier League: ${Math.max(0, 21 - premierLeague.length)} teams`);
      console.log(`Missing Championship: ${Math.max(0, 13 - championship.length)} teams`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectDatabase();