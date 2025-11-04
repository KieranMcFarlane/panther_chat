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

// Embedding function with retry logic
async function embedText(text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float"
      });
      return response.data[0].embedding;
    } catch (error) {
      if (attempt === retries) {
        console.error(`❌ Error generating embedding after ${retries} attempts:`, error.message);
        return null;
      }
      console.log(`⚠️  Embedding attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
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

// Process entities in smaller batches with better error handling
async function processEntitiesInBatches(totalCount, batchSize = 20) {
  console.log(`🚀 Processing ${totalCount} entities in batches of ${batchSize}`);
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  // Get existing embeddings first
  console.log('📋 Checking existing embeddings...');
  const { data: existingEmbeddings, error: embedError } = await supabase
    .from('entity_embeddings')
    .select('entity_id');
    
  if (embedError) {
    console.error('❌ Error checking existing embeddings:', embedError);
    return { processed: 0, skipped: 0, errors: 1 };
  }
  
  const processedIds = new Set(existingEmbeddings?.map(e => e.entity_id) || []);
  console.log(`✅ Found ${processedIds.size} existing embeddings`);
  
  for (let offset = 0; offset < totalCount; offset += batchSize) {
    const batchNum = Math.floor(offset / batchSize) + 1;
    const totalBatches = Math.ceil(totalCount / batchSize);
    
    console.log(`\n🔄 Batch ${batchNum}/${totalBatches} (entities ${offset}-${Math.min(offset + batchSize - 1, totalCount - 1)})`);
    
    try {
      // Get batch of entities
      const { data: entities, error: fetchError } = await supabase
        .from('cached_entities')
        .select('*')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: false });
        
      if (fetchError) {
        console.error(`❌ Error fetching batch ${batchNum}:`, fetchError);
        errors += batchSize;
        continue;
      }
      
      if (!entities || entities.length === 0) {
        console.log(`⚠️  No entities in batch ${batchNum}`);
        continue;
      }
      
      // Process each entity in the batch
      const batchPromises = entities.map(async (entity) => {
        try {
          // Skip if already processed
          if (processedIds.has(entity.neo4j_id)) {
            return { status: 'skipped', entity_id: entity.neo4j_id };
          }
          
          // Prepare text for embedding
          const entityText = prepareEntityText(entity);
          
          if (!entityText.trim()) {
            console.log(`⚠️  Skipping empty entity: ${entity.neo4j_id}`);
            return { status: 'skipped', entity_id: entity.neo4j_id };
          }
          
          // Generate embedding
          const entityName = entity.properties?.name || `Entity ${entity.neo4j_id}`;
          console.log(`  🧠 ${entityName}`);
          
          const embedding = await embedText(entityText);
          
          if (!embedding) {
            return { status: 'error', entity_id: entity.neo4j_id, error: 'Failed to generate embedding' };
          }
          
          // Store embedding
          const entityType = entity.labels?.[0]?.toLowerCase() || 'unknown';
          
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
            return { status: 'error', entity_id: entity.neo4j_id, error: insertError.message };
          }
          
          return { status: 'processed', entity_id: entity.neo4j_id, name: entityName };
          
        } catch (error) {
          return { status: 'error', entity_id: entity.neo4j_id, error: error.message };
        }
      });
      
      // Wait for all entities in batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      batchResults.forEach(result => {
        if (result.status === 'processed') {
          processed++;
          console.log(`  ✅ ${result.name}`);
        } else if (result.status === 'skipped') {
          skipped++;
        } else {
          errors++;
          console.log(`  ❌ Error for ${result.entity_id}: ${result.error}`);
        }
      });
      
      // Delay between batches
      console.log(`  ⏸️  Batch ${batchNum} complete. Waiting before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Fatal error in batch ${batchNum}:`, error.message);
      errors += batchSize;
    }
  }
  
  return { processed, skipped, errors };
}

// Main processing function
async function processCachedEntities() {
  console.log('🚀 Starting Supabase embedding processing v2...');
  
  try {
    // Get total count of cached entities
    console.log('📊 Getting entity count...');
    const { count, error: countError } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error getting entity count:', countError);
      return;
    }
    
    console.log(`📊 Found ${count} entities to process\n`);
    
    // Process entities in batches
    const results = await processEntitiesInBatches(count, 20); // Smaller batches for better stability
    
    console.log('\n🎉 Embedding processing complete!');
    console.log(`📊 Results:`);
    console.log(`  ✅ Processed: ${results.processed}`);
    console.log(`  ⏭️  Skipped: ${results.skipped}`);
    console.log(`  ❌ Errors: ${results.errors}`);
    console.log(`  📦 Total entities: ${count}`);
    
    // Verify final count
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
    console.log('\n🏁 Supabase embedding processor v2 finished');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Embedding processor v2 failed:', error);
    process.exit(1);
  });
}

module.exports = { processCachedEntities, prepareEntityText };