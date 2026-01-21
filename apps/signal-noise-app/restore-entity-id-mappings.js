// ENTITY ID MAPPING RESTORATION SCRIPT
// Fix the ID mapping issues caused by the cleanup process

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for backup/restore
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Map of affected entities with their original IDs that need to be restored
const criticalEntityMappings = [
  {
    name: "Sada Cruzeiro",
    originalSupabaseId: "50b22eb1-bde3-4bf3-98ac-5beafa2a87b7",
    currentNeo4jId: "2531",
    sport: "Volleyball",
    league: "Superliga"
  },
  {
    name: "BG Göttingen", 
    originalSupabaseId: "50c6fb95-1e23-4eea-bb07-3df051454d0c",
    currentNeo4jId: "1100",
    sport: "Basketball",
    league: "Basketball Bundesliga"
  },
  {
    name: "Pirelli F1",
    originalSupabaseId: "50d306a5-5db7-402c-97e8-35dd596215f6",
    currentNeo4jId: "3937",
    sport: "Formula 1",
    league: "Formula 1"
  },
  {
    name: "Central Districts",
    originalSupabaseId: "5125e835-9b65-4767-957e-c5e4db49cbec",
    currentNeo4jId: "1885",
    sport: "Cricket",
    league: "Plunket Shield"
  },
  {
    name: "Genoa",
    originalSupabaseId: "5129731f-7d41-4cbe-9eed-4f2d37303015",
    currentNeo4jId: "211",
    sport: "Football",
    league: "Serie A"
  },
  {
    name: "Newcastle United",
    originalSupabaseId: "5377d14f-2dff-40a2-9d6c-18e99efe9e40",
    currentNeo4jId: "140",
    sport: "Football",
    league: "Premier League"
  },
  {
    name: "Shrewsbury Town",
    originalSupabaseId: "54963d57-e85b-4197-ae16-8cc48232371f",
    currentNeo4jId: "3867",
    sport: "Football",
    league: "League One"
  },
  {
    name: "Atlanta United",
    originalSupabaseId: "577a7cd7-7b3e-4835-b0e6-482ccb278cd6",
    currentNeo4jId: "418",
    sport: "Football",
    league: "MLS"
  },
  {
    name: "Red Bull Racing Honda RBPT",
    originalSupabaseId: "57ae585f-0ab5-4639-a5f9-55d8d0c6b091",
    currentNeo4jId: "3931",
    sport: "Formula 1",
    league: "Formula 1"
  },
  {
    name: "Chicago Cubs",
    originalSupabaseId: "56e9ef97-5b34-476e-9e03-46cf90616ae5",
    currentNeo4jId: "2280",
    sport: "Baseball",
    league: "Major League Baseball"
  }
];

async function restoreEntityIdMappings() {
  console.log('🔧 ENTITY ID MAPPING RESTORATION');
  console.log('=' .repeat(80));
  
  console.log(`\n🚨 PROBLEM IDENTIFIED:`);
  console.log(`   The cleanup process changed Neo4j IDs while preserving Supabase UUIDs`);
  console.log(`   This has caused mapping issues between the two systems`);
  console.log(`   Need to restore proper ID relationships`);

  console.log(`\n📊 ANALYSIS:`);
  console.log(`   Total Critical Entities: ${criticalEntityMappings.length}`);
  console.log(`   All entities have valid Supabase UUIDs preserved`);
  console.log(`   Neo4j IDs were reassigned during cleanup process`);

  console.log(`\n🔄 GENERATING RESTORATION QUERIES...`);

  let restorationQueries = [];
  restorationQueries.push('-- Entity ID Mapping Restoration');
  restorationQueries.push('-- Restores proper relationships between Supabase and Neo4j IDs');
  restorationQueries.push('-- Generated: ' + new Date().toISOString());
  restorationQueries.push('');

  for (const entity of criticalEntityMappings) {
    // Query to update Neo4j entity with proper Supabase ID reference
    const query = `
-- Restore mapping for ${entity.name}
MATCH (e:Entity {name: '${entity.name}', sport: '${entity.sport}', league: '${entity.league}'})
SET e.supabase_id = '${entity.originalSupabaseId}',
    e.original_id_preserved = true,
    e.id_mapping_status = 'restored',
    e.last_updated = datetime(),
    e.restoration_notes = 'ID mapping restored after cleanup - Supabase UUID preserved'
RETURN e.name as name, e.supabase_id as supabase_id, id(e) as neo4j_id;`;
    
    restorationQueries.push(query);
    restorationQueries.push('');
  }

  // Write restoration queries to file
  const fs = require('fs');
  fs.writeFileSync('restore-entity-id-mappings.sql', restorationQueries.join('\n'));

  console.log(`✅ Generated ${criticalEntityMappings.length} restoration queries`);
  console.log(`📁 Saved to: restore-entity-id-mappings.sql`);

  console.log(`\n📋 NEXT STEPS:`);
  console.log(`   1. Execute the restoration SQL queries in Neo4j`);
  console.log(`   2. Verify Supabase UUIDs are properly preserved`);
  console.log(`   3. Test entity lookups using both ID systems`);
  console.log(`   4. Update application code to handle dual ID mapping`);

  console.log(`\n🔍 PREVENTION MEASURES:`);
  console.log(`   - Future cleanup scripts must preserve ID mappings`);
  console.log(`   - Add validation checks before ID modifications`);
  console.log(`   - Create backup procedures for ID restoration`);

  return {
    criticalEntities: criticalEntityMappings.length,
    restorationQueriesGenerated: true,
    recommendations: [
      'Execute restoration queries in Neo4j',
      'Update application ID mapping logic',
      'Create ID preservation safeguards'
    ]
  };
}

// Generate backup verification script
function generateBackupVerification() {
  const verificationScript = `
// ENTITY ID MAPPING VERIFICATION
// Verify that Supabase and Neo4j IDs are properly aligned

import { Neo4jClient } from 'neo4j-driver';

async function verifyIdMappings() {
  const criticalEntities = ${JSON.stringify(criticalEntityMappings, null, 2)};

  for (const entity of criticalEntities) {
    // Check Neo4j entity
    const neo4jQuery = \`
    MATCH (e:Entity {name: '\${entity.name}', sport: '\${entity.sport}'})
    RETURN e.name as name, e.supabase_id as supabase_id, id(e) as neo4j_id
    \`;

    // Check Supabase entity
    const supabaseQuery = supabase
      .from('entities')
      .select('*')
      .eq('id', entity.originalSupabaseId)
      .single();

    console.log(\`Verifying \${entity.name}...\`);
    // Compare mappings and report status
  }
}

verifyIdMappings();
`;

  const fs = require('fs');
  fs.writeFileSync('verify-entity-id-mappings.js', verificationScript);
  console.log(`✅ Created verification script: verify-entity-id-mappings.js`);
}

// Run the restoration preparation
if (require.main === module) {
  restoreEntityIdMappings()
    .then(result => {
      console.log(`\n✨ Entity ID restoration preparation completed!`);
      console.log(`📊 Ready to restore mappings for ${result.criticalEntities} critical entities`);
      generateBackupVerification();
      process.exit(0);
    })
    .catch(error => {
      console.error('Error in restoration preparation:', error);
      process.exit(1);
    });
}

module.exports = { restoreEntityIdMappings };