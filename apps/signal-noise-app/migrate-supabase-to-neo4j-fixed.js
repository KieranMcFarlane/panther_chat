import neo4j from 'neo4j-driver';

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';

// Simulated MCP functions - these will use the actual MCP calls
async function executeSupabaseQuery(query) {
  // This function would normally use the MCP Supabase execute_sql function
  // For now, let's simulate it with fetch to a local API endpoint
  try {
    const response = await fetch('http://localhost:3005/api/utils/supabase-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error(`Query failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('❌ Supabase query failed:', error);
    return [];
  }
}

// Migration script to populate Neo4j AuraDB with 4,422 entities from Supabase cache
async function migrateSupabaseToNeo4j() {
  console.log('🚀 Starting migration: Supabase (4,422 entities) -> Neo4j AuraDB');
  
  try {
    // Initialize Neo4j connection
    const driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
    );
    
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j AuraDB');
    
    const session = driver.session();
    
    try {
      // First, let's check current state
      const currentCountResult = await session.run('MATCH (n) RETURN count(n) as current');
      const currentCount = currentCountResult.records[0].get('current').toNumber();
      console.log(`📊 Current Neo4j entities: ${currentCount}`);
      
      // Clear existing entities to start fresh
      if (currentCount > 0) {
        console.log('🗑️ Clearing existing entities...');
        await session.run('MATCH (n) DETACH DELETE n');
        console.log('✅ Cleared existing entities');
      }
      
      // Setup constraints and indexes
      console.log('🔧 Setting up constraints and indexes...');
      await setupConstraintsAndIndexes(session);
      
      // Get total count first
      console.log('📊 Getting total entity count...');
      const countQuery = 'SELECT COUNT(*) as count FROM cached_entities';
      const countResult = await executeSupabaseQuery(countQuery);
      
      if (!countResult || countResult.length === 0) {
        throw new Error('Failed to get entity count from Supabase');
      }
      
      const totalEntities = countResult[0].count;
      console.log(`📊 Total entities to process: ${totalEntities}`);
      
      // Fetch entities in batches
      const BATCH_SIZE = 100;
      let totalProcessed = 0;
      let createdCount = 0;
      
      for (let offset = 0; offset < totalEntities; offset += BATCH_SIZE) {
        console.log(`📦 Processing batch ${Math.floor(offset/BATCH_SIZE) + 1}: Fetching entities ${offset} to ${Math.min(offset + BATCH_SIZE - 1, totalEntities - 1)}...`);
        
        // Fetch batch from Supabase
        const batchQuery = `
          SELECT neo4j_id, labels, properties, badge_s3_url 
          FROM cached_entities 
          ORDER BY id 
          LIMIT ${BATCH_SIZE} OFFSET ${offset}
        `;
        
        const entities = await executeSupabaseQuery(batchQuery);
        
        if (!entities || entities.length === 0) {
          console.log('📝 No more entities to process');
          break;
        }
        
        console.log(`📦 Processing ${entities.length} entities...`);
        
        // Process batch in transaction
        const tx = session.beginTransaction();
        try {
          for (const entity of entities) {
            try {
              await createEntityInNeo4j(tx, entity);
              createdCount++;
            } catch (entityError) {
              console.warn(`⚠️ Failed to create entity ${entity.neo4j_id}:`, entityError.message);
            }
          }
          
          await tx.commit();
          totalProcessed += entities.length;
          
          const progress = Math.round((totalProcessed/totalEntities)*100);
          console.log(`✅ Batch completed. Total processed: ${totalProcessed}/${totalEntities} (${progress}%)`);
          
        } catch (txError) {
          console.error(`❌ Transaction failed for batch starting at offset ${offset}:`, txError);
          await tx.rollback();
        }
      }