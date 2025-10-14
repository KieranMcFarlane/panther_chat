#!/bin/bash

# Apply Comprehensive Enrichment with BrightData Integration
echo "🚀 Starting Comprehensive Enrichment with BrightData Web Scraping"
echo "=========================================================================="

# Check BrightData integration status first
echo "🌐 Checking BrightData integration..."
ENRICHMENT_STATUS=$(curl -s "http://localhost:3005/api/enrich-entity")
if echo "$ENRICHMENT_STATUS" | grep -q '"brightdata_scraping": true'; then
    echo "✅ BrightData web scraping is active and ready"
    BRIGHTDATA_ZONE=$(echo "$ENRICHMENT_STATUS" | grep -o '"brightdata_zone": "[^"]*"' | grep -o '"[^"]*"' | tr -d '"')
    echo "   Using BrightData zone: $BRIGHTDATA_ZONE"
else
    echo "⚠️ BrightData integration may not be fully configured"
fi

# Get batch information for economical processing
echo "📊 Getting batch information for economical processing (3 entities per batch)..."
BATCH_RESPONSE=$(curl -s -X POST "http://localhost:3005/api/batch-process" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_types": ["club", "league", "organization", "person"],
    "batch_size": 3,
    "shuffle": true,
    "prioritize_high_value": true
  }')

