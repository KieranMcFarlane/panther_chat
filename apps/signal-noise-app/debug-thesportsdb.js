require('dotenv').config();
const fetch = require('node-fetch');

const THESPORTSDB_API_URL = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php';

async function debugTheSportsDB(teamName) {
  try {
    console.log(`\n🔍 Debugging: ${teamName}`);
    const response = await fetch(`${THESPORTSDB_API_URL}?t=${encodeURIComponent(teamName)}`);
    console.log(`Response status: ${response.status}`);
    
    const data = await response.json();
    console.log(`Response data:`, JSON.stringify(data, null, 2));
    
    if (data.teams && data.teams.length > 0) {
      const team = data.teams[0];
      console.log(`\n📊 Team data for ${teamName}:`);
      console.log(`- Name: ${team.strTeam}`);
      console.log(`- League: ${team.strLeague}`);
      console.log(`- Badge URL: ${team.strTeamBadge || 'NOT FOUND'}`);
      console.log(`- Fanart: ${team.strTeamFanart4 || 'NOT FOUND'}`);
      console.log(`- Banner: ${team.strTeamBanner || 'NOT FOUND'}`);
      console.log(`- Logo: ${team.strTeamLogo || 'NOT FOUND'}`);
    }
    
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

async function main() {
  console.log('🔍 TheSportsDB Debug Tool');
  console.log('Checking what badge/image data is available for League One teams');
  
  const testTeams = ['Barnsley', 'Portsmouth', 'Wrexham', 'Stevenage'];
  
  for (const team of testTeams) {
    await debugTheSportsDB(team);
  }
  
  // Also try by looking up all English League One teams
  console.log('\n\n🏆 Trying to lookup League One teams by league...');
  try {
    const leagueResponse = await fetch('https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=English%20League%201');
    const leagueData = await leagueResponse.json();
    
    if (leagueData.teams) {
      console.log(`Found ${leagueData.teams.length} teams in English League 1:`);
      leagueData.teams.forEach(team => {
        console.log(`- ${team.strTeam}: Badge=${team.strTeamBadge ? 'YES' : 'NO'}`);
      });
    }
  } catch (error) {
    console.error(`League lookup error:`, error.message);
  }
}

main().catch(console.error);