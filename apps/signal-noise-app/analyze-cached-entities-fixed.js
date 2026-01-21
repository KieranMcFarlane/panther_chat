require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeDataQuality() {
  console.log('🔍 ANALYZING CACHED_ENTITIES DATA QUALITY');
  console.log('='.repeat(60));
  
  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting total count:', countError);
      return null;
    }
    
    console.log(`📊 Total entities: ${totalCount}`);
    
    // Count json_seed entries
    const { count: jsonSeedCount, error: jsonError } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true })
      .like('properties->>name', '%(json_seed)%');
    
    if (jsonError) {
      console.error('❌ Error getting json_seed count:', jsonError);
      return null;
    }
    
    console.log(`🌱 JSON seed entries: ${jsonSeedCount}`);
    
    // Get all names to find duplicates
    const { data: allNames, error: namesError } = await supabase
      .from('cached_entities')
      .select('properties->>name')
      .not('properties->>name', 'is', null);
    
    if (namesError) {
      console.error('❌ Error getting names:', namesError);
      return null;
    }
    
    // Process names to find duplicates
    const nameList = allNames.map(item => item['properties->>name']);
    const uniqueNameCount = [...new Set(nameList)].length;
    const duplicateCount = totalCount - uniqueNameCount;
    
    console.log(`🏷️  Unique names: ${uniqueNameCount}`);
    console.log(`🔄 Duplicates: ${duplicateCount}`);
    
    return {
      total: totalCount,
      jsonSeed: jsonSeedCount,
      duplicates: duplicateCount,
      unique: uniqueNameCount
    };
  } catch (error) {
    console.error('❌ Error in analyzeDataQuality:', error);
    return null;
  }
}

async function getJsonSeedSample() {
  console.log('\n🌱 GETTING JSON SEED SAMPLE...');
  
  try {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('id, properties->>name as name, created_at')
      .like('properties->>name', '%(json_seed)%')
      .order('created_at')
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching json_seed entities:', error);
      return [];
    }
    
    console.log(`✅ Found sample of ${data.length} json_seed entities`);
    
    console.log('\n📝 Sample json_seed entities:');
    data.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      console.log(`   ${item.name} (${date})`);
    });
    
    return data;
  } catch (error) {
    console.error('❌ Error in getJsonSeedSample:', error);
    return [];
  }
}

async function getDuplicateSample() {
  console.log('\n🔄 GETTING DUPLICATE SAMPLE...');
  
  try {
    // Get a sample of entities to check for duplicates
    const { data, error } = await supabase
      .from('cached_entities')
      .select('properties->>name as name, id, created_at')
      .not('properties->>name', 'is', null)
      .order('properties->>name')
      .limit(50);
    
    if (error) {
      console.error('❌ Error fetching sample:', error);
      return {};
    }
    
    // Group by name to find duplicates
    const grouped = {};
    data.forEach(item => {
      const name = item.name;
      if (!grouped[name]) {
        grouped[name] = [];
      }
      grouped[name].push(item);
    });
    
    // Find duplicates
    const duplicates = {};
    Object.keys(grouped).forEach(name => {
      if (grouped[name].length > 1) {
        duplicates[name] = grouped[name];
      }
    });
    
    const duplicateCount = Object.keys(duplicates).length;
    
    console.log(`✅ Found ${duplicateCount} duplicate names in sample`);
    
    if (duplicateCount > 0) {
      console.log('\n📝 Sample duplicates:');
      Object.entries(duplicates).slice(0, 5).forEach(([name, entries]) => {
        console.log(`   ${name}: ${entries.length} entries`);
        entries.forEach(entry => {
          const date = new Date(entry.created_at).toISOString().split('T')[0];
          console.log(`     • ${entry.id} (${date})`);
        });
      });
    }
    
    return duplicates;
  } catch (error) {
    console.error('❌ Error in getDuplicateSample:', error);
    return {};
  }
}

