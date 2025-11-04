const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY; // Using OpenAI key for embeddings

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('Missing required environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

console.log('🔍 Checking cached entities in Supabase...');

async function embedCachedEntities() {
  try {
    // Fetch all cached entities
    const { data: entities, error } = await supabase
      .from('cached_entities')
      .select('*')
      .limit(1000); // Process 1000 at a time to avoid timeouts

    if (error) {
      console.error('❌ Error fetching cached entities:', error);
      return;
    }

    console.log(`📊 Found ${entities.length} cached entities`);
    
    if (entities.length === 0) {
      console.log('❌ No cached entities found. Need to populate cache first.');
      return;
    }

    console.log('🚀 Starting embedding process...');
    
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // Process entities in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(entities.length/batchSize)} (${batch.length} entities)`);
      
      for (const entity of batch) {
        try {
          // Check if entity already has embeddings
          const { data: existingEmbedding } = await supabase
            .from('entity_embeddings')
            .select('id')
            .eq('entity_id', entity.id)
            .single();

          if (existingEmbedding) {
            console.log(`⏭️  Skipping ${entity.properties?.name || entity.id} - already embedded`);
            skipCount++;
            continue;
          }

          // Prepare entity data for embedding
          const entityName = entity.properties?.name || `Entity ${entity.id}`;
          const entityType = entity.labels?.[0]?.toLowerCase() || 'unknown';
          
          // Create rich description for better search
          const description = [
            entityName,
            entityType,
            entity.properties?.sport || '',
            entity.properties?.country || '',
            entity.properties?.league || '',
            entity.properties?.position || '',
            entity.properties?.description || ''
          ].filter(Boolean).join(' ');

          console.log(`🧠 Embedding: ${entityName} (${entityType})`);

          // Generate embedding
          const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: description,
            encoding_format: "float"
          });

          const embedding = embeddingResponse.data[0].embedding;

          // Store embedding in Supabase using direct insert
          const { error: insertError } = await supabase
            .from('entity_embeddings')
            .upsert({
              entity_id: entity.id.toString(),
              entity_type: entityType,
              name: entityName,
              embedding: embedding,
              description: description,
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
            console.error(`❌ Error storing embedding for ${entityName}:`, insertError);
            errorCount++;
          } else {
            console.log(`✅ Embedded: ${entityName}`);
            successCount++;
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Error processing ${entity.properties?.name || entity.id}:`, error.message);
          errorCount++;
        }
      }

      // Longer delay between batches
      console.log('⏳ Waiting 1 second before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎉 Embedding Complete!');
    console.log(`✅ Successfully embedded: ${successCount} entities`);
    console.log(`⏭️  Skipped (already embedded): ${skipCount} entities`);
    console.log(`❌ Errors: ${errorCount} entities`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the embedding process
embedCachedEntities().then(() => {
  console.log('\n🏁 Embedding script finished');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});