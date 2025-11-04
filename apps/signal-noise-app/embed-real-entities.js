/**
 * Embed your actual sports entities from Supabase/Neo4j into vector search
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function embedExistingEntities() {
  console.log('🔍 Embedding your actual sports entities...');
  
  try {
    // Get your actual entities from the entities API
    console.log('📊 Fetching entities from your database...');
    
    const response = await fetch('http://localhost:3005/api/entities?limit=100');
    if (!response.ok) {
      throw new Error('Failed to fetch entities');
    }
    
    const data = await response.json();
    const entities = data.entities || [];
    
    console.log(`Found ${entities.length} entities to process`);
    
    if (entities.length === 0) {
      console.log('❌ No entities found in your database');
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    // Process first 20 entities for testing
    const entitiesToProcess = entities.slice(0, 20);
    
    for (let i = 0; i < entitiesToProcess.length; i++) {
      const entity = entitiesToProcess[i];
      const properties = entity.properties || {};
      
      try {
        console.log(`🔍 Processing: ${properties.name || 'Unknown'} (${i + 1}/${entitiesToProcess.length})`);
        
        // Create entity text for embedding
        const entityText = createEntityText(properties);
        
        // Generate embedding
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: entityText,
        });
        
        const embeddingVector = embedding.data[0].embedding;
        
        // Store in Supabase
        const { error } = await supabase
          .from('entity_embeddings')
          .upsert({
            entity_id: entity.neo4j_id,
            entity_type: getEntityType(properties),
            name: properties.name || 'Unknown Entity',
            description: properties.description || properties.notes || null,
            embedding: embeddingVector,
            metadata: {
              original_labels: entity.labels,
              location: properties.location,
              division: properties.division,
              role: properties.role,
              affiliation: properties.affiliation,
              tags: properties.tags,
              club_id: properties.club_id,
              associated_club_id: properties.associated_club_id,
              deadline: properties.deadline,
              trust_score: properties.trust_score,
              priority_score: properties.priority_score
            }
          });

        if (error) {
          console.error(`❌ Failed to store ${properties.name}:`, error.message);
          failed++;
        } else {
          processed++;
          console.log(`✅ Embedded: ${properties.name}`);
        }
        
        // Add delay to avoid rate limits
        if (i < entitiesToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${properties.name}:`, error.message);
        failed++;
      }
    }

    console.log(`\n🎉 Embedding complete!`);
    console.log(`   ✅ Processed: ${processed} entities`);
    console.log(`   ❌ Failed: ${failed} entities`);
    
    if (processed > 0) {
      console.log('\n🧪 Testing search with your real data...');
      await testRealSearch();
    }
    
    return { processed, failed };
    
  } catch (error) {
    console.error('❌ Error in embedding process:', error);
    return { processed: 0, failed: 0 };
  }
}

function createEntityText(properties) {
  const parts = [
    `Name: ${properties.name || 'Unknown'}`,
    `Type: ${getEntityType(properties)}`
  ];

  if (properties.location) parts.push(`Location: ${properties.location}`);
  if (properties.division) parts.push(`Division: ${properties.division}`);
  if (properties.role) parts.push(`Role: ${properties.role}`);
  if (properties.affiliation) parts.push(`Affiliation: ${properties.affiliation}`);
  if (properties.tags && Array.isArray(properties.tags)) {
    parts.push(`Tags: ${properties.tags.join(', ')}`);
  }
  if (properties.description) parts.push(`Description: ${properties.description}`);
  if (properties.notes) parts.push(`Notes: ${properties.notes}`);

  return parts.join('. ');
}

function getEntityType(properties) {
  // Determine entity type based on properties and labels
  const labels = properties.labels || [];
  
  if (labels.includes('Club')) return 'club';
  if (labels.includes('Sportsperson')) return 'sportsperson';
  if (labels.includes('Tender')) return 'tender';
  if (labels.includes('POI') || labels.includes('Contact')) return 'contact';
  
  // Fallback to other heuristics
  if (properties.club_id || properties.division) return 'sportsperson';
  if (properties.deadline) return 'tender';
  if (properties.role && properties.affiliation) return 'contact';
  
  return 'unknown';
}

async function testRealSearch() {
  console.log('\n🧪 Testing search with your real entities...');
  
  try {
    const testQueries = [
      'football club',
      'sports person', 
      'Premier League',
      'London'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Searching: "${query}"`);
      
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      
      const { data, error } = await supabase.rpc('match_entities', {
        query_embedding: embedding.data[0].embedding,
        match_threshold: 0.1,
        match_count: 5
      });

      if (error) {
        console.log(`❌ Search error: ${error.message}`);
      } else {
        console.log(`✅ Found ${data?.length || 0} results:`);
        data?.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.name} (${result.entity_type}) - Score: ${(result.similarity * 100).toFixed(1)}%`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing search:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Embedding Your Real Sports Entities');
  console.log('=====================================\n');
  
  const result = await embedExistingEntities();
  
  if (result.processed > 0) {
    console.log('\n✅ Your vector search now has real sports data!');
    console.log('Test it at: http://localhost:3005/simple-test');
  } else {
    console.log('\n⚠️  No entities were embedded. Check the errors above.');
  }
}

main().catch(console.error);