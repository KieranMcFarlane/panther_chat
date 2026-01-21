const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEntityNames() {
  console.log('🔍 Checking entity names in Supabase...\n');

  // Get all entities and filter locally
  const { data: entities, error } = await supabase
    .from('cached_entities')
    .select('neo4j_id, properties')
    .limit(4000);

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  const searchTerms = ['nürnberg', 'nurnberg', 'nrnberg', 'kaiserslautern', 'kaiserlautern', 'bundesliga', 'union berlin'];

  for (const term of searchTerms) {
    const matches = entities.filter(e => {
      const name = e.properties?.name || '';
      return name.toLowerCase().includes(term.toLowerCase());
    }).slice(0, 10);

    if (matches.length > 0) {
      console.log(`📋 Found ${matches.length} entities matching "${term}":`);
      matches.forEach(e => {
        const name = e.properties?.name || 'Unknown';
        const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        console.log(`  - ID: ${e.neo4j_id}, Name: "${name}" (normalized: "${normalized}")`);
      });
      console.log('');
    }
  }
}

checkEntityNames().catch(console.error);
