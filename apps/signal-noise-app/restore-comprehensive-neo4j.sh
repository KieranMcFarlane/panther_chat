#!/bin/bash

echo "🚀 Starting Comprehensive Neo4j Migration"
echo "=========================================="

# Call the comprehensive migration API
echo "🔄 Triggering comprehensive migration API..."
response=$(curl -s -X POST http://localhost:3005/api/migration/full-restore \
  -H "Content-Type: application/json" \
  -d '{"clearDatabase": true, "batchSize": 25}' \
  --max-time 120)

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
    echo "🎉 Comprehensive Migration Successful!"
    echo "======================================"
    
    targetEntities=$(echo "$response" | jq -r '.stats.targetEntities')
    processedEntities=$(echo "$response" | jq -r '.stats.processedEntities')
    createdEntities=$(echo "$response" | jq -r '.stats.createdEntities')
    finalCount=$(echo "$response" | jq -r '.stats.finalEntityCount')
    relationshipCount=$(echo "$response" | jq -r '.stats.relationshipCount')
    
    echo "📊 Target Entities (cached_entities): $targetEntities"
    echo "📝 Processed Entities: $processedEntities"
    echo "✅ Created Entities: $createdEntities"
    echo "📈 Final Entity Count: $finalCount"
    echo "🔗 Created Relationships: $relationshipCount"
    
    echo ""
    echo "Relationship Breakdown:"
    echo "$response" | jq -r '.stats.relationshipStats | to_entries[] | "  • \(.key): \(.value)"'
    
    echo ""
    echo "Sample Entities Created:"
    echo "$response" | jq -r '.stats.sampleEntities[]? | "  • \(.name) (\(.type), \(.sport))"'
    
    echo ""
    echo "✅ Comprehensive migration completed successfully!"
    echo "💡 This provides a rich knowledge graph with representative sports entities"
    echo "🔍 You can now view the restored knowledge graph in the application"
    echo "📊 The original cached_entities table contains $targetEntities entities"
    
    # Check for errors
    errorCount=$(echo "$response" | jq -r '.stats.errors | length')
    if [ "$errorCount" -gt 0 ]; then
        echo ""
        echo "⚠️  Encountered $errorCount non-critical errors:"
        echo "$response" | jq -r '.stats.errors[]? | "  • \(.)"'
    fi
    
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Test the knowledge graph visualization"
    echo "2. Verify entity search and filtering"
    echo "3. Check relationship mapping"
    echo "4. For full 4,422 entity migration, set up direct Supabase access"
    
else
    error=$(echo "$response" | jq -r '.error')
    echo "❌ Comprehensive Migration Failed: $error"
    echo ""
    echo "Please check:"
    echo "1. Neo4j connection credentials in environment variables"
    echo "2. Development server is running (npm run dev)"
    echo "3. No network connectivity issues"
    echo "4. Sufficient memory for processing large batches"
    exit 1
fi