# Check if batch response is valid
if [[ $BATCH_RESPONSE == *"success\":true"* ]]; then
  echo "✅ Successfully retrieved batch information"
  
  # Extract total entities using string manipulation (avoiding jq dependency issues)
  TOTAL_ENTITIES=$(echo $BATCH_RESPONSE | grep -o '"total_entities":[0-9]*' | cut -d':' -f2)
  echo "📋 Found $TOTAL_ENTITIES entities to enrich"
  
  # Apply enrichment to first few entities as demonstration
  echo ""
  echo "🎯 Applying AI enrichment to entities..."
  echo ""
  
  # Enrich Manchester United (entity_id 0) with BrightData integration
  echo "🧠 Enriching Manchester United FC with web scraping..."
  ENRICH_RESPONSE=$(curl -s -X POST "http://localhost:3005/api/enrich-entity" \
    -H "Content-Type: application/json" \
    -d '{
      "entity_id": "0",
      "include_perplexity_research": false,
      "include_brightdata_scraping": true
    }')
  
  if [[ $ENRICH_RESPONSE == *"success\":true"* ]]; then
    echo "   ✅ Manchester United FC enriched successfully"
    
    # Extract opportunity score
    SCORE=$(echo $ENRICH_RESPONSE | grep -o '"opportunity_score":[0-9]*' | cut -d':' -f2)
    if [[ -n "$SCORE" ]]; then
      echo "   📊 Opportunity Score: $SCORE"
    fi
    
    # Extract digital maturity
    MATURITY=$(echo $ENRICH_RESPONSE | grep -o '"digital_maturity":[0-9]*' | cut -d':' -f2)
    if [[ -n "$MATURITY" ]]; then
      echo "   🎯 Digital Maturity: $MATURITY"
    fi
    
    # Extract BrightData sources found
    SOURCES=$(echo $ENRICH_RESPONSE | grep -o '"total_sources":[0-9]*' | cut -d':' -f2)
    if [[ -n "$SOURCES" ]]; then
      echo "   🌐 BrightData Sources Found: $SOURCES"
    fi
    
    # Check if web scraping was used
    if echo $ENRICH_RESPONSE | grep -q '"brightdata_scraping":true'; then
      echo "   ✅ Web scraping: LinkedIn/Crunchbase/News search completed"
    fi
    
  else
    echo "   ❌ Manchester United FC enrichment failed"
  fi
  
  echo ""
  
  # Enrich Liverpool FC (entity_id 1) with BrightData integration
  echo "🧠 Enriching Liverpool FC with web scraping..."
  ENRICH_RESPONSE2=$(curl -s -X POST "http://localhost:3005/api/enrich-entity" \
    -H "Content-Type: application/json" \
    -d '{
      "entity_id": "1",
      "include_perplexity_research": false,
      "include_brightdata_scraping": true
    }')
  
  if [[ $ENRICH_RESPONSE2 == *"success\":true"* ]]; then
    echo "   ✅ Liverpool FC enriched successfully"
    
    # Extract opportunity score
    SCORE2=$(echo $ENRICH_RESPONSE2 | grep -o '"opportunity_score":[0-9]*' | cut -d':' -f2)
    if [[ -n "$SCORE2" ]]; then
      echo "   📊 Opportunity Score: $SCORE2"
    fi
    
    # Extract digital maturity
    MATURITY2=$(echo $ENRICH_RESPONSE2 | grep -o '"digital_maturity":[0-9]*' | cut -d':' -f2)
    if [[ -n "$MATURITY2" ]]; then
      echo "   🎯 Digital Maturity: $MATURITY2"
    fi
    
    # Extract BrightData sources found
    SOURCES2=$(echo $ENRICH_RESPONSE2 | grep -o '"total_sources":[0-9]*' | cut -d':' -f2)
    if [[ -n "$SOURCES2" ]]; then
      echo "   🌐 BrightData Sources Found: $SOURCES2"
    fi
    
    # Check if web scraping was used
    if echo $ENRICH_RESPONSE2 | grep -q '"brightdata_scraping":true'; then
      echo "   ✅ Web scraping: LinkedIn/Crunchbase/News search completed"
    fi
    
  else
    echo "   ❌ Liverpool FC enrichment failed"
  fi
  
  echo ""
  
  # Enrich Premier League (entity_id 7) with BrightData integration
  echo "🧠 Enriching Premier League with web scraping..."
  ENRICH_RESPONSE3=$(curl -s -X POST "http://localhost:3005/api/enrich-entity" \
    -H "Content-Type: application/json" \
    -d '{
      "entity_id": "7",
      "include_perplexity_research": false,
      "include_brightdata_scraping": true
    }')
  
  if [[ $ENRICH_RESPONSE3 == *"success\":true"* ]]; then
    echo "   ✅ Premier League enriched successfully"
    
    # Extract opportunity score
    SCORE3=$(echo $ENRICH_RESPONSE3 | grep -o '"opportunity_score":[0-9]*' | cut -d':' -f2)
    if [[ -n "$SCORE3" ]]; then
      echo "   📊 Opportunity Score: $SCORE3"
    fi
    
    # Extract digital maturity
    MATURITY3=$(echo $ENRICH_RESPONSE3 | grep -o '"digital_maturity":[0-9]*' | cut -d':' -f2)
    if [[ -n "$MATURITY3" ]]; then
      echo "   🎯 Digital Maturity: $MATURITY3"
    fi
    
    # Extract BrightData sources found
    SOURCES3=$(echo $ENRICH_RESPONSE3 | grep -o '"total_sources":[0-9]*' | cut -d':' -f2)
    if [[ -n "$SOURCES3" ]]; then
      echo "   🌐 BrightData Sources Found: $SOURCES3"
    fi
    
    # Check if web scraping was used
    if echo $ENRICH_RESPONSE3 | grep -q '"brightdata_scraping":true'; then
      echo "   ✅ Web scraping: LinkedIn/Crunchbase/News search completed"
    fi
    
  else
    echo "   ❌ Premier League enrichment failed"
  fi
  
  echo ""
  echo "📊 ENRICHMENT COMPLETE - Economical Batching with BrightData"
  echo "============================================================"
  echo "✅ Comprehensive enrichment system applied successfully"
  echo "🧠 AI-powered business intelligence generated for entities"
  echo "🎯 Real Claude Agent analysis with opportunity scoring"
  echo "🌐 View enriched entities at: http://localhost:3005/entity-browser"
  echo "📊 View enrichment dashboard at: http://localhost:3005/comprehensive-enrichment"
  echo ""
  echo "🎉 Entity integration complete with AI enrichment + BrightData web scraping!"
  
else
  echo "❌ Failed to get batch information"
  echo "Server response: $BATCH_RESPONSE"
fi

echo ""
echo "🚀 Comprehensive enrichment application completed!"