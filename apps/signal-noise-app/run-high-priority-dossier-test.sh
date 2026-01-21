#!/bin/bash

# High-Priority Dossier Scaling Test with BrightData MCP Integration
# This script tests the dossier system with 20 high-value entities
# to demonstrate scaling readiness and BrightData MCP integration

echo "🚀 HIGH-PRIORITY DOSSIER SCALING TEST WITH BRIGHTDATA MCP"
echo "============================================================"

# High-priority entities for comprehensive testing
HIGH_PRIORITY_ENTITIES=(
    "126:Arsenal"
    "139:Manchester United"
    "283:FC Barcelona"
    "181:Bayern München"
    "201:AC Milan"
    "184:Bayer 04 Leverkusen"
    "205:Atalanta"
    "167:AS Monaco"
    "127:Aston Villa"
    "182:Borussia Dortmund"
    "284:Atlético de Madrid"
    "206:Fiorentina"
    "188:Borussia Mönchengladbach"
    "197:1. FC Köln"
    "287:Athletic Club"
    "291:Celta Vigo"
    "208:Bologna"
    "210:Cagliari"
    "214:Empoli"
)

# Function to process single entity
process_entity() {
    local entity_id=$1
    local entity_name=$2
    local start_time=$(date +%s)

    echo ""
    echo "📋 Processing: $entity_name (ID: $entity_id)"
    echo "   Priority: HIGH - Scaling Test"

    # Test standard dossier generation
    echo "   📡 Standard API Call..."
    local response=$(curl -X GET "http://localhost:3005/api/entities/$entity_id/dossier?includeSignals=true&includeConnections=true&includePOIs=true" \
        -H "Content-Type: application/json" \
        -s --max-time 30)

    local success=$(echo $response | jq -r '.success // false')
    local processing_time=$(($(date +%s) - start_time))

    if [ "$success" = "true" ]; then
        local dossier_name=$(echo $response | jq -r '.dossier.entityName // "Unknown"')
        local final_score=$(echo $response | jq -r '.dossier.scores.finalScore // 0')
        local status=$(echo $response | jq -r '.dossier.status // "unknown"')
        local signal_count=$(echo $response | jq -r '.dossier.signals | length // 0')
        local poi_count=$(echo $response | jq -r '.dossier.topPOIs | length // 0')

        echo "   ✅ SUCCESS: $dossier_name"
        echo "   📊 Score: $final_score/100 | Status: $status"
        echo "   🔍 Signals: $signal_count | POIs: $poi_count"
        echo "   ⏱️  Time: ${processing_time}s"
        echo "   🔗 Link: http://localhost:3005/entity-browser/$entity_id/dossier"

        # Store result for summary
        echo "SUCCESS:$entity_id:$dossier_name:$final_score:$processing_time" >> ./dossier_test_results.txt

        return 0
    else
        echo "   ❌ FAILED: $entity_name"
        echo "   ⏱️  Time: ${processing_time}s"

        # Store failure for summary
        echo "FAILED:$entity_id:$entity_name:$processing_time" >> ./dossier_test_results.txt

        return 1
    fi
}

# Initialize results tracking
echo "📊 HIGH-PRIORITY DOSSIER TEST RESULTS - $(date)" > ./dossier_test_results.txt
echo "==================================================" >> ./dossier_test_results.txt
echo "" >> ./dossier_test_results.txt

# Check if server is running
echo "🔍 Checking development server health..."
if ! curl -s http://localhost:3005/api/health > /dev/null 2>&1; then
    echo "❌ Development server not running at http://localhost:3005"
    echo "💡 Please start server with: npm run dev"
    exit 1
fi

echo "✅ Development server is healthy"

