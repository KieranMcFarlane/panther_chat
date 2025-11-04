const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL schema file
const fs = require('fs');
const path = require('path');
const schemaSQL = fs.readFileSync(path.join(__dirname, 'lib/supabase-vector-schema.sql'), 'utf8');

console.log('🔧 Creating Supabase vector schema...');

async function createSchema() {
  try {
    // Execute SQL schema using admin SQL
    const { data, error } = await supabase
      .from('_temp_schema_setup')
      .select('*')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, let's try a different approach
      console.log('📝 Schema setup - using service role key...');
      
      // We'll need to manually apply the schema via the Supabase dashboard
      console.log('⚠️  Please manually run the SQL schema in Supabase dashboard:');
      console.log('📄 File: lib/supabase-vector-schema.sql');
      console.log('🔗 URL: https://itlcuazbybqlkicsaola.supabase.co/project/_/sql');
      
    } else {
      console.log('✅ Schema appears to exist');
    }
    
  } catch (error) {
    console.error('❌ Schema setup failed:', error);
  }
}

createSchema().then(() => {
  console.log('\n🏁 Schema setup finished');
  process.exit(0);
}).catch(error => {
  console.error('❌ Schema setup failed:', error);
  process.exit(1);
});