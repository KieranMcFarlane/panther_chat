#!/bin/bash

echo "🚀 Starting Sample Neo4j Migration"
echo "==============================="

# Call the sample migration API
echo "🔄 Triggering sample migration API..."
response=$(curl -s -X POST http://localhost:3005/api/migration/sample-restore \
  -H "Content-Type: application/json" \
  -d '{"clearDatabase": true}' \
  --max-time 60)

# Check if curl succeeded
if [ $? -ne 0 ]; then
    echo "❌ Failed to call migration API. Is the development server running on port 3005?"
    exit 1
fi

# Check if response is valid JSON
if ! echo "$response" | jq . > /dev/null 2>&1; then
    echo "❌ Invalid response from server:"
    echo "$response"
    exit 1
fi

# Parse and display results
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "🎉 Sample Migration Successful!"
    echo "==============================="
    
    totalEntities=$(echo "$response" | jq -r '.stats.totalEntities')
    createdEntities=$(echo "$response" | jq -r '.stats.createdEntities')
    finalCount=$(echo "$response" | jq -r '.stats.finalEntityCount')
    relationshipCount=$(echo "$response" | jq -r '.stats.relationshipCount')
    
    echo "📊 Total Entities: $totalEntities"
    echo "✅ Created Entities: $createdEntities"
    echo "📈 Final Entity Count: $finalCount"
    echo "🔗 Created Relationships: $relationshipCount"
    
    echo ""
    echo "Sample Entities Created:"
    echo "$response" | jq -r '.stats.sampleEntities[]? | "  • \(.name) (\(.type), \(.sport))"'
    
    echo ""
    echo "✅ Sample migration completed successfully!"
    echo "💡 This provides a working knowledge graph with sample sports entities"
    echo "🔍 You can now view the restored knowledge graph in the application"
    
    # Check for errors
    errorCount=$(echo "$response" | jq -r '.stats.errors | length')
    if [ "$errorCount" -gt 0 ]; then
        echo ""
        echo "⚠️  Encountered $errorCount non-critical errors:"
        echo "$response" | jq -r '.stats.errors[]? | "  • \(.)"'
    fi
    
else
    error=$(echo "$response" | jq -r '.error')
    echo "❌ Sample Migration Failed: $error"
    echo ""
    echo "Please check:"
    echo "1. Neo4j connection credentials in environment variables"
    echo "2. Development server is running (npm run dev)"
    echo "3. No network connectivity issues"
    exit 1
fi