# Process all high-priority entities
total_entities=${#HIGH_PRIORITY_ENTITIES[@]}
success_count=0
total_time=0

echo ""
echo "🎯 PROCESSING $total_entities HIGH-PRIORITY ENTITIES"
echo "=============================================="

for i in "${!HIGH_PRIORITY_ENTITIES[@]}"; do
    entity="${HIGH_PRIORITY_ENTITIES[$i]}"
    IFS=':' read -r entity_id entity_name <<< "$entity"

    echo ""
    echo "($((i+1))/$total_entities) Processing: $entity_name"
    echo "----------------------------------------"

    if process_entity "$entity_id" "$entity_name"; then
        ((success_count++))
    fi

    # Calculate cumulative time
    total_time=$((total_time + $(date +%s)))

    # Brief pause to avoid overwhelming the system
    if [ $((i+1)) -lt $total_entities ]; then
        echo "⏳ Waiting 2 seconds before next entity..."
        sleep 2
    fi
done

echo ""
echo "🎉 HIGH-PRIORITY DOSSIER TEST COMPLETE"
echo "=========================================="

# Calculate final statistics
total_processing_time=$((total_time - $(date +%s)))
avg_processing_time=$((total_processing_time / total_entities))
success_rate=$((success_count * 100 / total_entities))

echo "📊 FINAL RESULTS:"
echo "   • Total Entities Tested: $total_entities"
echo "   • Successful Dossiers: $success_count/$total_entities ($success_rate%)"
echo "   • Total Processing Time: ${total_processing_time}s"
echo "   • Average Time per Entity: ${avg_processing_time}s"
echo "   • Generation Rate: $((total_entities * 3600 / total_processing_time)) dossiers/hour"

# Performance analysis
echo ""
echo "⚡ PERFORMANCE ANALYSIS:"
if [ $success_rate -ge 90 ]; then
    echo "   ✅ EXCELLENT: $success_rate% success rate"
    echo "   🚀 SYSTEM READY FOR FULL SCALING"
elif [ $success_rate -ge 75 ]; then
    echo "   ✅ GOOD: $success_rate% success rate"
    echo "   🔧 MINOR TUNING NEEDED BEFORE FULL SCALING"
else
    echo "   ⚠️  NEEDS ATTENTION: $success_rate% success rate"
    echo "   🔧 SYSTEM REQUIRES FIXES BEFORE SCALING"
fi

if [ $avg_processing_time -le 10 ]; then
    echo "   ⚡ FAST: ${avg_processing_time}s average - Excellent performance"
elif [ $avg_processing_time -le 20 ]; then
    echo "   ⚡ GOOD: ${avg_processing_time}s average - Good performance"
else
    echo "   ⚠️  SLOW: ${avg_processing_time}s average - Performance optimization needed"
fi

# Scaling readiness assessment
echo ""
echo "🎯 SCALING READINESS:"
if [ $success_rate -ge 95 ] && [ $avg_processing_time -le 15 ]; then
    echo "   ✅ READY FOR PRODUCTION SCALING"
    echo "   📈 Can process 1000+ entities per hour"
    echo "   🔧 Recommended: Proceed with tiered rollout"
elif [ $success_rate -ge 85 ] && [ $avg_processing_time -le 30 ]; then
    echo "   ✅ READY FOR GRADUAL SCALING"
    echo "   📈 Can process 120+ entities per hour"
    echo "   🔧 Recommended: Optimize database, then scale"
else
    echo "   ⚠️  NEEDS OPTIMIZATION"
    echo "   📉 Current rate: $((total_entities * 3600 / total_processing_time)) entities/hour"
    echo "   🔧 Recommended: Fix issues, then retest"
fi

# Show successful dossier links
echo ""
echo "🔗 GENERATED DOSSIER LINKS:"
echo "=============================="
grep "^SUCCESS:" ./dossier_test_results.txt | while IFS=':' read -r success entity_id entity_name score time; do
    echo "   ✅ $entity_name: http://localhost:3005/entity-browser/$entity_id/dossier"
done

# Store detailed results for analysis
echo ""
echo "📄 Detailed results saved to: ./dossier_test_results.txt"
echo "💡 Analyze with: cat ./dossier_test_results.txt | sort -t':' -k3"

# Recommendations based on test results
echo ""
echo "💡 SCALING RECOMMENDATIONS:"
echo "   1. If success rate ≥95%: Start full-scale batch processing"
echo "   2. If average time ≤15s: Enable concurrent processing (3-5 parallel)"
echo "   3. If success rate ≥85%: Implement queue-based processing"
echo "   4. Add monitoring for production scaling (success rates, processing times)"
echo "   5. Implement progressive rollout: Critical → High → Medium → Bulk entities"

echo ""
echo "🎉 High-priority dossier scaling test completed!"