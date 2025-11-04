const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('❌ Missing required environment variables');
  console.error('❌ Need: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

// Embedding function
async function embedText(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error.message);
    return null;
  }
}

// Process entity data for embedding
function prepareEntityText(entity) {
  const properties = entity.properties || {};
  const labels = entity.labels || [];
  
  // Build comprehensive text for embedding
  const textParts = [
    properties.name || `Entity ${entity.neo4j_id}`,
    // Entity type from labels
    labels[0]?.toLowerCase() || 'unknown',
    // Key properties
    properties.sport || '',
    properties.country || '',
    properties.league || '',
    properties.city || '',
    properties.description || '',
    properties.about || '',
    // Additional metadata
    properties.website || '',
    properties.headquarters || '',
    properties.founded ? `Founded ${properties.founded}` : ''
  ];
  
  return textParts.filter(Boolean).join(' ');
}

// Main processing function
async function processCachedEntities() {
  console.log('🚀 Starting Supabase embedding processing...');
  
  try {
    // 1. Get total count of cached entities
    console.log('📊 Getting entity count...');
    const { count, error: countError } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error getting entity count:', countError);
      return;
    }
    
    console.log(`📊 Found ${count} entities to process`);
    
    // 2. Check existing embeddings
    const { data: existingEmbeddings, error: embedError } = await supabase
      .from('entity_embeddings')
      .select('entity_id');
      
    if (embedError) {
      console.error('❌ Error checking existing embeddings:', embedError);
      return;
    }
    
    const processedIds = new Set(existingEmbeddings?.map(e => e.entity_id) || []);
    console.log(`✅ Found ${processedIds.size} existing embeddings`);
    
    // 3. Process entities in batches
    const batchSize = 50;
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let offset = 0; offset < count; offset += batchSize) {
      console.log(`🔄 Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(count/batchSize)}...`);
      
      // Get batch of entities
      const { data: entities, error: fetchError } = await supabase
        .from('cached_entities')
        .select('*')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: false });
        
      if (fetchError) {
        console.error('❌ Error fetching batch:', fetchError);
        errors++;
        continue;
      }
      
      console.log(`📦 Processing ${entities.length} entities...`);
      
      // Process each entity
      for (const entity of entities) {
        try {
          // Skip if already processed
          if (processedIds.has(entity.neo4j_id)) {
            skipped++;
            continue;
          }
          
          // Prepare text for embedding
          const entityText = prepareEntityText(entity);
          
          if (!entityText.trim()) {
            console.log(`⚠️  Skipping empty entity: ${entity.neo4j_id}`);
            skipped++;
            continue;
          }
          
          // Generate embedding
          console.log(`🧠 Embedding: ${entity.properties?.name || entity.neo4j_id}`);
          const embedding = await embedText(entityText);
          
          if (!embedding) {
            console.error(`❌ Failed to generate embedding for ${entity.neo4j_id}`);
            errors++;
            continue;
          }
          
          // Store embedding
          const entityType = entity.labels?.[0]?.toLowerCase() || 'unknown';
          const entityName = entity.properties?.name || `Entity ${entity.neo4j_id}`;
          
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
            console.error(`❌ Error storing embedding for ${entity.neo4j_id}:`, insertError);
            errors++;
            continue;
          }
          
          processed++;
          console.log(`✅ Embedded: ${entityName} (${entityType})`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error processing entity ${entity.neo4j_id}:`, error.message);
          errors++;
        }
      }
      
      // Delay between batches
      console.log('⏸️  Batch delay...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 Embedding processing complete!');
    console.log(`📊 Results:`);
    console.log(`  ✅ Processed: ${processed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📦 Total entities: ${count}`);
    
    // 4. Verify final count
    const { count: finalCount } = await supabase
      .from('entity_embeddings')
      .select('*', { count: 'exact', head: true });
      
    console.log(`📊 Final embeddings count: ${finalCount}`);
    
  } catch (error) {
    console.error('❌ Fatal error during processing:', error);
  }
}

// Run the processor
if (require.main === module) {
  processCachedEntities().then(() => {
    console.log('\n🏁 Supabase embedding processor finished');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Embedding processor failed:', error);
    process.exit(1);
  });
}

module.exports = { processCachedEntities, prepareEntityText };