async function checkFootballEntities() {
  console.log('\n⚽ CHECKING FOOTBALL ENTITIES...');
  
  try {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('properties->>name as name, properties->>league as league, badge_s3_url')
      .eq('properties->>sport', 'Football')
      .not('properties->>name', 'is', null)
      .order('properties->>name')
      .limit(20);
    
    if (error) {
      console.error('❌ Error fetching football entities:', error);
      return [];
    }
    
    console.log(`✅ Sample football entities:`);
    data.forEach(item => {
      const hasBadge = item.badge_s3_url ? '🏷️' : '❌';
      console.log(`   ${hasBadge} ${item.name} (${item.league || 'No league'})`);
    });
    
    // Check for json_seed in football
    const footballJsonSeed = data.filter(item => item.name.includes('(json_seed)'));
    if (footballJsonSeed.length > 0) {
      console.log(`\n🌱 Football json_seed entities (${footballJsonSeed.length}):`);
      footballJsonSeed.forEach(item => {
        console.log(`   • ${item.name} (${item.league || 'No league'})`);
      });
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error in checkFootballEntities:', error);
    return [];
  }
}

async function generateCleanupSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('🏆 DATA CLEANUP SUMMARY');
  console.log('='.repeat(80));
  
  const analysis = await analyzeDataQuality();
  const jsonSample = await getJsonSeedSample();
  const duplicateSample = await getDuplicateSample();
  const footballEntities = await checkFootballEntities();
  
  if (!analysis) {
    console.log('❌ Could not complete analysis due to errors');
    return;
  }
  
  console.log('\n📊 CURRENT STATE:');
  console.log(`   • Total entities: ${analysis.total}`);
  console.log(`   • JSON seed entries: ${analysis.jsonSeed}`);
  console.log(`   • Duplicate entries: ${analysis.duplicates}`);
  console.log(`   • Unique names: ${analysis.unique}`);
  
  console.log('\n🎯 CLEANUP RECOMMENDATIONS:');
  
  if (analysis.jsonSeed > 0) {
    console.log(`\n1. REMOVE (json_seed) SUFFIXES`);
    console.log(`   • Found ${analysis.jsonSeed} entries with (json_seed) suffix`);
    console.log(`   • Remove suffix to clean up entity names`);
    console.log(`   • Most of these are likely duplicate entries`);
  }
  
  if (analysis.duplicates > 0) {
    console.log(`\n2. RESOLVE DUPLICATE ENTITIES`);
    console.log(`   • Found ${analysis.duplicates} duplicate entries`);
    console.log(`   • Keep newest or most complete version`);
    console.log(`   • Remove older/incomplete duplicates`);
  }
  
  const estimatedCleanup = analysis.jsonSeed + analysis.duplicates;
  const estimatedFinal = analysis.unique;
  const spaceSaved = ((estimatedCleanup / analysis.total) * 100).toFixed(1);
  
  console.log(`\n📈 EXPECTED IMPROVEMENT:`);
  console.log(`   • Entries to clean up: ~${estimatedCleanup}`);
  console.log(`   • Final entity count: ~${estimatedFinal}`);
  console.log(`   • Storage reduction: ~${spaceSaved}%`);
  
  return {
    analysis,
    recommendations: {
      jsonSeedToClean: analysis.jsonSeed,
      duplicatesToResolve: analysis.duplicates,
      estimatedCleanup,
      estimatedFinal,
      spaceSavedPercent: spaceSaved
    }
  };
}

async function main() {
  console.log('🧹 CACHED_ENTITIES DATA CLEANUP ANALYSIS');
  console.log('🎯 Analyzing duplicates and (json_seed) entries for cleanup');
  
  const summary = await generateCleanupSummary();
  
  // Save analysis to file
  const fs = require('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    analysis: summary
  };
  
  fs.writeFileSync('cached_entities_cleanup_report.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed analysis saved to: cached_entities_cleanup_report.json');
  
  console.log('\n✅ Analysis complete! Ready to proceed with cleanup implementation.');
}

main().catch(console.error);