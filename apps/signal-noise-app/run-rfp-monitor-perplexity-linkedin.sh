#!/bin/bash
#
# Yellow Panther RFP Monitor - Perplexity-First + LinkedIn
# Best performing version: 100% verification rate
#
set -euo pipefail

# --- BASIC PATHS ---
BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
# Accept RUN_DIR as second parameter, or default to LOG_DIR for backward compatibility
RUN_DIR="${2:-$LOG_DIR}"
STAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$LOG_DIR"
mkdir -p "$RUN_DIR"

export CLAUDE_LOG_LEVEL=debug
export CLAUDE_LOG_FILE="$LOG_DIR/claude_mcp_trace_${STAMP}.log"

# --- LOAD ENV ---
if [ -f "$BASE_DIR/.env" ]; then
  set -a
  source "$BASE_DIR/.env"
  set +a
  echo "📦 Loading environment variables from .env" | tee -a "$LOG_DIR/test-cron.log"
fi

# CRITICAL: Load and export Perplexity API key for MCP server
# Extract from MCP config if not already in environment
if [[ -z "${PERPLEXITY_API_KEY:-}" && -f "$MCP_RUNTIME" ]]; then
  export PERPLEXITY_API_KEY=$(jq -r '.mcpServers["perplexity-mcp"].env.PERPLEXITY_API_KEY // empty' "$MCP_RUNTIME" 2>/dev/null || echo "")
fi

if [ -z "$PERPLEXITY_API_KEY" ]; then
  echo "⚠️  PERPLEXITY_API_KEY not found - Perplexity MCP will be unavailable" | tee -a "$LOG_DIR/test-cron.log"
else
  echo "✅ Perplexity API key loaded (${PERPLEXITY_API_KEY:0:8}...)" | tee -a "$LOG_DIR/test-cron.log"
fi

# --- LOAD NVM & PATHS ---
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
export PATH="$HOME/.nvm/versions/node/v20.18.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

CLAUDE_BIN="$(command -v claude || echo "$HOME/.nvm/versions/node/v20.18.3/bin/claude")"

# --- BATCH MODE ---
MODE="${1:-batch1}"
BATCH_NUM=$(echo "$MODE" | grep -o '[0-9]\+' || echo "1")
RANGE_START=$(( (BATCH_NUM - 1) * 300 ))

# --- TEST MODE ---
TEST_MODE=${TEST_MODE:-false}
if [[ "$TEST_MODE" == "true" ]]; then
  ENTITY_LIMIT=5
  echo "🧪 TEST MODE: Processing only 5 entities" | tee -a "$LOG_DIR/test-cron.log"
else
  ENTITY_LIMIT=300
fi

# --- LOCK FILE ---
LOCK="/tmp/rfp-monitor-${MODE}.lock"
if [ -e "$LOCK" ]; then
  echo "⚠️  Another RFP run for ${MODE} already in progress — skipping." | tee -a "$LOG_DIR/test-cron.log"
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT
: > "$LOCK"

# --- NORMALIZE NEO4J VARIABLES ---
if [ -n "${NEO4J_USER:-}" ] && [ -z "${NEO4J_USERNAME:-}" ]; then
  export NEO4J_USERNAME="$NEO4J_USER"
fi

# --- GENERATE RUNTIME MCP CONFIG ---
MCP_TEMPLATE="$BASE_DIR/mcp-config.json"
MCP_RUNTIME="$BASE_DIR/mcp-config-runtime.json"

if [ ! -f "$MCP_TEMPLATE" ]; then
  echo "❌ mcp-config.json not found" | tee -a "$LOG_DIR/test-cron.log"
  exit 1
fi

# Expand environment variables
envsubst < "$MCP_TEMPLATE" > "$MCP_RUNTIME"
echo "✅ Generated runtime MCP config with expanded variables" | tee -a "$LOG_DIR/test-cron.log"

echo "🧮 Running batch mode: $MODE (entities $RANGE_START-$(($RANGE_START + $ENTITY_LIMIT - 1)))" | tee -a "$LOG_DIR/test-cron.log"

