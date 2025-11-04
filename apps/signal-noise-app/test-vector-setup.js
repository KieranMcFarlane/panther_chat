/**
 * Simple check to see if vector search functions are available
 */

import { supabase } from './src/lib/supabase-client.ts';

async function testVectorFunction() {
  console.log('🔍 Testing vector search function...');
  
  try {
    // Create a test embedding (all zeros)
    const testEmbedding = new Array(1536).fill(0);
    
    const { data, error } = await supabase.rpc('match_entities', {
      query_embedding: testEmbedding,
      match_threshold: 0.1,
      match_count: 1
    });
    
    if (error) {
      console.log('❌ Vector function not found:', error.message);
      console.log('\n📝 You need to run the SQL schema first:');
      console.log('1. Go to: https://itlcuazbybqlkicsaola.supabase.co');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the entire contents of:');
      console.log('   lib/supabase-vector-schema.sql');
      console.log('4. Click "Run" to execute');
      console.log('\n⚠️  This is required before vector search can work!');
      return false;
    } else {
      console.log('✅ Vector search functions are ready!');
      console.log('📊 Test query returned:', data?.length || 0, 'results');
      return true;
    }
  } catch (error) {
    console.log('❌ Error testing vector function:', error.message);
    return false;
  }
}

async function testBasicConnection() {
  console.log('🔍 Testing basic Supabase connection...');
  
  try {
    // Try to access the auth endpoint
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('❌ Auth connection failed:', error.message);
      return false;
    } else {
      console.log('✅ Basic connection successful');
      return true;
    }
  } catch (error) {
    console.log('❌ Connection test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Vector Search Setup Test');
  console.log('==========================\n');
  
  const basicOk = await testBasicConnection();
  
  if (basicOk) {
    const vectorOk = await testVectorFunction();
    
    if (!vectorOk) {
      console.log('\n🛑  STOP: Vector search schema not installed');
      console.log('You must execute the SQL schema before continuing.');
    } else {
      console.log('\n✅ All systems ready! You can:');
      console.log('• npm run vector-search:init  (initialize embeddings)');
      console.log('• Test vector search via the UI');
    }
  } else {
    console.log('\n❌ Check your Supabase credentials in .env');
  }
}

main().catch(console.error);