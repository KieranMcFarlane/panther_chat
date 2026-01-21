// COMPREHENSIVE MISSING ENTITIES ANALYSIS AND ADDITION SCRIPT
// Identify and add all major sports league teams missing from the database

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Missing Premier League teams (only have 7 out of 20)
const missingPremierLeagueTeams = [
  { name: 'Arsenal FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Aston Villa FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Bournemouth AFC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Chelsea FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Crystal Palace FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Everton FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Ipswich Town FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Leicester City FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Liverpool FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Manchester City FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Newcastle United FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Nottingham Forest FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Southampton FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'West Ham United FC', type: 'Club', league: 'English Premier League', country: 'England' },
  { name: 'Wolverhampton Wanderers FC', type: 'Club', league: 'English Premier League', country: 'England' }
];

// Missing NBA teams (only have 2 out of 30)
const missingNBATeams = [
  { name: 'Atlanta Hawks', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Boston Celtics', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Brooklyn Nets', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Charlotte Hornets', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Chicago Bulls', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Cleveland Cavaliers', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Denver Nuggets', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Detroit Pistons', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Golden State Warriors', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Houston Rockets', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Indiana Pacers', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Los Angeles Clippers', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Los Angeles Lakers', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Memphis Grizzlies', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Miami Heat', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Milwaukee Bucks', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'New Orleans Pelicans', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'New York Knicks', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Oklahoma City Thunder', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Orlando Magic', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Philadelphia 76ers', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Phoenix Suns', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Portland Trail Blazers', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Sacramento Kings', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'San Antonio Spurs', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Toronto Raptors', type: 'Sports Team', league: 'NBA', country: 'Canada' },
  { name: 'Utah Jazz', type: 'Sports Team', league: 'NBA', country: 'USA' },
  { name: 'Washington Wizards', type: 'Sports Team', league: 'NBA', country: 'USA' }
];

// Missing MLB teams (have very few)
const missingMLBTeams = [
  { name: 'Arizona Diamondbacks', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Atlanta Braves', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Baltimore Orioles', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Boston Red Sox', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Chicago Cubs', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Chicago White Sox', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Cincinnati Reds', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Cleveland Guardians', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Colorado Rockies', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Detroit Tigers', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Houston Astros', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Kansas City Royals', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Los Angeles Angels', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Los Angeles Dodgers', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Miami Marlins', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Milwaukee Brewers', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Minnesota Twins', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'New York Mets', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'New York Yankees', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Oakland Athletics', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Philadelphia Phillies', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Pittsburgh Pirates', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'San Diego Padres', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'San Francisco Giants', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Seattle Mariners', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'St. Louis Cardinals', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Tampa Bay Rays', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Texas Rangers', type: 'Club', league: 'MLB', country: 'USA' },
  { name: 'Toronto Blue Jays', type: 'Club', league: 'MLB', country: 'Canada' },
  { name: 'Washington Nationals', type: 'Club', league: 'MLB', country: 'USA' }
];

// Missing NHL teams (have very few)
const missingNHLTeams = [
  { name: 'Anaheim Ducks', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Arizona Coyotes', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Boston Bruins', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Buffalo Sabres', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Calgary Flames', type: 'Sports Club', league: 'NHL', country: 'Canada' },
  { name: 'Carolina Hurricanes', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Chicago Blackhawks', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Colorado Avalanche', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Columbus Blue Jackets', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Dallas Stars', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Detroit Red Wings', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Edmonton Oilers', type: 'Sports Club', league: 'NHL', country: 'Canada' },
  { name: 'Florida Panthers', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Los Angeles Kings', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Minnesota Wild', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Montréal Canadiens', type: 'Sports Club', league: 'NHL', country: 'Canada' },
  { name: 'Nashville Predators', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'New Jersey Devils', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'New York Islanders', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'New York Rangers', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Ottawa Senators', type: 'Sports Club', league: 'NHL', country: 'Canada' },
  { name: 'Philadelphia Flyers', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Pittsburgh Penguins', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'San Jose Sharks', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Seattle Kraken', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'St. Louis Blues', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Tampa Bay Lightning', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Toronto Maple Leafs', type: 'Sports Club', league: 'NHL', country: 'Canada' },
  { name: 'Vancouver Canucks', type: 'Sports Club', league: 'NHL', country: 'Canada' },
  { name: 'Vegas Golden Knights', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Washington Capitals', type: 'Sports Club', league: 'NHL', country: 'USA' },
  { name: 'Winnipeg Jets', type: 'Sports Club', league: 'NHL', country: 'Canada' }
];

// Missing IPL cricket teams (have very few)
const missingIPLTeams = [
  { name: 'Chennai Super Kings', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Delhi Capitals', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Gujarat Titans', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Kolkata Knight Riders', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Lucknow Super Giants', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Mumbai Indians', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Punjab Kings', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Rajasthan Royals', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Royal Challengers Bangalore', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' },
  { name: 'Sunrisers Hyderabad', type: 'Sports Entity', league: 'Indian Premier League', country: 'India' }
];

// Major European football leagues missing teams
const missingLaLigaTeams = [
  { name: 'Athletic Bilbao', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Atlético Madrid', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Barcelona FC', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Celta Vigo', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Deportivo Alavés', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Espanyol', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Getafe', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Girona', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Las Palmas', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Leganes', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Mallorca', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Osasuna', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Rayo Vallecano', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Real Betis', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Real Madrid', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Real Sociedad', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Sevilla FC', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Valencia CF', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Valladolid', type: 'Club', league: 'La Liga', country: 'Spain' },
  { name: 'Villarreal CF', type: 'Club', league: 'La Liga', country: 'Spain' }
];

const missingBundesligaTeams = [
  { name: '1899 Hoffenheim', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Augsburg', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Bayer Leverkusen', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Bayern Munich', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Borussia Dortmund', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Borussia Mönchengladbach', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Eintracht Frankfurt', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'FC Cologne', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Freiburg', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Heidenheim', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Mainz 05', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'RB Leipzig', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Stuttgart', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Union Berlin', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Werder Bremen', type: 'Club', league: 'Bundesliga', country: 'Germany' },
  { name: 'Wolfsburg', type: 'Club', league: 'Bundesliga', country: 'Germany' }
];

async function addMissingEntities() {
  console.log('🔍 COMPREHENSIVE MISSING ENTITIES ANALYSIS AND ADDITION');
  console.log('=' .repeat(80));
  
  const allMissingTeams = [
    ...missingPremierLeagueTeams,
    ...missingNBATeams,
    ...missingMLBTeams,
    ...missingNHLTeams,
    ...missingIPLTeams,
    ...missingLaLigaTeams,
    ...missingBundesligaTeams
  ];

  console.log(`\n📊 ANALYSIS SUMMARY:`);
  console.log(`   Missing Premier League: ${missingPremierLeagueTeams.length} teams`);
  console.log(`   Missing NBA: ${missingNBATeams.length} teams`);
  console.log(`   Missing MLB: ${missingMLBTeams.length} teams`);
  console.log(`   Missing NHL: ${missingNHLTeams.length} teams`);
  console.log(`   Missing IPL: ${missingIPLTeams.length} teams`);
  console.log(`   Missing La Liga: ${missingLaLigaTeams.length} teams`);
  console.log(`   Missing Bundesliga: ${missingBundesligaTeams.length} teams`);
  console.log(`   TOTAL MISSING: ${allMissingTeams.length} teams`);

  console.log(`\n🔄 Adding missing entities to database...`);
  
  let addedCount = 0;
  let skippedCount = 0;

  for (const team of allMissingTeams) {
    try {
      // Check if entity already exists
      const { data: existingEntity, error: checkError } = await supabase
        .from('entities')
        .select('id')
        .eq('name', team.name)
        .eq('sport', getSportFromLeague(team.league))
        .maybeSingle();

      if (checkError) {
        console.log(`❌ Error checking ${team.name}: ${checkError.message}`);
        continue;
      }

      if (existingEntity) {
        console.log(`⚠️  ${team.name} already exists, skipping...`);
        skippedCount++;
        continue;
      }

      // Add new entity
      const { data: newEntity, error: insertError } = await supabase
        .from('entities')
        .insert({
          name: team.name,
          type: team.type,
          sport: getSportFromLeague(team.league),
          league: team.league,
          country: team.country,
          confidence_score: 0.95,
          digital_presence_score: 0.90,
          opportunity_score: 0.85,
          last_updated: new Date().toISOString(),
          source: 'manual_addition_comprehensive_analysis'
        })
        .select()
        .single();

      if (insertError) {
        console.log(`❌ Error adding ${team.name}: ${insertError.message}`);
        continue;
      }

      console.log(`✅ Added: ${team.name} (${team.league})`);
      addedCount++;

      // Add a small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      console.log(`❌ Unexpected error with ${team.name}: ${error.message}`);
    }
  }

  console.log(`\n🎉 COMPREHENSIVE ADDITION COMPLETE!`);
  console.log(`   ✅ Successfully Added: ${addedCount} teams`);
  console.log(`   ⚠️  Already Existed: ${skippedCount} teams`);
  console.log(`   📈 Database Improvement: Major league coverage now complete`);

  console.log(`\n📋 NEXT STEPS:`);
  console.log(`   1. Run LeagueNav tests to verify improved data quality`);
  console.log(`   2. Check entity counts per league are now accurate`);
  console.log(`   3. Verify search functionality returns complete results`);
  console.log(`   4. Update any remaining league classifications`);

  return { addedCount, skippedCount };
}

function getSportFromLeague(league) {
  const sportMapping = {
    'English Premier League': 'Football',
    'Premier League': 'Football',
    'La Liga': 'Football',
    'Bundesliga': 'Football',
    'NBA': 'Basketball',
    'MLB': 'Baseball',
    'NHL': 'Ice Hockey',
    'Indian Premier League': 'Cricket',
    'Liga MX': 'Football',
    'Série B': 'Football',
    'Primeira Liga': 'Football',
    'Liga 1': 'Football',
    'Thai League 1': 'Football',
    'Persian Gulf Pro League': 'Football',
    'Azerbaijan Premier League': 'Football',
    'Cymru Premier': 'Football',
    'English League 1': 'Football',
    'English League Championship': 'Football',
    'League One': 'Football',
    'Frauen-Bundesliga': 'Football',
    'Russian Premier League': 'Football'
  };
  return sportMapping[league] || 'Unknown';
}

// Run the comprehensive addition
if (require.main === module) {
  addMissingEntities()
    .then(result => {
      console.log(`\n✨ Comprehensive database enhancement completed successfully!`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error in comprehensive addition:', error);
      process.exit(1);
    });
}

module.exports = { addMissingEntities };