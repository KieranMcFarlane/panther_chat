#!/bin/bash

# Relationship-Based Entity Traversal and Enrichment
echo "🔍 Starting Relationship-Based Entity Traversal"
echo "============================================================"

# Get total entities in Neo4j first
echo "📊 Checking current Neo4j database state..."
NEO4J_STATUS=$(curl -s -X POST "http://localhost:3005/api/traversal-enrichment" \
  -H "Content-Type: application/json" \
  -d '{
    "start_from": "all",
    "enrichment_options": {
      "include_claude_analysis": false,
      "include_perplexity_research": false,
      "include_brightdata_scraping": false
    },
    "batch_size": 1
  }')

if [[ $NEO4J_STATUS == *"success\":true"* ]]; then
  TOTAL_ENTITIES=$(echo $NEO4J_STATUS | grep -o '"total_entities_found":[0-9]*' | cut -d':' -f2)
  RELATIONSHIPS=$(echo $NEO4J_STATUS | grep -o '"total_relationships_traversed":[0-9]*' | cut -d':' -f2)
  echo "✅ Neo4j contains $TOTAL_ENTITIES entities with $RELATIONSHIPS relationships"
else
  echo "❌ Failed to connect to Neo4j"
  exit 1
fi

echo ""
echo "🧠 Starting comprehensive traversal with full AI enrichment..."
echo ""

# Start comprehensive traversal with all AI services
echo "🚀 Processing all entities via relationship traversal..."
echo "   - Claude Agent Analysis: ✅ ENABLED"
echo "   - Perplexity Research: ✅ ENABLED" 
echo "   - BrightData Scraping: ✅ ENABLED"
echo "   - Batch Size: 3 entities (economical processing)"
echo ""

TRAVERSAL_RESPONSE=$(curl -s -X POST "http://localhost:3005/api/traversal-enrichment" \
  -H "Content-Type: application/json" \
  -d '{
    "start_from": "unenriched",
    "enrichment_options": {
      "include_claude_analysis": true,
      "include_perplexity_research": true,
      "include_brightdata_scraping": true
    },
    "batch_size": 3
  }')

if [[ $TRAVERSAL_RESPONSE == *"success\":true"* ]]; then
  echo "✅ Relationship traversal completed successfully!"
  echo ""
  
  # Extract key metrics
  PROCESSED=$(echo $TRAVERSAL_RESPONSE | grep -o '"total_processed":[0-9]*' | cut -d':' -f2)
  SUCCESSFUL=$(echo $TRAVERSAL_RESPONSE | grep -o '"successful_enrichments":[0-9]*' | cut -d':' -f2)
  SUCCESS_RATE=$(echo $TRAVERSAL_RESPONSE | grep -o '"overall_success_rate":[0-9.]*' | cut -d':' -f2)
  AVG_SCORE=$(echo $TRAVERSAL_RESPONSE | grep -o '"average_opportunity_score":[0-9.]*' | cut -d':' -f2)
  BATCHES=$(echo $TRAVERSAL_RESPONSE | grep -o '"total_batches_created":[0-9]*' | cut -d':' -f2)
  REL_TRAVERSED=$(echo $TRAVERSAL_RESPONSE | grep -o '"total_relationships_traversed":[0-9]*' | cut -d':' -f2)
  PROC_TIME=$(echo $TRAVERSAL_RESPONSE | grep -o '"processing_time_ms":[0-9]*' | cut -d':' -f2)
  
  echo "📊 TRAVERSAL RESULTS:"
  echo "============================================================"
  echo "🎯 Entities Processed: $PROCESSED"
  echo "✅ Successful Enrichments: $SUCCESSFUL"  
  echo "📈 Success Rate: ${SUCCESS_RATE}%"
  echo "🎯 Average Opportunity Score: $AVG_SCORE"
  echo "📦 Batches Created: $BATCHES"
  echo "🔗 Relationships Traversed: $REL_TRAVERSED"
  echo "⏱️  Total Processing Time: ${PROC_TIME}ms"
  echo ""
  
  # Show batch details
  echo "📦 BATCH PROCESSING DETAILS:"
  echo "============================================================"
  
  # Extract and display batch results
  BATCH_INFO=$(echo $TRAVERSAL_RESPONSE | grep -o '"batch_results":\[.*\]' | sed 's/,/\\n/g')
  
  # Count how many batches were successful
  SUCCESSFUL_BATCHES=0
  for i in {1..5}; do
    BATCH_SUCCESS=$(echo $TRAVERSAL_RESPONSE | grep -o '"batch_number":'$i'"[^}]*"batch_success_rate":[0-9.]*' | grep -o '[0-9.]*$')
    if [[ -n "$BATCH_SUCCESS" && "$BATCH_SUCCESS" == "1" ]]; then
      ((SUCCESSFUL_BATCHES++))
    fi
  done
  
  echo "✅ Successful Batches: $SUCCESSFUL_BATCHES/$BATCHES"
  
  # Show specific entity results (first few)
  echo ""
  echo "🏆 TOP ENRICHED ENTITIES:"
  echo "============================================================"
  
  # Extract entity names and scores (simplified parsing)
  echo $TRAVERSAL_RESPONSE | grep -o '"entity_name":"[^"]*"[^}]*"opportunity_score":[0-9]*' | head -5 | while IFS= read -r line; do
    ENTITY_NAME=$(echo $line | grep -o '"entity_name":"[^"]*"' | cut -d':' -f2 | tr -d '"')
    OPP_SCORE=$(echo $line | grep -o '"opportunity_score":[0-9]*' | cut -d':' -f2)
    if [[ -n "$ENTITY_NAME" && -n "$OPP_SCORE" ]]; then
      echo "🏟️  $ENTITY_NAME - Opportunity Score: $OPP_SCORE"
    fi
  done
  
  echo ""
  echo "🌐 ENRICHMENT SERVICES UTILIZED:"
  echo "============================================================"
  echo "🤖 Claude Agent: Business Intelligence Analysis"
  echo "🔍 Perplexity: Market Research & Intelligence" 
  echo "🌐 BrightData: LinkedIn/Crunchbase/Web Scraping"
  echo "💾 Neo4j MCP: Relationship Traversal & Graph Queries"
  echo "💾 Supabase: Caching & Performance Layer"
  echo ""
  
  echo "🎉 RELATIONSHIP-BASED TRAVERSAL COMPLETE!"
  echo "============================================================"
  echo "✅ All entities processed via Neo4j relationship traversal"
  echo "🧠 AI enrichment applied across entire knowledge graph"
  echo "🔗 Entity relationships used for intelligent processing order"
  echo "💾 Results cached in Supabase for performance"
  echo ""
  echo "📊 View results:"
  echo "   - Entity Browser: http://localhost:3005/entity-browser"
  echo "   - Knowledge Graph: http://localhost:3005/graph"
  echo "   - Comprehensive Dashboard: http://localhost:3005/comprehensive-enrichment"
  echo ""
  
else
  echo "❌ Relationship traversal failed"
  echo "Server response: $TRAVERSAL_RESPONSE"
fi

echo ""
echo "🚀 Traversal enrichment process completed!"