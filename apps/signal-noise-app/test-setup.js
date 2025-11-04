/**
 * Quick test to verify Supabase connection and check if vector schema exists
 */

import { supabase } from './src/lib/supabase-client.ts';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'entity_embeddings');
    
    if (error) {
      console.log('❌ Connection error:', error.message);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log('✅ entity_embeddings table exists');
      
      // Test if vector functions exist
      try {
        const { data: funcTest, error: funcError } = await supabase
          .rpc('match_entities', {
            query_embedding: new Array(1536).fill(0),
            match_threshold: 0.1,
            match_count: 1
          });
        
        if (funcError) {
          console.log('⚠️  match_entities function not found:', funcError.message);
          console.log('📝 You need to run the SQL schema in Supabase dashboard');
          return false;
        } else {
          console.log('✅ Vector search functions are ready');
          return true;
        }
      } catch (e) {
        console.log('⚠️  Vector functions not available - need to run schema');
        return false;
      }
    } else {
      console.log('⚠️  entity_embeddings table not found - need to run schema');
      return false;
    }
  } catch (error) {
    console.log('❌ Connection test failed:', error.message);
    return false;
  }
}

// Check existing tables
async function listExistingTables() {
  console.log('\n📋 Checking existing tables...');
  
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (error) {
      console.log('❌ Could not list tables:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log(`Found ${data.length} tables:`);
      data.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.table_name}`);
      });
    } else {
      console.log('No tables found');
    }
  } catch (error) {
    console.log('❌ Error listing tables:', error.message);
  }
}

async function main() {
  console.log('🚀 Supabase Vector Search Setup Check');
  console.log('=====================================\n');
  
  const isReady = await testSupabaseConnection();
  await listExistingTables();
  
  if (!isReady) {
    console.log('\n📝 Setup Required:');
    console.log('1. Open Supabase Dashboard: https://itlcuazbybqlkicsaola.supabase.co');
    console.log('2. Go to SQL Editor');
    console.log('3. Copy contents of lib/supabase-vector-schema.sql');
    console.log('4. Click "Run" to execute');
    console.log('\nAfter running the schema, test again with:');
    console.log('node test-setup.js');
  } else {
    console.log('\n✅ Setup complete! You can now:');
    console.log('1. Initialize embeddings: npm run vector-search:init');
    console.log('2. Test vector search with the API');
  }
}

main().catch(console.error);