# --- PERPLEXITY-FIRST + LINKEDIN PROMPT ---
CLAUDE_TASK="
🎯 PERPLEXITY-FIRST RFP DETECTION (with LinkedIn) - Process ${ENTITY_LIMIT} Entities

=== YELLOW PANTHER CORE SERVICES (ONLY detect these) ===
- Mobile app development (iOS/Android/cross-platform)
- Web platform development (fan portals, team sites, league platforms)
- Fan engagement platforms (loyalty, gamification, social features)
- Digital ticketing systems (software/integration, NOT hardware)
- Analytics & data platforms (business intelligence, performance tracking)
- Streaming/OTT platforms (video delivery software)
- E-commerce platforms (merchandise, tickets - software only)
- CRM & marketing automation (fan relationship management)

=== CRITICAL EXCLUSIONS (auto-reject) ===
- JOB POSTINGS (Director, Manager, Engineer, VP - seeking EMPLOYEES)
- Stadium construction, renovation, infrastructure, facilities
- Physical hardware installations (unless software is primary)
- Catering, food service, hospitality, security, transportation
- ANY project where physical construction is the primary deliverable

ONLY DETECT: RFP documents seeking VENDORS/AGENCIES to BUILD software projects

=== WORKFLOW ===

1. Query Neo4j: MATCH (e:Entity) WHERE e.type IN ['Club','League','Federation','Tournament'] RETURN e.name, e.sport SKIP ${RANGE_START} LIMIT ${ENTITY_LIMIT}

