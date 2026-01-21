#!/bin/bash
# Simple RFP monitor that queries Supabase cached entities instead of Neo4j
# This works around Neo4j connection issues

set -euo pipefail

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
cd "$BASE_DIR"

# Load env
if [ -f .env ]; then
  set -a
  source .env
fi

# Supabase connection
SUPABASE_URL="https://itlcuazbybqlkicsaola.supabase.co"
SUPABASE_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

echo "🔍 Fetching entities from Supabase..."

# Fetch 10 entities from Supabase to test
ENTITIES=$(curl -s "${SUPABASE_URL}/rest/v1/cached_entities?select=neo4j_id,name,properties&limit=5&order=created_at.desc" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "$ENTITIES" | jq '.[] | {neo4j_id, name, properties}'

# For each entity, search BrightData
echo -e "\n🔍 Searching for RFPs..."

# Example: Search for Arsenal FC opportunities
echo "Testing BrightData search for Arsenal FC..."
curl -s "https://api.brightdata.com/serp/google?token=${BRIGHTDATA_API_TOKEN}" \
  -d '{"q":"Arsenal FC RFP digital transformation tender","num_pages":1}' | jq '.results[] | {title,url}' | head -3
