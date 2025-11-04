#!/bin/bash

# Supabase Table Discovery Script
# This script helps you discover and embed tables from your Supabase database

echo "🔍 Supabase Table Discovery & Embedding Tool"
echo "=========================================="

# Check environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing Supabase environment variables"
    echo "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    exit 1
fi

echo ""
echo "📋 Step 1: Discover your tables"
echo "================================"

# Create a temporary script to list tables
cat > /tmp/discover-tables.js << 'EOF'
import { supabase } from './src/lib/supabase-client.js';

async function discoverTables() {
  try {
    // Try to get table information from information_schema
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (error) {
      console.log('⚠️  Could not auto-discover tables. You may need to run the SQL helper functions first.');
      console.log('Please run lib/supabase-table-helpers.sql in your Supabase dashboard.');
      return;
    }

    if (data && data.length > 0) {
      console.log(`Found ${data.length} tables in your database:`);
      data.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.table_name}`);
      });
      
      console.log('\n📝 To embed these tables, run:');
      console.log('npm run embed:supabase ' + data.map(t => t.table_name).join(' '));
    } else {
      console.log('No tables found or access denied.');
    }
  } catch (error) {
    console.log('❌ Error discovering tables:', error.message);
  }
}

discoverTables();
EOF

echo "🔧 Running table discovery..."
node /tmp/discover-tables.js

echo ""
echo "📋 Step 2: Embed your tables"
echo "============================"

echo "Choose an option:"
echo ""
echo "A) Embed common table types (sports_entities, contacts, tenders, documents):"
echo "   npm run embed:supabase sports_entities contacts tenders documents"
echo ""
echo "B) Embed specific tables (replace with your table names):"
echo "   npm run embed:supabase table1 table2 table3"
echo ""
echo "C) Create custom table configuration:"
echo "   1. Edit scripts/embed-supabase-tables.js"
echo "   2. Add your table config to TABLE_CONFIGS"
echo "   3. Run: npm run embed:supabase your_table_name"
echo ""

echo "📋 Step 3: Test the search"
echo "=========================="
echo "After embedding, test your vector search:"
echo "curl -X POST http://localhost:3005/api/vector-search \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"query\": \"your search query\", \"limit\": 5}'"

# Clean up
rm -f /tmp/discover-tables.js

echo ""
echo "💡 Pro tip: Run the SQL helper functions in your Supabase dashboard first:"
echo "   1. Open Supabase Dashboard → SQL Editor"
echo "   2. Copy and paste lib/supabase-table-helpers.sql"
echo "   3. Click 'Run' to create helper functions"