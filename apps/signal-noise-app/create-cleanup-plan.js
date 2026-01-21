const fs = require('fs');

// This will be a cleanup script that uses the MCP connection for Supabase operations
// First, let's analyze the data structure and then create cleanup queries

async function createCleanupQueries() {
  console.log('🧹 CACHED_ENTITIES CLEANUP QUERY GENERATOR');
  console.log('='.repeat(60));
  
  // Based on our analysis:
  // - Total entities: 4,422
  // - JSON seed entries: 268  
  // - Unique names: 4,212
  // - Duplicate entries: 210
  
  console.log('\n📊 DATA SUMMARY:');
  console.log('   • Total entities: 4,422');
  console.log('   • JSON seed entries: 268');
  console.log('   • Duplicate entries: 210');
  console.log('   • Unique names: 4,212');
  console.log('   • Expected final count: ~4,212');
  
  console.log('\n🔧 CLEANUP QUERIES:');
  
  // Query 1: Show json_seed entities
  console.log('\n1. SHOW JSON_SEED ENTITIES:');
  const jsonSeedQuery = `
SELECT 
  id,
  properties->>'name' as entity_name,
  created_at
FROM cached_entities 
WHERE properties->>'name' LIKE '%(json_seed)%'
ORDER BY properties->>'name'
LIMIT 10;`;
  
  console.log(jsonSeedQuery);
  
  // Query 2: Show duplicate entities
  console.log('\n2. SHOW DUPLICATE ENTITIES:');
  const duplicateQuery = `
SELECT 
  properties->>'name' as entity_name,
  COUNT(*) as count,
  STRING_AGG(id::TEXT, ', ') as duplicate_ids
FROM cached_entities 
WHERE properties->>'name' IN (
  SELECT properties->>'name' 
  FROM cached_entities 
  GROUP BY properties->>'name' 
  HAVING COUNT(*) > 1
)
GROUP BY properties->>'name'
ORDER BY COUNT(*) DESC
LIMIT 10;`;
  
  console.log(duplicateQuery);
  
  // Query 3: Show clean versions of json_seed entities
  console.log('\n3. SHOW CLEAN VERSIONS OF JSON_SEED ENTITIES:');
  const cleanVersionQuery = `
WITH json_seed_entities AS (
  SELECT 
    properties->>'name' as json_name,
    REPLACE(properties->>'name', ' (json_seed)', '') as clean_name
  FROM cached_entities 
  WHERE properties->>'name' LIKE '%(json_seed)%'
)
SELECT 
  jse.json_name,
  jse.clean_name,
  COUNT(ce.id) as clean_version_count,
  STRING_AGG(ce.id::TEXT, ', ') as clean_ids
FROM json_seed_entities jse
LEFT JOIN cached_entities ce ON ce.properties->>'name' = jse.clean_name
GROUP BY jse.json_name, jse.clean_name
ORDER BY clean_version_count DESC
LIMIT 10;`;
  
  console.log(cleanVersionQuery);
  
  // Query 4: Cleanup duplicates - keep newest
  console.log('\n4. CLEANUP DUPLICATES (KEEP NEWEST):');
  const cleanupDuplicatesQuery = `
WITH ranked_entities AS (
  SELECT 
    id,
    properties->>'name' as entity_name,
    ROW_NUMBER() OVER (
      PARTITION BY properties->>'name' 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM cached_entities
  WHERE properties->>'name' IN (
    SELECT properties->>'name' 
    FROM cached_entities 
    GROUP BY properties->>'name' 
    HAVING COUNT(*) > 1
  )
)
DELETE FROM cached_entities 
WHERE id IN (
  SELECT id 
  FROM ranked_entities 
  WHERE rn > 1
);`;
  
  console.log(cleanupDuplicatesQuery);
  
  // Query 5: Clean json_seed suffixes (only if no clean version exists)
  console.log('\n5. CLEAN JSON_SEED SUFFIXES:');
  const cleanJsonSeedQuery = `
WITH json_seed_entities AS (
  SELECT 
    id,
    properties->>'name' as json_name,
    REPLACE(properties->>'name', ' (json_seed)', '') as clean_name
  FROM cached_entities 
  WHERE properties->>'name' LIKE '%(json_seed)%'
),
clean_check AS (
  SELECT 
    jse.id,
    jse.json_name,
    jse.clean_name,
    COUNT(ce.id) as existing_clean_count
  FROM json_seed_entities jse
  LEFT JOIN cached_entities ce ON ce.properties->>'name' = jse.clean_name
  GROUP BY jse.id, jse.json_name, jse.clean_name
)
UPDATE cached_entities 
SET properties = jsonb_set(
  jsonb_set(properties, '{name}', to_jsonb(clean_name)),
  '{updated_at}',
  to_jsonb(NOW())
)
WHERE id IN (
  SELECT id 
  FROM clean_check 
  WHERE existing_clean_count = 1  -- Only clean json_seed if it's the only version
);`;
  
  console.log(cleanJsonSeedQuery);
  
  // Query 6: Remove remaining json_seed entries (that have clean versions)
  console.log('\n6. REMOVE REMAINING JSON_SEED ENTRIES:');
  const removeRemainingJsonSeedQuery = `
DELETE FROM cached_entities 
WHERE properties->>'name' LIKE '%(json_seed)%'
AND REPLACE(properties->>'name', ' (json_seed)', '') IN (
  SELECT DISTINCT properties->>'name' 
  FROM cached_entities 
  WHERE properties->>'name' NOT LIKE '%(json_seed)%'
);`;
  
  console.log(removeRemainingJsonSeedQuery);
  
  // Query 7: Final verification
  console.log('\n7. FINAL VERIFICATION:');
  const verificationQuery = `
SELECT 
  COUNT(*) as total_entities,
  COUNT(CASE WHEN properties->>'name' LIKE '%(json_seed)%' THEN 1 END) as json_seed_count,
  COUNT(DISTINCT properties->>'name') as unique_names,
  COUNT(*) - COUNT(DISTINCT properties->>'name') as duplicate_count
FROM cached_entities;`;
  
  console.log(verificationQuery);
  
  return {
    jsonSeedQuery,
    duplicateQuery,
    cleanVersionQuery,
    cleanupDuplicatesQuery,
    cleanJsonSeedQuery,
    removeRemainingJsonSeedQuery,
    verificationQuery
  };
}

