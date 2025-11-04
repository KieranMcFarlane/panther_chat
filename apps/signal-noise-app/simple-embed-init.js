/**
 * Simple script to initialize embeddings for existing entities
 * This bypasses the Next.js import issues
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
  }
);

// Simple Neo4j connection check
async function getExistingEntities() {
  try {
    // For now, create some demo entities since we can't easily connect to Neo4j from Node
    // In a real scenario, you would fetch these from your Neo4j database
    
    const demoEntities = [
      {
        entity_id: 'arsenal_fc_001',
        entity_type: 'club',
        name: 'Arsenal FC',
        description: 'Professional football club based in London, England',
        location: 'London, England',
        division: 'Premier League',
        tags: ['football', 'premier league', 'london', 'emirates stadium']
      },
      {
        entity_id: 'chelsea_fc_002', 
        entity_type: 'club',
        name: 'Chelsea FC',
        description: 'Professional football club based in London, England',
        location: 'London, England',
        division: 'Premier League',
        tags: ['football', 'premier league', 'london', 'stamford bridge']
      },
      {
        entity_id: 'martin_odegaard_003',
        entity_type: 'sportsperson',
        name: 'Martin Ødegaard',
        description: 'Norwegian professional footballer, captain of Arsenal FC',
        role: 'Midfielder',
        club_id: 'arsenal_fc_001',
        tags: ['footballer', 'midfielder', 'norway', 'arsenal']
      },
      {
        entity_id: 'tender_premier_league_001',
        entity_type: 'tender',
        name: 'Premier League Digital Transformation',
        description: 'RFP for digital platform modernization and fan engagement solutions',
        associated_club_id: 'arsenal_fc_001',
        deadline: '2024-12-15',
        tags: ['digital transformation', 'fan engagement', 'technology']
      },
      {
        entity_id: 'contact_sports_agent_001',
        entity_type: 'contact',
        name: 'Sports Management Agency',
        description: 'Leading sports management agency representing football players',
        role: 'Agent',
        affiliation: 'Independent',
        tags: ['sports management', 'agency', 'player representation']
      }
    ];

    console.log(`📊 Using ${demoEntities.length} demo entities for testing`);
    return demoEntities;
    
  } catch (error) {
    console.error('❌ Error getting entities:', error.message);
    return [];
  }
}

function createEntityText(entity) {
  const parts = [
    `Name: ${entity.name}`,
    `Type: ${entity.entity_type}`,
  ];

  if (entity.description) {
    parts.push(`Description: ${entity.description}`);
  }

  // Add metadata fields as searchable text
  if (entity.location) parts.push(`Location: ${entity.location}`);
  if (entity.division) parts.push(`Division: ${entity.division}`);
  if (entity.role) parts.push(`Role: ${entity.role}`);
  if (entity.affiliation) parts.push(`Affiliation: ${entity.affiliation}`);
  if (entity.tags && Array.isArray(entity.tags)) {
    parts.push(`Tags: ${entity.tags.join(', ')}`);
  }

  return parts.join('. ');
}

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim().replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error.message);
    throw error;
  }
}

async function storeEntityEmbedding(entity, embedding) {
  try {
    const { error } = await supabase
      .from('entity_embeddings')
      .upsert({
        entity_id: entity.entity_id,
        entity_type: entity.entity_type,
        name: entity.name,
        description: entity.description || null,
        embedding: embedding,
        metadata: {
          location: entity.location,
          division: entity.division,
          role: entity.role,
          affiliation: entity.affiliation,
          tags: entity.tags,
          club_id: entity.club_id,
          associated_club_id: entity.associated_club_id,
          deadline: entity.deadline
        }
      }, {
        onConflict: 'entity_id,entity_type'
      });

    if (error) {
      console.error('❌ Error storing embedding:', error);
      throw error;
    }
  } catch (error) {
    console.error('❌ Failed to store embedding:', error);
    throw error;
  }
}

async function initializeEmbeddings() {
  console.log('🚀 Initializing vector embeddings for existing entities...');
  
  try {
    const entities = await getExistingEntities();
    
    if (entities.length === 0) {
      console.log('❌ No entities found to process');
      return { processed: 0, failed: 0 };
    }

    console.log(`📊 Processing ${entities.length} entities...`);
    
    let processed = 0;
    let failed = 0;

    // Process entities one by one for better error handling
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      try {
        console.log(`🔍 Processing: ${entity.name} (${i + 1}/${entities.length})`);
        
        // Generate embedding
        const entityText = createEntityText(entity);
        const embedding = await generateEmbedding(entityText);
        
        // Store embedding
        await storeEntityEmbedding(entity, embedding);
        
        processed++;
        console.log(`✅ Stored embedding for: ${entity.name}`);
        
        // Add delay to avoid rate limits
        if (i < entities.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Failed to process ${entity.name}:`, error.message);
        failed++;
      }
    }

    console.log(`\n🎉 Embedding initialization complete!`);
    console.log(`   ✅ Processed: ${processed} entities`);
    console.log(`   ❌ Failed: ${failed} entities`);
    
    return { processed, failed };
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    return { processed: 0, failed: 0 };
  }
}

async function testVectorSearch() {
  console.log('\n🧪 Testing vector search...');
  
  try {
    const testQueries = [
      'football club in London',
      'Arsenal captain', 
      'sports agent',
      'digital transformation tender'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Searching: "${query}"`);
      
      const embedding = await generateEmbedding(query);
      
      const { data, error } = await supabase.rpc('match_entities', {
        query_embedding: embedding,
        match_threshold: 0.1,
        match_count: 3
      });

      if (error) {
        console.log(`❌ Search error: ${error.message}`);
      } else {
        console.log(`✅ Found ${data?.length || 0} results:`);
        data?.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.name} (${result.entity_type}) - Score: ${result.similarity.toFixed(3)}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing search:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🔍 Supabase Vector Search Initialization');
  console.log('======================================\n');
  
  // Check environment
  if (!process.env.OPENAI_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('❌ Missing required environment variables');
    console.log('Please ensure OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
    process.exit(1);
  }
  
  // Initialize embeddings
  const result = await initializeEmbeddings();
  
  if (result.processed > 0) {
    // Test the search functionality
    await testVectorSearch();
    
    console.log('\n🎯 Vector search is now ready!');
    console.log('You can test it via:');
    console.log('• The VectorSearch component in your UI');
    console.log('• API endpoint: POST /api/vector-search');
    console.log('• Direct curl commands');
  } else {
    console.log('\n⚠️  No embeddings were created. Check the error messages above.');
  }
}

main().catch(console.error);