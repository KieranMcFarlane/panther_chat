// TEAM NAME NORMALIZATION AND CLASSIFICATION STANDARDIZATION
// Fix inconsistent naming and standardize classifications

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Normalization mappings for team names and classifications
const normalizationMappings = {
  // Football team name standardizations
  'manchester united': {
    correctName: 'Manchester United FC',
    correctType: 'Club',
    correctLeague: 'English Premier League'
  },
  'manchester city': {
    correctName: 'Manchester City FC',
    correctType: 'Club',
    correctLeague: 'English Premier League'
  },
  'liverpool': {
    correctName: 'Liverpool FC',
    correctType: 'Club',
    correctLeague: 'English Premier League'
  },
  'chelsea': {
    correctName: 'Chelsea FC',
    correctType: 'Club',
    correctLeague: 'English Premier League'
  },
  'arsenal': {
    correctName: 'Arsenal FC',
    correctType: 'Club',
    correctLeague: 'English Premier League'
  },
  'tottenham': {
    correctName: 'Tottenham Hotspur FC',
    correctType: 'Club',
    correctLeague: 'English Premier League'
  },
  'tottenham hotspur': {
    correctName: 'Tottenham Hotspur FC',
    correctType: 'Club',
    correctLeague: 'English Premier League'
  },
  'real madrid': {
    correctName: 'Real Madrid',
    correctType: 'Club',
    correctLeague: 'La Liga'
  },
  'barcelona': {
    correctName: 'Barcelona FC',
    correctType: 'Club',
    correctLeague: 'La Liga'
  },
  'fc barcelona': {
    correctName: 'Barcelona FC',
    correctType: 'Club',
    correctLeague: 'La Liga'
  },
  'atletico madrid': {
    correctName: 'Atlético Madrid',
    correctType: 'Club',
    correctLeague: 'La Liga'
  },
  'bayern munich': {
    correctName: 'Bayern Munich',
    correctType: 'Club',
    correctLeague: 'Bundesliga'
  },
  'borussia dortmund': {
    correctName: 'Borussia Dortmund',
    correctType: 'Club',
    correctLeague: 'Bundesliga'
  },
  'psg': {
    correctName: 'Paris Saint-Germain',
    correctType: 'Club',
    correctLeague: 'Ligue 1'
  },
  'paris saint-germain': {
    correctName: 'Paris Saint-Germain',
    correctType: 'Club',
    correctLeague: 'Ligue 1'
  },
  'juventus': {
    correctName: 'Juventus FC',
    correctType: 'Club',
    correctLeague: 'Serie A'
  },
  'ac milan': {
    correctName: 'AC Milan',
    correctType: 'Club',
    correctLeague: 'Serie A'
  },
  'inter milan': {
    correctName: 'Inter Milan',
    correctType: 'Club',
    correctLeague: 'Serie A'
  },
  'inter': {
    correctName: 'Inter Milan',
    correctType: 'Club',
    correctLeague: 'Serie A'
  },

  // Basketball team name standardizations
  'los angeles lakers': {
    correctName: 'Los Angeles Lakers',
    correctType: 'Sports Team',
    correctLeague: 'NBA'
  },
  'boston celtics': {
    correctName: 'Boston Celtics',
    correctType: 'Sports Team',
    correctLeague: 'NBA'
  },
  'golden state warriors': {
    correctName: 'Golden State Warriors',
    correctType: 'Sports Team',
    correctLeague: 'NBA'
  },
  'miami heat': {
    correctName: 'Miami Heat',
    correctType: 'Sports Team',
    correctLeague: 'NBA'
  },
  'new york knicks': {
    correctName: 'New York Knicks',
    correctType: 'Sports Team',
    correctLeague: 'NBA'
  },

  // Baseball team name standardizations
  'new york yankees': {
    correctName: 'New York Yankees',
    correctType: 'Club',
    correctLeague: 'MLB'
  },
  'boston red sox': {
    correctName: 'Boston Red Sox',
    correctType: 'Club',
    correctLeague: 'MLB'
  },
  'los angeles dodgers': {
    correctName: 'Los Angeles Dodgers',
    correctType: 'Club',
    correctLeague: 'MLB'
  },

  // Cricket team name standardizations
  'mumbai indians': {
    correctName: 'Mumbai Indians',
    correctType: 'Sports Entity',
    correctLeague: 'Indian Premier League'
  },
  'chennai super kings': {
    correctName: 'Chennai Super Kings',
    correctType: 'Sports Entity',
    correctLeague: 'Indian Premier League'
  },
  'royal challengers bangalore': {
    correctName: 'Royal Challengers Bangalore',
    correctType: 'Sports Entity',
    correctLeague: 'Indian Premier League'
  },
  'kolkata knight riders': {
    correctName: 'Kolkata Knight Riders',
    correctType: 'Sports Entity',
    correctLeague: 'Indian Premier League'
  }
};