function saveCleanupPlan(queries) {
  const cleanupPlan = {
    timestamp: new Date().toISOString(),
    summary: {
      totalEntities: 4422,
      jsonSeedEntries: 268,
      duplicateEntries: 210,
      uniqueNames: 4212,
      expectedFinalCount: 4212
    },
    queries: queries,
    executionSteps: [
      '1. Analyze current data state',
      '2. Remove duplicate entries (keep newest)',
      '3. Clean json_seed suffixes where needed',
      '4. Remove redundant json_seed entries',
      '5. Verify final data integrity'
    ]
  };
  
  fs.writeFileSync('cached_entities_cleanup_plan.json', JSON.stringify(cleanupPlan, null, 2));
  console.log('\n📄 Cleanup plan saved to: cached_entities_cleanup_plan.json');
  
  return cleanupPlan;
}

async function main() {
  console.log('🧹 GENERATING CACHED_ENTITIES CLEANUP PLAN');
  console.log('🎯 Based on analysis: 4,422 entities with 268 json_seed and 210 duplicates');
  
  const queries = await createCleanupQueries();
  const plan = saveCleanupPlan(queries);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏆 CLEANUP PLAN SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\n📋 EXECUTION STRATEGY:');
  plan.executionSteps.forEach(step => {
    console.log(step);
  });
  
  console.log('\n📈 EXPECTED RESULTS:');
  console.log(`   • Current: ${plan.summary.totalEntities} entities`);
  console.log(`   • Final: ~${plan.summary.expectedFinalCount} entities`);
  console.log(`   • Cleanup: ~${plan.summary.totalEntities - plan.summary.expectedFinalCount} entities removed`);
  console.log(`   • Improvement: ${((plan.summary.totalEntities - plan.summary.expectedFinalCount) / plan.summary.totalEntities * 100).toFixed(1)}% reduction`);
  
  console.log('\n✅ Cleanup plan generated successfully!');
  console.log('🔄 Ready to execute cleanup queries using MCP Supabase connection');
}

main().catch(console.error);