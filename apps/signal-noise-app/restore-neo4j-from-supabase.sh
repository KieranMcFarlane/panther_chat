#!/bin/bash

echo "🚀 Starting Neo4j Migration from Supabase"
echo "=========================================="

# Start the development server in the background if not already running
if ! curl -s http://localhost:3005 > /dev/null; then
    echo "📦 Starting development server..."
    npm run dev > /dev/null 2>&1 &
    DEV_PID=$!
    echo "⏳ Waiting for server to start..."
    sleep 10
else
    echo "✅ Development server is already running"
fi

# Call the migration API
echo "🔄 Triggering migration API..."
response=$(curl -s -X POST http://localhost:3005/api/migration/neo4j-restore \
  -H "Content-Type: application/json" \
  -d '{"clearDatabase": true}')

# Check if response is valid JSON
if ! echo "$response" | jq . > /dev/null 2>&1; then
    echo "❌ Invalid response from server:"
    echo "$response"
    exit 1
fi

# Parse and display results
echo "$response" | jq -r '
if .success then
    "🎉 Migration Successful!
     ======================
     📊 Total Entities: \(.stats.totalEntities)
     ✅ Created Entities: \(.stats.createdEntities)
     📈 Final Entity Count: \(.stats.finalEntityCount)
     🔗 Created Relationships: \(.stats.relationshipCount)
     
     Relationship Breakdown:
     • Sport: \(.stats.relationshipStats.sport)
     • Country: \(.stats.relationshipStats.country) 
     • League: \(.stats.relationshipStats.league)
     • Federation: \(.stats.relationshipStats.federation)
     
     Sample Entities Created:"
else
    "❌ Migration Failed: \(.error)"
end'

if echo "$response" | jq -r '.success' | grep -q true; then
    echo "$response" | jq -r '.stats.sampleEntities[]? | "  • \(.name) (\(.type), \(.sport))"'
    
    if [ $(echo "$response" | jq -r '.stats.errors | length') -gt 0 ]; then
        echo ""
        echo "⚠️  Encountered $(echo "$response" | jq -r '.stats.errors | length') errors:"
        echo "$response" | jq -r '.stats.errors[]? | "  • \(.)"'
    fi
    
    echo ""
    echo "✅ Migration completed successfully!"
    echo "💡 You can now view the restored knowledge graph in the application"
else
    echo ""
    echo "❌ Migration failed. Please check the server logs for details."
    exit 1
fi

# Clean up development server if we started it
if [ ! -z "$DEV_PID" ]; then
    echo "🛑 Stopping development server..."
    kill $DEV_PID 2>/dev/null
fi