// Type standardization mappings
const typeStandardizations = {
  'football club': 'Club',
  'basketball team': 'Sports Team',
  'baseball team': 'Club',
  'hockey team': 'Sports Club',
  'cricket team': 'Sports Entity',
  'soccer club': 'Club',
  'sportsclub': 'Sports Club',
  'sportsteam': 'Sports Team'
};

async function normalizeTeamNames() {
  console.log('🔧 TEAM NAME NORMALIZATION AND CLASSIFICATION STANDARDIZATION');
  console.log('=' .repeat(80));

  console.log(`\n📊 Phase 1: Fetching entities for normalization...`);
  
  // Fetch all entities that need normalization
  const { data: entities, error: fetchError } = await supabase
    .from('entities')
    .select('*')
    .or('name.ilike.%manchester%,name.ilike.%liverpool%,name.ilike.%chelsea%,name.ilike.%arsenal%,name.ilike.%tottenham%,name.ilike.%real madrid%,name.ilike.%barcelona%,name.ilike.%bayern%,name.ilike.%psg%,name.ilike.%juventus%,name.ilike.%lakers%,name.ilike.%celtics%,name.ilike.%yankees%,name.ilike.%mumbai indians%')
    .order('sport', { ascending: true });

  if (fetchError) {
    console.error('❌ Error fetching entities:', fetchError);
    return;
  }

  console.log(`📋 Found ${entities.length} entities to check for normalization`);

  let normalizedCount = 0;
  let skippedCount = 0;

  console.log(`\n🔄 Phase 2: Applying normalizations...`);

  for (const entity of entities) {
    try {
      const entityName = entity.name.toLowerCase().trim();
      let needsUpdate = false;
      let updates = {};

      // Check if entity name matches any normalization mapping
      for (const [searchTerm, mapping] of Object.entries(normalizationMappings)) {
        if (entityName.includes(searchTerm)) {
          console.log(`\n🔍 Found entity needing normalization: ${entity.name}`);
          
          // Check if name needs updating
          if (entity.name !== mapping.correctName) {
            updates.name = mapping.correctName;
            needsUpdate = true;
            console.log(`   📝 Name: ${entity.name} → ${mapping.correctName}`);
          }

          // Check if type needs updating
          if (entity.type !== mapping.correctType) {
            updates.type = mapping.correctType;
            needsUpdate = true;
            console.log(`   🏷️  Type: ${entity.type} → ${mapping.correctType}`);
          }

          // Check if league needs updating
          if (entity.league !== mapping.correctLeague) {
            updates.league = mapping.correctLeague;
            needsUpdate = true;
            console.log(`   🏆 League: ${entity.league} → ${mapping.correctLeague}`);
          }

          // Ensure sport is correct for the league
          const correctSport = getSportFromLeague(mapping.correctLeague);
          if (entity.sport !== correctSport) {
            updates.sport = correctSport;
            needsUpdate = true;
            console.log(`   ⚽ Sport: ${entity.sport} → ${correctSport}`);
          }

          // Update last_updated timestamp
          updates.last_updated = new Date().toISOString();
          updates.source = entity.source ? `${entity.source},normalization` : 'normalization';

          break;
        }
      }

      // Check for type standardizations
      const lowerType = entity.type?.toLowerCase();
      if (lowerType && typeStandardizations[lowerType]) {
        updates.type = typeStandardizations[lowerType];
        needsUpdate = true;
        console.log(`   🏷️  Type Standardization: ${entity.type} → ${updates.type}`);
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('entities')
          .update(updates)
          .eq('id', entity.id);

        if (updateError) {
          console.log(`❌ Error updating ${entity.name}: ${updateError.message}`);
          skippedCount++;
        } else {
          console.log(`✅ Successfully normalized: ${entity.name}`);
          normalizedCount++;
        }
      } else {
        console.log(`✅ ${entity.name} - Already properly formatted`);
        skippedCount++;
      }

    } catch (error) {
      console.log(`❌ Unexpected error with ${entity.name}: ${error.message}`);
      skippedCount++;
    }
  }

  console.log(`\n🎉 NORMALIZATION COMPLETE!`);
  console.log(`   ✅ Successfully Normalized: ${normalizedCount} entities`);
  console.log(`   ⚠️  Already Correct: ${skippedCount} entities`);

  return { normalizedCount, skippedCount };
}

