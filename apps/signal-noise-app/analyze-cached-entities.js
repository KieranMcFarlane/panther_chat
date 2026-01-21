require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeDuplicates() {
  console.log('🔍 ANALYZING CACHED_ENTITIES DATA QUALITY');
  console.log('='.repeat(60));
  
  // Get total count
  const { count: totalCount } = await supabase
    .from('cached_entities')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total entities: ${totalCount}`);
  
  // Count json_seed entries
  const { count: jsonSeedCount } = await supabase
    .from('cached_entities')
    .select('*', { count: 'exact', head: true })
    .like('properties->>name', '%(json_seed)%');
  
  console.log(`🌱 JSON seed entries: ${jsonSeedCount}`);
  
  // Get unique names count
  const { data: uniqueNames } = await supabase
    .from('cached_entities')
    .select('properties->>name')
    .not('properties->>name', 'is', null);
  
  const uniqueNameCount = [...new Set(uniqueNames.map(item => item['properties->>name']))].length;
  const duplicateCount = totalCount - uniqueNameCount;
  
  console.log(`🏷️  Unique names: ${uniqueNameCount}`);
  console.log(`🔄 Duplicates: ${duplicateCount}`);
  
  console.log(`\n📋 Summary:`);
  console.log(`   • ${totalCount} total entries`);
  console.log(`   • ${jsonSeedCount} entries with (json_seed) suffix`);
  console.log(`   • ${duplicateCount} duplicate entries`);
  console.log(`   • ${uniqueNameCount} unique entity names`);
  
  return {
    total: totalCount,
    jsonSeed: jsonSeedCount,
    duplicates: duplicateCount,
    unique: uniqueNameCount
  };
}

async function getJsonSeedEntities() {
  console.log('\n🌱 GETTING JSON SEED ENTITIES...');
  
  const { data, error } = await supabase
    .from('cached_entities')
    .select('id, properties->>name as name, created_at')
    .like('properties->>name', '%(json_seed)%')
    .order('created_at');
  
  if (error) {
    console.error('❌ Error fetching json_seed entities:', error);
    return [];
  }
  
  console.log(`✅ Found ${data.length} json_seed entities`);
  
  // Show sample
  console.log('\n📝 Sample json_seed entities:');
  data.slice(0, 5).forEach(item => {
    console.log(`   ${item.name} (ID: ${item.id})`);
  });
  
  return data;
}

async function getDuplicateEntities() {
  console.log('\n🔄 GETTING DUPLICATE ENTITIES...');
  
  // Get all entities that have duplicates
  const { data, error } = await supabase
    .from('cached_entities')
    .select('properties->>name as name, id, created_at')
    .not('properties->>name', 'is', null)
    .order('properties->>name');
  
  if (error) {
    console.error('❌ Error fetching entities:', error);
    return [];
  }
  
  // Group by name
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
  const totalDuplicateEntries = Object.values(duplicates).reduce((sum, group) => sum + group.length, 0);
  
  console.log(`✅ Found ${duplicateCount} names with ${totalDuplicateEntries} total duplicate entries`);
  
  // Show sample duplicates
  console.log('\n📝 Sample duplicates:');
  Object.entries(duplicates).slice(0, 5).forEach(([name, entries]) => {
    console.log(`   ${name}: ${entries.length} entries`);
    entries.forEach(entry => {
      const date = new Date(entry.created_at).toISOString().split('T')[0];
      console.log(`     • ${entry.id} (${date})`);
    });
  });
  
  return duplicates;
}

async function checkForCleanVersions(jsonSeedEntities, duplicates) {
  console.log('\n🧹 CHECKING FOR CLEAN VERSIONS...');
  
  let cleanVersionsFound = 0;
  let missingCleanVersions = 0;
  
  // Check json_seed entities for clean versions
  console.log('\n🌱 Checking json_seed entities...');
  for (const entity of jsonSeedEntities) {
    const cleanName = entity.name.replace(' (json_seed)', '');
    
    const { count } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true })
      .eq('properties->>name', cleanName);
    
    if (count > 0) {
      cleanVersionsFound++;
      console.log(`   ✅ ${cleanName} - has ${count} clean version(s)`);
    } else {
      missingCleanVersions++;
      console.log(`   ❌ ${cleanName} - NO clean version found`);
    }
  }
  
  // Check duplicates for potential clean versions
  console.log('\n🔄 Checking duplicate entities...');
  Object.entries(duplicates).forEach(([name, entries]) => {
    // Skip if this is already a json_seed entity
    if (name.includes('(json_seed)')) return;
    
    const cleanName = name;
    console.log(`   🔄 ${name}: ${entries.length} duplicates`);
    entries.forEach(entry => {
      const date = new Date(entry.created_at).toISOString().split('T')[0];
      console.log(`     • ${entry.id} (${date})`);
    });
  });
  
  console.log(`\n📊 Clean Version Summary:`);
  console.log(`   • ${cleanVersionsFound} json_seed entities have clean versions`);
  console.log(`   • ${missingCleanVersions} json_seed entities missing clean versions`);
  
  return {
    cleanVersionsFound,
    missingCleanVersions
  };
}

async function generateCleanupPlan() {
  console.log('\n📋 GENERATING CLEANUP PLAN...');
  
  const analysis = await analyzeDuplicates();
  const jsonSeedEntities = await getJsonSeedEntities();
  const duplicateEntities = await getDuplicateEntities();
  const cleanVersions = await checkForCleanVersions(jsonSeedEntities, duplicateEntities);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏆 CLEANUP RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  console.log('\n🎯 PRIORITY 1: Remove (json_seed) entries that have clean versions');
  console.log(`   • ${cleanVersions.cleanVersionsFound} entries can be safely removed`);
  console.log(`   • These are duplicates of clean entities`);
  
  console.log('\n🎯 PRIORITY 2: Remove (json_seed) entries that need renaming');
  console.log(`   • ${cleanVersions.missingCleanVersions} entries need to be renamed`);
  console.log(`   • Remove '(json_seed)' suffix and keep as clean entity`);
  
  console.log('\n🎯 PRIORITY 3: Resolve duplicate entities');
  console.log(`   • ${Object.keys(duplicateEntities).length} entity names have duplicates`);
  console.log(`   • Keep newest version or most complete data`);
  console.log(`   • Remove older/incomplete duplicates`);
  
  const totalToRemove = cleanVersions.cleanVersionsFound + (Object.values(duplicateEntities).reduce((sum, group) => sum + group.length - 1, 0));
  const expectedFinalCount = analysis.unique + cleanVersions.missingCleanVersions;
  
  console.log(`\n📊 EXPECTED RESULTS:`);
  console.log(`   • Current: ${analysis.total} entries`);
  console.log(`   • To remove: ~${totalToRemove} entries`);
  console.log(`   • Final count: ~${expectedFinalCount} entries`);
  console.log(`   • Space saved: ~${((totalToRemove / analysis.total) * 100).toFixed(1)}%`);
  
  return {
    analysis,
    jsonSeedEntities,
    duplicateEntities,
    cleanVersions,
    recommendations: {
      totalToRemove,
      expectedFinalCount,
      spaceSavedPercent: ((totalToRemove / analysis.total) * 100).toFixed(1)
    }
  };
}

async function main() {
  console.log('🧹 CACHED_ENTITIES DATA CLEANUP ANALYSIS');
  console.log('🎯 Analyzing duplicates and (json_seed) entries for cleanup');
  
  const cleanupPlan = await generateCleanupPlan();
  
  // Save analysis to file
  const fs = require('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    analysis: cleanupPlan
  };
  
  fs.writeFileSync('cached_entities_cleanup_analysis.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed analysis saved to: cached_entities_cleanup_analysis.json');
  
  console.log('\n🎉 Analysis complete! Ready to proceed with cleanup implementation.');
}

main().catch(console.error);