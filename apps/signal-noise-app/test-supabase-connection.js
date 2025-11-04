import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://signal-noise-app.iowgwvavmoxo.us-east-1.aws.neon.tech';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZ25hbC1ub2lzZS1hcHAuaW93Z3d2YXZteW94by51cy1lYXN0LTEuYXdzLm5lb24udGVjaCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzE4ODk5MDQ2LCJleHAiOjIwNDQ0NzUwNDZ9.Mg4UKokQRWkzZQK1L5YAw0yfTBw7A6bLo3YjKb_JnNk';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    // Test basic query
    console.log('📊 Testing basic query...');
    const { data, error, count } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error in basic query:', error);
      return;
    }
    
    console.log(`✅ Basic query successful. Count: ${count}`);
    
    // Test fetching a small sample
    console.log('📦 Testing sample fetch...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('cached_entities')
      .select('neo4j_id, labels, properties, badge_s3_url')
      .range(0, 4)
      .order('id');
    
    if (sampleError) {
      console.error('❌ Error in sample fetch:', sampleError);
      return;
    }
    
    console.log(`✅ Sample fetch successful. Got ${sampleData.length} entities:`);
    sampleData.forEach((entity, index) => {
      console.log(`  ${index + 1}. ${entity.properties?.name || entity.neo4j_id} (${entity.labels.join(', ')})`);
    });
    
    // Test total count with different method
    console.log('🔢 Testing count method...');
    const { count: directCount } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Direct count: ${directCount}`);
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  }
}

testSupabaseConnection();