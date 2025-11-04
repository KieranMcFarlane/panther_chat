const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

// Simple text embedding function
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });
  return response.data[0].embedding;
}

console.log('🧪 Testing embedding with existing functions...');

async function testEmbedding() {
  try {
    // Fetch 5 entities to test
    const { data: entities, error } = await supabase
      .from('cached_entities')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching cached entities:', error);
      return;
    }

    console.log(`📊 Found ${entities.length} entities to test`);
    
    let successCount = 0;
    for (const entity of entities) {
      try {
        const entityName = entity.properties?.name || `Entity ${entity.id}`;
        const entityType = entity.labels?.[0]?.toLowerCase() || 'unknown';
        
        const description = [
          entityName,
          entityType,
          entity.properties?.sport || '',
          entity.properties?.country || '',
          entity.properties?.league || ''
        ].filter(Boolean).join(' ');

        console.log(`🧠 Embedding: ${entityName}`);

        // Generate embedding
        const embedding = await embedText(description);

        // Store embedding using existing function
        const { error: insertError } = await supabase.rpc('upsert_entity_embedding', {
          p_entity_id: entity.id.toString(),
          p_entity_type: entityType,
          p_name: entityName,
          p_embedding: embedding,
          p_description: description,
          p_metadata: {
            labels: entity.labels,
            properties: entity.properties,
            neo4j_id: entity.neo4j_id,
            source: 'cached_entities'
          }
        });

        if (insertError) {
          console.error(`❌ Error storing embedding for ${entityName}:`, insertError);
        } else {
          console.log(`✅ Successfully embedded: ${entityName}`);
          successCount++;
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Error processing ${entity.properties?.name || entity.id}:`, error.message);
      }
    }

    console.log(`\n✅ Successfully embedded ${successCount}/${entities.length} entities`);

    // Test search to verify embeddings work
    if (successCount > 0) {
      console.log('\n🔍 Testing search with embedded entities...');
      
      const searchQuery = 'Arsenal';
      console.log(`Searching for: "${searchQuery}"`);
      
      // Generate embedding for search query
      const searchEmbedding = await embedText(searchQuery);
      
      const { data: searchResults, error: searchError } = await supabase.rpc('match_entities', {
        query_embedding: searchEmbedding,
        entity_types: ['club', 'sportsperson', 'poi', 'tender', 'contact'],
        match_threshold: 0.2,
        match_count: 5
      });

      if (searchError) {
        console.error('❌ Search test failed:', searchError);
      } else {
        console.log('✅ Search results:');
        if (searchResults && searchResults.length > 0) {
          searchResults.forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.name} (${result.entity_type}) - ${(result.similarity * 100).toFixed(1)}% match`);
          });
        } else {
          console.log('  No results found (might be expected if no similar entities embedded)');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the test
testEmbedding().then(() => {
  console.log('\n🏁 Test finished');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});