require('dotenv').config();
const neo4j = require('neo4j-driver');

// Complete list of current Premier League teams (2024/25 season)
const allPremierLeagueTeams = [
  'Arsenal', 'Manchester United', 'Manchester City', 'Liverpool', 
  'Chelsea', 'Tottenham Hotspur', 'Aston Villa', 'West Ham United',
  'Crystal Palace', 'Leicester City', 'Everton', 'Wolverhampton Wanderers',
  'Nottingham Forest', 'Brighton & Hove Albion', 'Fulham', 'Bournemouth',
  'Brentford FC', 'Burnley FC', 'Southampton FC', 'Sheffield United',
  'Luton Town', 'Leeds United'
];

async function findMissingPremierLeagueTeams() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    console.log('🔍 FINDING MISSING PREMIER LEAGUE TEAMS\n');
    
    // Check all Premier League teams
    console.log('📋 Checking all Premier League teams...');
    
    const teamsWithBadges = [];
    const teamsWithoutBadges = [];
    const teamsNotFound = [];
    
    for (const teamName of allPremierLeagueTeams) {
      const result = await session.run(
        "MATCH (e:Entity) WHERE e.name = $name RETURN e.name as name, e.badge_url as badgeUrl",
        { name: teamName }
      );
      
      if (result.records.length > 0) {
        const record = result.records[0];
        const name = record.get('name');
        const badge = record.get('badgeUrl');
        
        if (badge) {
          teamsWithBadges.push({ name, badge });
        } else {
          teamsWithoutBadges.push({ name });
        }
      } else {
        teamsNotFound.push({ name: teamName });
      }
    }
    
    console.log(`\n✅ Teams WITH badges (${teamsWithBadges.length}):`);
    teamsWithBadges.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.name}`);
    });
    
    console.log(`\n❌ Teams WITHOUT badges (${teamsWithoutBadges.length}):`);
    teamsWithoutBadges.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.name} - Found in Neo4j, no badge`);
    });
    
    console.log(`\n❌ Teams NOT FOUND in Neo4j (${teamsNotFound.length}):`);
    teamsNotFound.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.name} - Not in database`);
    });
    
    // Also search for teams with "Premier League" mentioned
    console.log('\n🔍 Searching for entities with "Premier League" in properties...');
    const plResult = await session.run(
      "MATCH (e:Entity) WHERE e.league = 'Premier League' OR e.division = 'Premier League' RETURN e.name as name, e.badge_url as badgeUrl LIMIT 20"
    );
    
    if (plResult.records.length > 0) {
      console.log(`Found ${plResult.records.length} entities with Premier League mentioned:`);
      plResult.records.forEach((record, index) => {
        const name = record.get('name');
        const badge = record.get('badgeUrl');
        const status = badge ? 'HAS BADGE' : 'NO BADGE';
        console.log(`   ${index + 1}. ${status} ${name}`);
      });
    }
    
    return {
      withBadges: teamsWithBadges.length,
      withoutBadges: teamsWithoutBadges.length,
      notFound: teamsNotFound.length,
      teamsWithoutBadges: teamsWithoutBadges,
      teamsNotFound: teamsNotFound
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  } finally {
    await session.close();
    await driver.close();
  }
}

findMissingPremierLeagueTeams();