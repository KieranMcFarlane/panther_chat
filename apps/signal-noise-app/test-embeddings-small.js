const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function testSmallBatch() {
  console.log('🧪 Testing small batch embedding...');
  
  try {
    // Get just 10 entities to test
    const { data: entities, error } = await supabase
      .from('cached_entities')
      .select('*')
      .limit(10);
      
    if (error) {
      console.error('❌ Error fetching entities:', error);
      return;
    }
    
    console.log(`📦 Processing ${entities.length} test entities...`);
    
    for (const entity of entities) {
      try {
        const properties = entity.properties || {};
        const labels = entity.labels || [];
        
        // Build text for embedding
        const textParts = [
          properties.name || `Entity ${entity.neo4j_id}`,
          labels[0]?.toLowerCase() || 'unknown',
          properties.sport || '',
          properties.country || '',
          properties.league || '',
          properties.description || ''
        ];
        
        const entityText = textParts.filter(Boolean).join(' ');
        console.log(`🧠 Embedding: ${properties.name || entity.neo4j_id}`);
        console.log(`   Text: ${entityText.substring(0, 100)}...`);
        
        // Generate embedding
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: entityText,
          encoding_format: "float"
        });
        
        const embedding = response.data[0].embedding;
        console.log(`   ✅ Generated embedding: ${embedding.length} dimensions`);
        
        // Store embedding
        const entityType = labels[0]?.toLowerCase() || 'unknown';
        const entityName = properties.name || `Entity ${entity.neo4j_id}`;
        
        const { error: insertError } = await supabase
          .from('entity_embeddings')
          .upsert({
            entity_id: entity.neo4j_id,
            entity_type: entityType,
            name: entityName,
            description: entityText,
            embedding: embedding,
            metadata: {
              labels: entity.labels,
              properties: entity.properties,
              neo4j_id: entity.neo4j_id,
              source: 'cached_entities'
            }
          }, {
            onConflict: 'entity_id'
          });
          
        if (insertError) {
          console.error(`   ❌ Error storing embedding:`, insertError);
        } else {
          console.log(`   ✅ Stored embedding successfully`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing entity ${entity.neo4j_id}:`, error.message);
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎉 Test batch complete!');
    
    // Verify count
    const { count } = await supabase
      .from('entity_embeddings')
      .select('*', { count: 'exact', head: true });
      
    console.log(`📊 Total embeddings in database: ${count}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSmallBatch().then(() => {
  console.log('\n🏁 Test finished');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});