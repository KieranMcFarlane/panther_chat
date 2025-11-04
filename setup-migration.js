const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createCachedEntitiesTable() {
  console.log('🔧 Creating cached_entities table...')
  
  try {
    // Create the table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS cached_entities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          neo4j_id TEXT UNIQUE NOT NULL,
          labels TEXT[] NOT NULL,
          properties JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          cache_version INTEGER DEFAULT 1
        );
        
        CREATE INDEX IF NOT EXISTS idx_cached_entities_neo4j_id ON cached_entities (neo4j_id);
        CREATE INDEX IF NOT EXISTS idx_cached_entities_labels ON cached_entities USING GIN (labels);
        CREATE INDEX IF NOT EXISTS idx_cached_entities_properties_name ON cached_entities ((properties->>'name'));
        CREATE INDEX IF NOT EXISTS idx_cached_entities_properties_type ON cached_entities ((properties->>'type'));
        CREATE INDEX IF NOT EXISTS idx_cached_entities_properties_sport ON cached_entities ((properties->>'sport'));
        CREATE INDEX IF NOT EXISTS idx_cached_entities_created_at ON cached_entities (created_at);
        
        ALTER TABLE cached_entities ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Public can view cached entities" ON cached_entities
          FOR SELECT USING (true);
          
        CREATE POLICY "Authenticated users can insert cached entities" ON cached_entities
          FOR INSERT WITH CHECK (true);
          
        CREATE POLICY "Authenticated users can update cached entities" ON cached_entities
          FOR UPDATE USING (true);
      `
    })
    
    if (error) {
      console.error('❌ Error creating table:', error)
      return false
    }
    
    console.log('✅ Table created successfully')
    return true
  } catch (error) {
    console.error('❌ Error creating table:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting migration setup...')
  
  const success = await createCachedEntitiesTable()
  
  if (success) {
    console.log('🎉 Migration setup completed successfully!')
    console.log('📝 The cached_entities table is now ready for entity migration.')
  } else {
    console.log('❌ Migration setup failed. Please check the error messages above.')
    process.exit(1)
  }
}

main().catch(console.error)