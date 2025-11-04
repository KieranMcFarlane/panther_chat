#!/bin/bash

# Supabase Vector Search Setup Script
# This script helps set up the vector search functionality with Supabase

echo "🚀 Setting up Supabase Vector Search..."

# Check if required environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing Supabase environment variables. Please set:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Missing OPENAI_API_KEY environment variable"
    exit 1
fi

echo "✅ Environment variables check passed"

# Install required dependencies
echo "📦 Installing dependencies..."
npm install openai @supabase/supabase-js

echo "🔧 Setting up database schema..."

# Execute the SQL schema
psql "$SUPABASE_DATABASE_URL" -f lib/supabase-vector-schema.sql 2>/dev/null || {
    echo "⚠️  Could not execute SQL directly. Please run the SQL manually in your Supabase dashboard:"
    echo "   1. Go to Supabase Dashboard > SQL Editor"
    echo "   2. Copy and paste the contents of lib/supabase-vector-schema.sql"
    echo "   3. Click 'Run' to execute the schema"
}

echo "🔍 Testing vector search functionality..."

# Test the API endpoint
echo "Testing /api/vector-search endpoint..."
curl -X POST http://localhost:3005/api/vector-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test search", "limit": 3}' \
  2>/dev/null || {
    echo "⚠️  Could not test API endpoint. Make sure your development server is running on port 3005"
}

echo ""
echo "✅ Setup complete! Here's what was configured:"
echo ""
echo "   • Database schema with pgvector extension"
echo "   • Entity embeddings table with vector search"
echo "   • API endpoints updated to use Supabase"
echo "   • VectorSearch component updated"
echo ""
echo "📝 Next steps:"
echo "   1. Run the SQL schema in your Supabase dashboard"
echo "   2. Initialize entity embeddings using the initializeEntityEmbeddings function"
echo "   3. Test the vector search functionality"
echo ""
echo "💡 Example usage:"
echo "   import { initializeEntityEmbeddings } from '@/lib/embeddings';"
echo "   import { searchEntityEmbeddings } from '@/lib/embeddings';"
echo ""
echo "   // Initialize embeddings for existing entities"
echo "   await initializeEntityEmbeddings(entities);"
echo ""
echo "   // Search entities"
echo "   const results = await searchEntityEmbeddings('football clubs in London');"
echo ""
echo "🎉 Vector search is now powered by Supabase + OpenAI!"