async function standardizeInconsistentClassifications() {
  console.log(`\n🔧 Phase 3: Standardizing inconsistent classifications...`);

  // Fix entities with wrong sport assignments
  const corrections = [
    // Fix soccer entities classified as wrong sport
    { namePattern: '%premier league%', correctSport: 'Football', correctLeague: 'English Premier League' },
    { namePattern: '%la liga%', correctSport: 'Football', correctLeague: 'La Liga' },
    { namePattern: '%bundesliga%', correctSport: 'Football', correctLeague: 'Bundesliga' },
    { namePattern: '%serie a%', correctSport: 'Football', correctLeague: 'Serie A' },
    { namePattern: '%ligue 1%', correctSport: 'Football', correctLeague: 'Ligue 1' },
    
    // Fix basketball classifications
    { namePattern: '%nba%', correctSport: 'Basketball', correctLeague: 'NBA' },
    
    // Fix baseball classifications
    { namePattern: '%mlb%', correctSport: 'Baseball', correctLeague: 'MLB' },
    
    // Fix hockey classifications
    { namePattern: '%nhl%', correctSport: 'Ice Hockey', correctLeague: 'NHL' },
    
    // Fix cricket classifications
    { namePattern: '%indian premier league%', correctSport: 'Cricket', correctLeague: 'Indian Premier League' },
    { namePattern: '%ipl%', correctSport: 'Cricket', correctLeague: 'Indian Premier League' }
  ];

  let classificationFixes = 0;

  for (const correction of corrections) {
    const { data: entities, error: fetchError } = await supabase
      .from('entities')
      .select('*')
      .ilike('name', correction.namePattern)
      .neq('sport', correction.correctSport);

    if (fetchError) {
      console.log(`❌ Error fetching ${correction.namePattern}: ${fetchError.message}`);
      continue;
    }

    if (entities && entities.length > 0) {
      console.log(`\n🔍 Found ${entities.length} entities with incorrect ${correction.namePattern} classification`);
      
      for (const entity of entities) {
        const { error: updateError } = await supabase
          .from('entities')
          .update({
            sport: correction.correctSport,
            league: correction.correctLeague,
            last_updated: new Date().toISOString(),
            source: entity.source ? `${entity.source},classification_fix` : 'classification_fix'
          })
          .eq('id', entity.id);

        if (updateError) {
          console.log(`❌ Error fixing ${entity.name}: ${updateError.message}`);
        } else {
          console.log(`✅ Fixed classification: ${entity.name} → ${correction.correctSport}`);
          classificationFixes++;
        }
      }
    }
  }

  console.log(`\n📊 Classification fixes applied: ${classificationFixes}`);
  return classificationFixes;
}

function getSportFromLeague(league) {
  const sportMapping = {
    'English Premier League': 'Football',
    'Premier League': 'Football',
    'La Liga': 'Football',
    'Bundesliga': 'Football',
    'Serie A': 'Football',
    'Ligue 1': 'Football',
    'Primeira Liga': 'Football',
    'Eredivisie': 'Football',
    'Russian Premier League': 'Football',
    'MLS': 'Football',
    'NBA': 'Basketball',
    'EuroLeague': 'Basketball',
    'Liga ACB': 'Basketball',
    'Basketball Bundesliga': 'Basketball',
    'Lega Basket Serie A': 'Basketball',
    'MLB': 'Baseball',
    'Nippon Professional Baseball': 'Baseball',
    'KBO League': 'Baseball',
    'NHL': 'Ice Hockey',
    'AHL': 'Ice Hockey',
    'KHL': 'Ice Hockey',
    'Indian Premier League': 'Cricket',
    'Big Bash League': 'Cricket',
    'County Championship': 'Cricket',
    'Pakistan Super League': 'Cricket',
    'Caribbean Premier League': 'Cricket'
  };
  return sportMapping[league] || 'Unknown';
}

// Run the complete normalization process
async function runCompleteNormalization() {
  console.log('🚀 STARTING COMPREHENSIVE DATABASE NORMALIZATION');
  
  const nameNormalization = await normalizeTeamNames();
  const classificationFixes = await standardizeInconsistentClassifications();
  
  console.log(`\n🎉 COMPLETE NORMALIZATION SUMMARY!`);
  console.log(`   ✅ Name Normalizations: ${nameNormalization.normalizedCount}`);
  console.log(`   ✅ Classification Fixes: ${classificationFixes}`);
  console.log(`   📈 Total Improvements: ${nameNormalization.normalizedCount + classificationFixes}`);
  
  console.log(`\n✨ Database is now properly normalized and standardized!`);
  
  return {
    nameNormalizations: nameNormalization.normalizedCount,
    classificationFixes
  };
}

// Run the normalization
if (require.main === module) {
  runCompleteNormalization()
    .then(result => {
      console.log(`\n✨ Database normalization completed successfully!`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error in normalization:', error);
      process.exit(1);
    });
}

module.exports = { runCompleteNormalization };