#!/bin/bash

# Batch Dossier Generation Script
echo "🚀 Starting Batch Dossier Generation for High-Value Sports Entities"
echo "=================================================================="

# Top Premier League and European clubs
TOP_EUROPEAN_CLUBS=(
    "283:FC Barcelona"
    "181:Bayern München" 
    "182:Borussia Dortmund"
    "284:Atlético de Madrid"
    "201:AC Milan"
    "202:AS Roma"
    "206:Fiorentina"
    "287:Athletic Club"
    "291:Celta Vigo"
    "294:CA Osasuna"
)

# Bundesliga clubs
BUNDESLIGA_CLUBS=(
    "197:1. FC Köln"
    "191:1. FC Nürnberg"
    "184:Bayer 04 Leverkusen"
    "188:Borussia Mönchengladbach"
    "193:FC Augsburg"
    "186:Eintracht Frankfurt"
)

# Serie A clubs
SERIE_A_CLUBS=(
    "205:Atalanta"
    "208:Bologna"
    "210:Cagliari"
    "214:Empoli"
)

# Ligue 1 clubs
LIGUE_1_CLUBS=(
    "180:AJ Auxerre"
    "167:AS Monaco"
    "177:Clermont Foot"
    "176:FC Lorient"
    "178:FC Metz"
)

# Premier League additional clubs
EPL_CLUBS=(
    "127:Aston Villa"
    "128:Bournemouth"
    "129:Brentford"
    "130:Brighton & Hove Albion"
    "132:Crystal Palace"
    "133:Everton"
    "146:Burnley"
    "155:Birmingham City"
    "156:Bolton Wanderers"
    "157:Charlton Athletic"
    "158:Derby County"
    "162:Blackburn Rovers"
    "163:Bristol City"
)

# Function to process dossier generation
process_dossier() {
    local entity_id=$1
    local entity_name=$2
    local category=$3
    
    echo "📋 Processing: $entity_name (ID: $entity_id) - $category"
    
    local response=$(curl -X GET "http://localhost:3005/api/entities/$entity_id/dossier?includeSignals=true&includeConnections=true&includePOIs=true&deepResearch=false" \
        -H "Content-Type: application/json" \
        -s --max-time 30)
    
    local success=$(echo $response | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        local dossier_name=$(echo $response | jq -r '.dossier.entityName // "Unknown"')
        local status=$(echo $response | jq -r '.dossier.status // "unknown"')
        local last_updated=$(echo $response | jq -r '.dossier.lastUpdated // "N/A"')
        
        echo "✅ Success: $dossier_name - Status: $status - Updated: $last_updated"
        
        # Store the link for final report
        echo "🔗 Link: http://localhost:3005/entity/$entity_id" >> ./dossier_links.txt
        
        return 0
    else
        echo "❌ Failed: $entity_name"
        return 1
    fi
}

# Initialize results file
echo "📊 Batch Dossier Generation Results - $(date)" > ./batch_results.txt
echo "==================================================" >> ./batch_results.txt
echo "" > ./dossier_links.txt

# Process all categories
processed_count=0
success_count=0

echo ""
echo "🏆 PROCESSING TOP EUROPEAN CLUBS"
echo "================================"

for club in "${TOP_EUROPEAN_CLUBS[@]}"; do
    IFS=':' read -r entity_id entity_name <<< "$club"
    if process_dossier "$entity_id" "$entity_name" "Top European"; then
        ((success_count++))
    fi
    ((processed_count++))
    sleep 1  # Brief pause to avoid overwhelming the system
done

echo ""
echo "🇩🇪 PROCESSING BUNDESLIGA CLUBS"
echo "==============================="

for club in "${BUNDESLIGA_CLUBS[@]}"; do
    IFS=':' read -r entity_id entity_name <<< "$club"
    if process_dossier "$entity_id" "$entity_name" "Bundesliga"; then
        ((success_count++))
    fi
    ((processed_count++))
    sleep 1
done

echo ""
echo "🇮🇹 PROCESSING SERIE A CLUBS"
echo "==========================="

for club in "${SERIE_A_CLUBS[@]}"; do
    IFS=':' read -r entity_id entity_name <<< "$club"
    if process_dossier "$entity_id" "$entity_name" "Serie A"; then
        ((success_count++))
    fi
    ((processed_count++))
    sleep 1
done

echo ""
echo "🇫🇷 PROCESSING LIGUE 1 CLUBS"
echo "==========================="

for club in "${LIGUE_1_CLUBS[@]}"; do
    IFS=':' read -r entity_id entity_name <<< "$club"
    if process_dossier "$entity_id" "$entity_name" "Ligue 1"; then
        ((success_count++))
    fi
    ((processed_count++))
    sleep 1
done

echo ""
echo "🏴󠁧󠁢󠁥󠁮󠁧󠁿 PROCESSING ADDITIONAL EPL CLUBS"
echo "===================================="

for club in "${EPL_CLUBS[@]}"; do
    IFS=':' read -r entity_id entity_name <<< "$club"
    if process_dossier "$entity_id" "$entity_name" "EPL Additional"; then
        ((success_count++))
    fi
    ((processed_count++))
    sleep 1
done

echo ""
echo "📈 BATCH PROCESSING COMPLETE"
echo "==========================="
echo "Total Entities Processed: $processed_count"
echo "Successfully Generated: $success_count"
echo "Success Rate: $(( (success_count * 100) / processed_count ))%"
echo ""
echo "🔗 All generated dossier links have been saved to: ./dossier_links.txt"
echo "📊 Detailed results saved to: ./batch_results.txt"

# Display all links at the end
echo ""
echo "🎯 GENERATED DOSSIER LINKS:"
echo "==========================="
cat ./dossier_links.txt