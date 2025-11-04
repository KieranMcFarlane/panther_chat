/**
 * Script to initialize vector embeddings for existing entities
 * Run this script after setting up the Supabase vector search schema
 */

import { initializeEntityEmbeddings, storeEntityEmbedding } from '../src/lib/embeddings.ts';
import { DatabaseService } from '../src/lib/database.ts';

// Configuration
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 1000; // 1 second

async function main() {
  console.log('🚀 Initializing vector embeddings for existing entities...');
  
  try {
    // Get existing entities from the database
    const db = DatabaseService.getInstance();
    const entities = await db.getEntities();
    
    console.log(`📊 Found ${entities.length} entities in the database`);
    
    if (entities.length === 0) {
      console.log('❌ No entities found. Please make sure your Neo4j database has entities.');
      process.exit(1);
    }
    
    // Transform entities to embedding format
    const entityInputs = entities.map(entity => ({
      entity_id: entity.entity_id || entity.id,
      entity_type: entity.entity_type,
      name: entity.name || entity.title,
      description: entity.description || entity.notes,
      metadata: {
        location: entity.location,
        division_id: entity.division_id,
        role: entity.role,
        affiliation: entity.affiliation,
        tags: entity.tags,
        priority_score: entity.priority_score,
        trust_score: entity.trust_score,
        // Add any other relevant metadata
        ...entity
      }
    }));
    
    console.log('🔄 Starting embedding initialization...');
    
    // Initialize embeddings in batches
    const result = await initializeEntityEmbeddings(entityInputs);
    
    console.log(`✅ Embedding initialization complete!`);
    console.log(`   Processed: ${result.processed} entities`);
    console.log(`   Failed: ${result.failed} entities`);
    
    if (result.failed > 0) {
      console.log('⚠️  Some entities failed to process. Check the logs for details.');
    }
    
    // Test the vector search
    console.log('\n🔍 Testing vector search...');
    
    try {
      const testResults = await fetch('http://localhost:3005/api/vector-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: 'football club', 
          limit: 5,
          score_threshold: 0.1 
        }),
      });
      
      if (testResults.ok) {
        const testData = await testResults.json();
        console.log(`✅ Vector search test successful! Found ${testData.results?.length || 0} results`);
        
        if (testData.results?.length > 0) {
          console.log('Sample results:');
          testData.results.slice(0, 3).forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.name} (${result.type}) - Score: ${result.score.toFixed(3)}`);
          });
        }
      } else {
        console.log('⚠️  Vector search test failed. Make sure your API server is running.');
      }
    } catch (error) {
      console.log('⚠️  Could not test vector search. Make sure your development server is running on port 3005');
    }
    
  } catch (error) {
    console.error('❌ Error during embedding initialization:', error);
    process.exit(1);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as initializeEmbeddings };