2. For EACH entity, print [ENTITY-START] <index> <name>, then:

   PHASE 1 - Perplexity PRIMARY Discovery (Try this FIRST):
   ─────────────────────────────────────────────────────
   CRITICAL: You MUST call the perplexity-mcp chat_completion tool for EACH entity.
   
   For each entity, call perplexity-mcp chat_completion tool with query:
   Search for active RFPs, tenders, or digital projects by ENTITY_NAME and SPORT_TYPE. Include official websites, LinkedIn posts, and tender portals. Focus on SOFTWARE/DIGITAL projects only. Exclude job postings and physical construction. Time range: last 6 months. Return any active RFPs with deadlines, partnerships, or digital initiatives.
   
   Based on Perplexity response:
   • If ACTIVE SOFTWARE RFP found → Print [ENTITY-PERPLEXITY-RFP], mark VERIFIED, skip Phase 1B & 2
   • If partnership/initiative found → Print [ENTITY-PERPLEXITY-SIGNAL], mark VERIFIED, skip Phase 1B & 2
   • If nothing found OR Perplexity fails → Print [ENTITY-PERPLEXITY-NONE], go to Phase 1B

   PHASE 1B - BrightData Fallback (ONLY if Perplexity found NONE):
   ───────────────────────────────────────────────────────────────
   • Search Tier 1: <org> + <sport> + (\"RFP\" OR \"tender\" OR \"solicitation\") + (\"software\" OR \"platform\" OR \"mobile app\") (last 6 months)
   • Search Tier 2: <org> + <sport> + (\"partnership\" OR \"selected\" OR \"awarded\") + (\"digital\" OR \"technology\") (last 3 months)
   • Search Tier 3: site:linkedin.com/posts + <org> + (\"RFP\" OR \"tender\" OR \"technology partner\") (last 30 days)
   • EXCLUDE: Job postings, hiring, employment, position titles
   • If SOFTWARE opportunity found → Print [ENTITY-BRIGHTDATA-DETECTED], mark UNVERIFIED, go to Phase 2
   • If nothing found → Print [ENTITY-NONE]

   PHASE 2 - Perplexity Validation (ONLY for UNVERIFIED from Phase 1B):
   ─────────────────────────────────────────────────────────────────
   Call perplexity-mcp chat_completion tool to validate. Query: Verify this opportunity at ENTITY_NAME. Is this a SOFTWARE project RFP? Check document type, URL status, deadline, and budget.
   
   Based on validation:
   • If valid SOFTWARE PROJECT RFP → Print [ENTITY-VERIFIED]
   • If job posting → Print [ENTITY-REJECTED] (Reason: Job posting, not project RFP)
   • If expired/closed → Print [ENTITY-REJECTED] (Reason: Expired/closed)
   • If placeholder URL → Print [ENTITY-REJECTED] (Reason: Invalid URL)
   • If non-digital → Print [ENTITY-REJECTED] (Reason: Non-digital scope)

   PHASE 3 - Competitive Intel (ONLY for fit_score >= 80):
   ───────────────────────────────────────────────────
   Call perplexity-mcp chat_completion tool. Query: Research ENTITY_NAME digital capabilities including current tech partners, recent digital projects, digital maturity, competitors, and decision makers.
   
   Print [ENTITY-INTEL]

3. Calculate fit_score (0-100) - ONLY for DIGITAL/SOFTWARE opportunities:

   IF opportunity involves physical construction/renovation/facilities OR job posting:
      fit_score = 0 (AUTO-REJECT)
   
   ELSE:
      Service Alignment (60%):
      • Mobile app development: 60 points
      • Web platform development: 50 points
      • Fan engagement platform: 55 points
      • Digital ticketing software: 45 points
      • Analytics/data platform: 40 points
      • Streaming/OTT platform: 50 points
      • E-commerce software: 40 points
      
      Project Scope (25%):
      • End-to-end platform development: 25 points
      • Multi-year partnership: 20 points
      • Integration/enhancement: 15 points
      
      YP Differentiators (15%):
      • Sports-specific requirement: 10 points
      • International federation/league: 5 points

4. Write VERIFIED results to Supabase MCP table 'rfp_opportunities'.

5. Return JSON wrapped in markdown code blocks:

\`\`\`json
{
  \"total_rfps_detected\": <int (all detections from Phase 1)>,
  \"verified_rfps\": <int (auto-verified from Perplexity OR validated from BrightData)>,
  \"rejected_rfps\": <int (failed validation)>,
  \"entities_checked\": <int>,
  \"highlights\": [
    {
      \"organization\": \"<name>\",
      \"src_link\": \"<REAL URL - NOT example.com>\",
      \"source_type\": \"<linkedin_post|tender_portal|partnership_announcement|official_website>\",
      \"discovery_source\": \"<perplexity_primary|brightdata_fallback>\",
      \"discovery_method\": \"<perplexity_priority_1|perplexity_priority_2|perplexity_priority_3|brightdata_tier_1|brightdata_tier_2|brightdata_tier_3>\",
      \"validation_status\": \"VERIFIED|EARLY_SIGNAL\",
      \"validation_method\": \"<perplexity_self_validated|perplexity_validated|none>\",
      \"date_published\": \"<YYYY-MM-DD>\",
      \"deadline\": \"<YYYY-MM-DD or null>\",
      \"deadline_days_remaining\": <int or null>,
      \"estimated_rfp_date\": \"<YYYY-MM-DD or null (for EARLY_SIGNAL only)>\",
      \"budget\": \"<£X-Y or 'Not specified'>\",
      \"summary_json\": {
        \"title\": \"<project summary>\",
        \"confidence\": <float 0.0-1.0>,
        \"urgency\": \"<low|medium|high>\",
        \"fit_score\": <int 0-100>,
        \"source_quality\": <float 0.0-1.0>
      },
      \"perplexity_validation\": {
        \"verified_by_perplexity\": <true|false>,
        \"deadline_confirmed\": <true|false>,
        \"url_verified\": <true|false>,
        \"budget_estimated\": <true|false>,
        \"verification_sources\": [\"<url1>\", \"<url2>\"]
      },
      \"competitive_intel\": {
        \"digital_maturity\": \"<LOW|MEDIUM|HIGH>\",
        \"current_partners\": [\"<partner1>\", \"<partner2>\"],
        \"recent_projects\": [{\"vendor\": \"<name>\", \"project\": \"<desc>\", \"year\": <yyyy>}],
        \"competitors\": [\"<competitor1>\", \"<competitor2>\"],
        \"yp_advantages\": [\"<advantage1>\", \"<advantage2>\"],
        \"decision_makers\": [{\"name\": \"<name>\", \"title\": \"<title>\"}]
      }
    }
  ],
  \"scoring_summary\": {
    \"avg_confidence\": <float>,
    \"avg_fit_score\": <float>,
    \"top_opportunity\": \"<organization>\"
  },
  \"discovery_metrics\": {
    \"perplexity_primary_success\": <int>,
    \"perplexity_primary_rate\": <float>,
    \"brightdata_fallback_used\": <int>,
    \"brightdata_fallback_rate\": <float>,
    \"perplexity_validations\": <int>,
    \"total_perplexity_queries\": <int>,
    \"total_brightdata_queries\": <int>,
    \"estimated_cost\": <float>,
    \"cost_savings_vs_old_system\": <float>
  },
  \"quality_metrics\": {
    \"placeholder_urls_rejected\": <int>,
    \"expired_rfps_rejected\": <int>,
    \"job_postings_rejected\": <int>,
    \"non_digital_rejected\": <int>,
    \"competitive_intel_gathered\": <int>
  }
}
\`\`\`
"

echo "╔════════════════════════════════════════════════════════════════╗" | tee -a "$LOG_DIR/test-cron.log"
echo "║  🟡 YELLOW PANTHER RFP MONITOR (Perplexity-First + LinkedIn)  ║" | tee -a "$LOG_DIR/test-cron.log"
echo "║  Batch: $MODE | Entities: $ENTITY_LIMIT                        ║" | tee -a "$LOG_DIR/test-cron.log"
echo "╚════════════════════════════════════════════════════════════════╝" | tee -a "$LOG_DIR/test-cron.log"

# --- RUN CLAUDE ---
if ! gtimeout 25m "$CLAUDE_BIN" \
  -p "$CLAUDE_TASK" \
  --mcp-config "$MCP_RUNTIME" \
  --permission-mode bypassPermissions \
  --output-format json \
  | tee >(awk '
      BEGIN {entity_count=0; perp_rfp=0; perp_signal=0; perp_none=0; bd_detected=0; verified_count=0; rejected_count=0; intel_count=0}
      /\[ENTITY-START\]/ {
        entity_count++
        printf "\r\033[K🔍 \033[1;36m%-40s\033[0m [%3d/'$ENTITY_LIMIT']", $3, entity_count
        print "" >> "'$LOG_DIR/test-cron.log'"
        print "🔍 [" entity_count "/'$ENTITY_LIMIT'] Starting: " $3 >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-PERPLEXITY-RFP\]/ {
        perp_rfp++
        verified_count++
        printf "\r\033[K🎯 \033[1;35m%-40s\033[0m [%3d/'$ENTITY_LIMIT'] \033[38;5;165m✅ Perplexity RFP #%d\033[0m\n", $2, entity_count, perp_rfp
        print "🎯 [" entity_count "/'$ENTITY_LIMIT'] " $2 " — Perplexity found ACTIVE RFP! Total: " perp_rfp >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-PERPLEXITY-SIGNAL\]/ {
        perp_signal++
        verified_count++
        printf "\r\033[K🟣 \033[1;33m%-40s\033[0m [%3d/'$ENTITY_LIMIT'] \033[38;5;220m💡 Signal #%d\033[0m\n", $2, entity_count, perp_signal
        print "🟣 [" entity_count "/'$ENTITY_LIMIT'] " $2 " — Perplexity found partnership/initiative signal. Total: " perp_signal >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-PERPLEXITY-NONE\]/ {
        perp_none++
        printf "\r\033[K⚪ %-40s [%3d/'$ENTITY_LIMIT'] (→ BD fallback...)\r", substr($2, 1, 40), entity_count
        print "⚪ [" entity_count "/'$ENTITY_LIMIT'] " $2 " — Perplexity found nothing, trying BrightData..." >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-BRIGHTDATA-DETECTED\]/ {
        bd_detected++
        printf "\r\033[K🟡 \033[1;33m%-40s\033[0m [%3d/'$ENTITY_LIMIT'] \033[38;5;214m🔍 BD #%d (validating...)\033[0m\r", $2, entity_count, bd_detected
        print "🟡 [" entity_count "/'$ENTITY_LIMIT'] " $2 " — BrightData detected (validating...). Total: " bd_detected >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-VERIFIED\]/ {
        verified_count++
        printf "\r\033[K✅ \033[1;32m%-40s\033[0m [%3d/'$ENTITY_LIMIT'] \033[38;5;46m⚡ VERIFIED #%d\033[0m\n", $2, entity_count, verified_count
        print "✅ [" entity_count "/'$ENTITY_LIMIT'] " $2 " — BrightData detection VERIFIED! Total: " verified_count >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-REJECTED\]/ {
        rejected_count++
        printf "\r\033[K❌ \033[1;31m%-40s\033[0m [%3d/'$ENTITY_LIMIT']\r", $2, entity_count
        print "❌ [" entity_count "/'$ENTITY_LIMIT'] " $2 " — REJECTED. Total: " rejected_count >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-INTEL\]/ {
        intel_count++
        printf "\r\033[K🧠 \033[1;35m%-40s\033[0m [%3d/'$ENTITY_LIMIT'] \033[38;5;165m📊 Intel #%d\033[0m\n", $2, entity_count, intel_count
        print "🧠 [" entity_count "/'$ENTITY_LIMIT'] " $2 " — Competitive intel gathered. Total: " intel_count >> "'$LOG_DIR/test-cron.log'"
        next
      }
      /\[ENTITY-NONE\]/  {
        printf "\r\033[K⚪ %-40s [%3d/'$ENTITY_LIMIT']\r", substr($2, 1, 40), entity_count
        next
      }
      /mcp__neo4j/ {print "\033[38;5;33m[MCP:Neo4j]\033[0m " $0 >> "'$LOG_DIR/test-cron.log'"; next}
      /mcp__brightData/ {print "\033[38;5;214m[MCP:BrightData]\033[0m " $0 >> "'$LOG_DIR/test-cron.log'"; next}
      /mcp__perplexity/ {print "\033[38;5;165m[MCP:Perplexity]\033[0m " $0 >> "'$LOG_DIR/test-cron.log'"; next}
      /mcp__supabase/ {print "\033[38;5;42m[MCP:Supabase]\033[0m " $0 >> "'$LOG_DIR/test-cron.log'"; next}
      {print $0 >> "'$LOG_DIR/test-cron.log'"}
      END {
        printf "\r\033[K"
        print ""
        print "╔════════════════════════════════════════════════════════════════╗" >> "'$LOG_DIR/test-cron.log'"
        print "║  🎉 PERPLEXITY-FIRST (+ LinkedIn) DETECTION COMPLETE           ║" >> "'$LOG_DIR/test-cron.log'"
        print "║  Entities Processed: " entity_count "/'$ENTITY_LIMIT'                                 ║" >> "'$LOG_DIR/test-cron.log'"
        print "║                                                                ║" >> "'$LOG_DIR/test-cron.log'"
        print "║  PHASE 1 - Perplexity Primary (+ LinkedIn):                   ║" >> "'$LOG_DIR/test-cron.log'"
        print "║    🎯 Active RFPs: " perp_rfp "                                          ║" >> "'$LOG_DIR/test-cron.log'"
        print "║    🟣 Signals: " perp_signal "                                             ║" >> "'$LOG_DIR/test-cron.log'"
        perp_total = perp_rfp + perp_signal
        perp_rate = (entity_count > 0) ? int(perp_total * 100 / entity_count) : 0
        print "║    📊 Success Rate: " perp_rate "%                                   ║" >> "'$LOG_DIR/test-cron.log'"
        print "║                                                                ║" >> "'$LOG_DIR/test-cron.log'"
        print "║  PHASE 1B - BrightData Fallback:                              ║" >> "'$LOG_DIR/test-cron.log'"
        print "║    🟡 Detected: " bd_detected "                                             ║" >> "'$LOG_DIR/test-cron.log'"
        bd_rate = (perp_none > 0) ? int(bd_detected * 100 / perp_none) : 0
        print "║    📊 Success Rate (of fallback attempts): " bd_rate "%                ║" >> "'$LOG_DIR/test-cron.log'"
        print "║                                                                ║" >> "'$LOG_DIR/test-cron.log'"
        print "║  ✅ Total Verified: " verified_count "                                  ║" >> "'$LOG_DIR/test-cron.log'"
        print "║  ❌ Rejected: " rejected_count "                                        ║" >> "'$LOG_DIR/test-cron.log'"
        print "║  🧠 Competitive Intel: " intel_count "                                  ║" >> "'$LOG_DIR/test-cron.log'"
        print "╚════════════════════════════════════════════════════════════════╝" >> "'$LOG_DIR/test-cron.log'"
      }
    ') \
  > "$RUN_DIR/rfp_results_${MODE}_${STAMP}.json" 2>&1; then
  echo "❌ Claude execution failed" | tee -a "$LOG_DIR/test-cron.log"
  exit 1
fi

# --- EXTRACT CLEAN JSON ---
RESULT_TEXT=$(cat "$RUN_DIR/rfp_results_${MODE}_${STAMP}.json")

# First, try to extract the .result field if it's a Claude CLI response wrapper
if echo "$RESULT_TEXT" | jq -e '.result' >/dev/null 2>&1; then
  RESULT_TEXT=$(cat "$RUN_DIR/rfp_results_${MODE}_${STAMP}.json" | jq -r '.result')
fi

# Then extract JSON from markdown code blocks
JSON_RESULT=$(echo "$RESULT_TEXT" | awk '/^```json/,/^```/ {if (!/^```/) print}')

# Validate and save
if [ -n "$JSON_RESULT" ] && echo "$JSON_RESULT" | jq empty >/dev/null 2>&1; then
  echo "$JSON_RESULT" > "$RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json"
  echo "✅ Extracted clean JSON → $RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json" | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  Could not extract valid JSON, saving empty" | tee -a "$LOG_DIR/test-cron.log"
  echo "{}" > "$RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json"
fi

# --- SUMMARY ---
ENTITIES=$(jq -r '.entities_checked // 0' "$RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json" 2>/dev/null || echo "0")
RFPS=$(jq -r '.total_rfps_detected // 0' "$RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json" 2>/dev/null || echo "0")
VERIFIED=$(jq -r '.verified_rfps // 0' "$RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json" 2>/dev/null || echo "0")
PERP_RATE=$(jq -r '.discovery_metrics.perplexity_primary_rate // 0' "$RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json" 2>/dev/null || echo "0")
COST=$(jq -r '.discovery_metrics.estimated_cost // 0' "$RUN_DIR/rfp_results_${MODE}_${STAMP}_clean.json" 2>/dev/null || echo "0")

echo "" | tee -a "$LOG_DIR/test-cron.log"
echo "╔════════════════════════════════════════════════════════════════╗" | tee -a "$LOG_DIR/test-cron.log"
echo "║  📊 BATCH SUMMARY                                              ║" | tee -a "$LOG_DIR/test-cron.log"
echo "║  Entities: $ENTITIES | RFPs: $RFPS | Verified: $VERIFIED                      ║" | tee -a "$LOG_DIR/test-cron.log"
PERP_RATE_PCT=$(echo "$PERP_RATE" | awk '{printf "%.0f", $1 * 100}')
echo "║  Perplexity Rate: ${PERP_RATE_PCT}% | Cost: \$$COST                     ║" | tee -a "$LOG_DIR/test-cron.log"
echo "╚════════════════════════════════════════════════════════════════╝" | tee -a "$LOG_DIR/test-cron.log"

echo "✅ Completed @ $STAMP ($MODE)" | tee -a "$LOG_DIR/test-cron.log"

