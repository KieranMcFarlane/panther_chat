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

console.log('🧪 Testing embedding process with 5 entities...');

async function testEmbedding() {
  try {
    // Fetch just 5 entities for testing
    const { data: entities, error } = await supabase
      .from('cached_entities')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching cached entities:', error);
      return;
    }

    console.log(`📊 Found ${entities.length} entities to test`);
    
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
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: description,
          encoding_format: "float"
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Store embedding using the proper function
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
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Error processing ${entity.properties?.name || entity.id}:`, error.message);
      }
    }

    // Test search to verify embeddings work
    console.log('\n🔍 Testing search with embedded entities...');
    
    const searchQuery = 'Arsenal';
    console.log(`Searching for: "${searchQuery}"`);
    
    // Generate embedding for search query
    const searchEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: searchQuery,
      encoding_format: "float"
    });
    
    const searchEmbedding = searchEmbeddingResponse.data[0].embedding;
    
    const { data: searchResults, error: searchError } = await supabase.rpc('match_entity_embeddings', {
      query_embedding: searchEmbedding,
      match_threshold: 0.2,
      match_count: 5,
      entity_types: ['club', 'sportsperson', 'poi', 'tender', 'contact']
    });

    if (searchError) {
      console.error('❌ Search test failed:', searchError);
    } else {
      console.log('✅ Search results:');
      searchResults?.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name} (${result.entity_type}) - ${(result.score * 100).toFixed(1)}% match`);
      });
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