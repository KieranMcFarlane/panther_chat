#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | Daily RFP Detection System (v5)
# ----------------------------------------------------------
# Batch-aware version with SKIP/LIMIT for scalable iteration
# through 4k+ entities, Resend + Teams notifications, and
# Supabase persistence.
# ==========================================================

# --- BASIC PATHS ---
BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$LOG_DIR"

# Log all Claude MCP interactions for transparency
export CLAUDE_LOG_LEVEL=debug
export CLAUDE_LOG_FILE="$LOG_DIR/claude_mcp_trace_${STAMP}.log"

# --- LOAD ENV (.env or local .txt fallback) ---
if [ -f "$BASE_DIR/.env" ]; then
  echo "📦 Loading environment variables from .env" | tee -a "$LOG_DIR/test-cron.log"
  while IFS='=' read -r key value; do
    if [[ -z "$key" || "$key" =~ ^# ]]; then continue; fi
    value="${value%\"}"
    value="${value#\"}"
    export "$key"="$value"
  done < "$BASE_DIR/.env"
else
  echo "⚠️  .env file not found — falling back to local key files" | tee -a "$LOG_DIR/test-cron.log"
fi

# --- FALLBACK LOCAL KEYS ---
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.z.ai/api/anthropic}"
export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-$(cat $BASE_DIR/zai_key.txt 2>/dev/null || echo '')}"
export RESEND_API_KEY="${RESEND_API_KEY:-$(cat $BASE_DIR/resend_key.txt 2>/dev/null || echo '')}"
export TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-$(cat $BASE_DIR/teams_webhook.txt 2>/dev/null || echo '')}"

# --- LOG HEADER ---
{
  echo "=== RFP RUN @ $(date -u) (UTC) ==="
  echo "whoami: $(whoami)"
  echo "PATH: $PATH"
  echo "CLAUDE_AUTH: ${ANTHROPIC_AUTH_TOKEN:0:8}****"
  echo "RESEND_KEY: ${RESEND_API_KEY:0:6}****"
  echo "TEAMS_WEBHOOK: ${TEAMS_WEBHOOK_URL:+set}"
} >> "$LOG_DIR/test-cron.log" 2>&1

find "$LOG_DIR" -type f -mtime +7 -name "*.json" -delete

# --- LOAD NVM & PATHS ---
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
export PATH="$HOME/.nvm/versions/node/v20.18.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

# --- LOCK FILE ---
LOCK="/tmp/rfp-monitor.lock"
if [ -e "$LOCK" ]; then
  echo "⚠️  Another RFP run already in progress — exiting." | tee -a "$LOG_DIR/test-cron.log"
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT
: > "$LOCK"

CLAUDE_BIN="$(command -v claude || echo "$HOME/.nvm/versions/node/v20.18.3/bin/claude")"

# --- BATCH MODE HANDLING ---
MODE=${1:-batch1}
DEBUG=${2:-false}
BATCH_NUM=$(echo "$MODE" | grep -oE '[0-9]+')
BATCH_NUM=${BATCH_NUM:-1}  # fallback if grep returns empty
RANGE_START=$(( (BATCH_NUM - 1) * 300 ))
RANGE_END=$(( RANGE_START + 299 ))

# --- MCP CONFIG PATH ---
MCP_PATH="$BASE_DIR/mcp-config.json"

if [[ "$DEBUG" == "--debug" ]]; then
  echo "🧩 DEBUG MODE ENABLED" | tee -a "$LOG_DIR/test-cron.log"
  set -x  # enable bash trace
fi

echo "🧮 Running batch mode: ${MODE} (entities ${RANGE_START}-${RANGE_END})" | tee -a "$LOG_DIR/test-cron.log"

# --- SEARCH MODE TOGGLE (Clustered vs Granular) ---
#############################################
# 🔍 RFP Search Mode
# Options:
#   SEARCH_MODE=clustered  → few wide BrightData + 1 Perplexity pass (fast)
#   SEARCH_MODE=granular   → one BrightData query per entity + Perplexity scoring (deep)
#############################################

export SEARCH_MODE="${SEARCH_MODE:-clustered}"

if [[ "$SEARCH_MODE" == "granular" ]]; then
  echo "⚙️ Running in GRANULAR mode — BrightData will query each entity individually." | tee -a "$LOG_DIR/test-cron.log"
  export MAX_BRIGHTDATA_CALLS=300
  export PERPLEXITY_SCORING="true"
else
  echo "⚙️ Running in CLUSTERED mode — grouped entity searches for efficiency." | tee -a "$LOG_DIR/test-cron.log"
  export MAX_BRIGHTDATA_CALLS=5
  export PERPLEXITY_SCORING="false"
fi

echo "🧭 SEARCH_MODE=$SEARCH_MODE | BrightData limit=$MAX_BRIGHTDATA_CALLS | Perplexity scoring=$PERPLEXITY_SCORING" | tee -a "$LOG_DIR/test-cron.log"
echo ""

# --- LOAD NEO4J ENV VARIABLES (from mcp-config.json) ---
MCP_CFG="$BASE_DIR/mcp-config.json"
if [ -f "$MCP_CFG" ]; then
  export NEO4J_URI=$(jq -r '.mcpServers["neo4j-mcp"].env.NEO4J_URI' "$MCP_CFG")
  export NEO4J_USERNAME=$(jq -r '.mcpServers["neo4j-mcp"].env.NEO4J_USERNAME' "$MCP_CFG")
  export NEO4J_PASSWORD=$(jq -r '.mcpServers["neo4j-mcp"].env.NEO4J_PASSWORD' "$MCP_CFG")
else
  echo "⚠️  mcp-config.json not found — skipping Neo4j env setup." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- VALIDATE NEO4J VARIABLES ---
if [[ -z "${NEO4J_URI:-}" || -z "${NEO4J_USERNAME:-}" || -z "${NEO4J_PASSWORD:-}" ]]; then
  echo "⚠️  Missing one or more Neo4j credentials — check mcp-config.json" | tee -a "$LOG_DIR/test-cron.log"
else
  echo "✅ Neo4j credentials loaded from mcp-config.json" | tee -a "$LOG_DIR/test-cron.log"
fi

# ==========================================================
# 🌐 LOAD BRIGHTDATA ENV VARIABLES
# ==========================================================
if [ -f "$MCP_CFG" ]; then
  export BRIGHTDATA_API_TOKEN=$(jq -r '.mcpServers["brightData"].env.API_TOKEN // empty' "$MCP_CFG" 2>/dev/null || echo "")
  export BRIGHTDATA_PRO_MODE=$(jq -r '.mcpServers["brightData"].env.PRO_MODE // empty' "$MCP_CFG" 2>/dev/null || echo "")
else
  echo "⚠️  mcp-config.json not found — skipping BrightData env setup." | tee -a "$LOG_DIR/test-cron.log"
fi

if [[ -z "${BRIGHTDATA_API_TOKEN:-}" ]]; then
  echo "⚠️  Missing BrightData API token — BrightData MCP will not return live URLs." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "✅ BrightData credentials loaded from mcp-config.json" | tee -a "$LOG_DIR/test-cron.log"
fi


# ==========================================================
# 💾 LOAD SUPABASE ENV VARIABLES
# ==========================================================
if [ -f "$MCP_CFG" ]; then
  export SUPABASE_ACCESS_TOKEN=$(jq -r '.mcpServers["supabase"].env.SUPABASE_ACCESS_TOKEN // empty' "$MCP_CFG" 2>/dev/null || echo "")
else
  echo "⚠️  mcp-config.json not found — skipping Supabase env setup." | tee -a "$LOG_DIR/test-cron.log"
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "⚠️  Missing Supabase access token — Supabase MCP writes will fail." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "✅ Supabase token loaded from mcp-config.json" | tee -a "$LOG_DIR/test-cron.log"
fi


# ==========================================================
# 🧠 LOAD PERPLEXITY ENV VARIABLES
# ==========================================================
if [ -f "$MCP_CFG" ]; then
  export PERPLEXITY_API_KEY=$(jq -r '.mcpServers["perplexity-mcp"].env.PERPLEXITY_API_KEY // empty' "$MCP_CFG" 2>/dev/null || echo "")
else
  echo "⚠️  mcp-config.json not found — skipping Perplexity env setup." | tee -a "$LOG_DIR/test-cron.log"
fi

if [[ -z "${PERPLEXITY_API_KEY:-}" ]]; then
  echo "⚠️  Missing Perplexity API key — Perplexity MCP validation will be skipped." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "✅ Perplexity key loaded from mcp-config.json" | tee -a "$LOG_DIR/test-cron.log"
fi


# --- DEBUG: Check Neo4j Connection + Entity Fetch ---
echo "🔍 Testing Neo4j query before Claude run..." | tee -a "$LOG_DIR/test-cron.log"

if command -v cypher-shell >/dev/null 2>&1; then
  TEST_QUERY="MATCH (e:Entity) RETURN e.name, e.type LIMIT 5;"
  echo "Running test query: $TEST_QUERY" >> "$LOG_DIR/test-cron.log"
  cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USERNAME" -p "$NEO4J_PASSWORD" "$TEST_QUERY" >> "$LOG_DIR/test-cron.log" 2>&1 || \
    echo "⚠️  Neo4j connection failed or no results." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  cypher-shell not installed or not in PATH — skipping direct Neo4j test." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 1: Run Claude (Batch Query + RFP Detection) ---
echo "🤖 Running Yellow Panther RFP Monitor..." | tee -a "$LOG_DIR/test-cron.log"

if [[ "$SEARCH_MODE" == "granular" ]]; then
  CLAUDE_TASK="
Follow COMPLETE-RFP-MONITORING-SYSTEM.md to:

1. Query 300 entities from Neo4j MCP (neo4j-mcp):
   MATCH (e:Entity)
   WHERE e.type IN ['Club','League','Federation','Tournament']
   RETURN e.name, e.sport, e.country
   SKIP ${RANGE_START} LIMIT 300

2. For each entity:
   a. Print a progress update to stdout in this exact format:
      [ENTITY-START] <index> <organization_name>
   b. Perform one BrightData MCP (brightData) search:
      - query: <organization_name> + <sport> + (\"RFP\" OR \"Tender\" OR \"EOI\")
   c. If results found:
      Print: [ENTITY-FOUND] <organization_name> (<n> hits, confidence=<avg_conf>)
   d. If no RFP detected:
      Print: [ENTITY-NONE] <organization_name>
   e. Continue to next entity immediately.

3. Once all entities processed:
   Perform one Perplexity MCP (perplexity-mcp) pass to validate and re-score results.

4. Construct a structured JSON output with:
   {
     \"total_rfps_detected\": <int>,
     \"entities_checked\": <int>,
     \"highlights\": [
       {
         \"organization\": \"<name>\",
         \"src_link\": \"<url>\",
         \"summary_json\": {
           \"title\": \"<summary>\",
           \"confidence\": <float>,
           \"urgency\": \"<low|medium|high>\",
           \"fit_score\": <int>
         }
       }
     ],
     \"scoring_summary\": {
       \"avg_confidence\": <float>,
       \"avg_fit_score\": <float>,
       \"top_opportunity\": \"<organization>\"
     }
   }

5. Write structured results to **Supabase MCP (supabase)** table 'rfp_opportunities'.

6. Return a valid JSON response in this format:
   {
     \"total_rfps_detected\": <number>,
     \"entities_checked\": <number>,
     \"highlights\": [
       {
         \"organization\": \"<name>\",
         \"src_link\": \"<url>\",
         \"summary_json\": {
           \"title\": \"<summary>\",
           \"confidence\": <number>,
           \"urgency\": \"<low|medium|high>\",
           \"fit_score\": <number>
         }
       }
     ],
     \"scoring_summary\": {
       \"avg_confidence\": <number>,
       \"avg_fit_score\": <number>,
       \"top_opportunity\": \"<organization>\"
     }
   }
"
else
  CLAUDE_TASK="
Follow COMPLETE-RFP-MONITORING-SYSTEM.md to:
1. Query 300 entities from Neo4j.
2. Group them into 4–6 clusters by sport or region.
3. Perform one BrightData MCP search per cluster, then one Perplexity MCP cross-check.
4. Write all structured results to Supabase.
5. Return valid JSON as before.
"
fi

if ! gtimeout 25m "$CLAUDE_BIN" \
  -p "$CLAUDE_TASK" \
  --mcp-config "$MCP_PATH" \
  --allowedTools "mcp__neo4j-mcp__*,mcp__brightData__*,mcp__perplexity-mcp__*,mcp__supabase__*" \
  --permission-mode bypassPermissions \
  --output-format json \
  | tee >(awk '
      /\[ENTITY-START\]/ {print "🔍 " $3 " — Starting search..."; next}
      /\[ENTITY-FOUND\]/ {print "✅ " $2 " — Found RFPs! (" $4 ")"; next}
      /\[ENTITY-NONE\]/  {print "⚪ " $2 " — No RFPs detected"; next}
      {print $0}
    ' >> "$LOG_DIR/test-cron.log") \
  > "$LOG_DIR/rfp_results_${MODE}_${STAMP}.json" 2>> "$LOG_DIR/test-cron.log"; then
  echo "❌ Claude RFP detection failed or timed out." | tee -a "$LOG_DIR/test-cron.log"
fi


# --- CLEAN JSON EXTRACTION (new step) ---
RAW_FILE="$LOG_DIR/rfp_results_${MODE}_${STAMP}.json"
CLEAN_FILE="$LOG_DIR/rfp_results_${MODE}_${STAMP}_clean.json"

if jq -e '.result' "$RAW_FILE" >/dev/null 2>&1; then
  jq -r '.result' "$RAW_FILE" | sed -n '/```json/,/```/p' | sed '1d;$d' > "$CLEAN_FILE"
  echo "✅ Extracted clean JSON → $CLEAN_FILE" | tee -a "$LOG_DIR/test-cron.log"
else
  cp "$RAW_FILE" "$CLEAN_FILE"
  echo "⚠️  No .result field — used raw JSON" | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 2: Entity Coverage Check ---
ENTITIES_CHECKED=$(jq '.entities_checked // 0' "$LOG_DIR/rfp_results_${MODE}_${STAMP}.json" 2>/dev/null || echo 0)
echo "🧩 Entities checked this run: ${ENTITIES_CHECKED}" | tee -a "$LOG_DIR/test-cron.log"
if [ "$ENTITIES_CHECKED" -lt 300 ]; then
  echo "⚠️  Warning: less than expected entities processed (should be ~300 per batch)." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 3: Markdown Summary (uses clean JSON) ---
echo "🧠 Generating Markdown Summary..." | tee -a "$LOG_DIR/test-cron.log"

if ! gtimeout 10m "$CLAUDE_BIN" -p "
Summarize this JSON RFP detection file into a professional Markdown report for stakeholders.
Input: $LOG_DIR/rfp_results_${MODE}_${STAMP}_clean.json
Include:
- Total RFPs detected
- Top 5 opportunities (title, org, confidence, deadline, budget if available)
- Geographic coverage
- Recommended actions (Immediate, Short-term, Medium-term)
- System performance and integrations
Format elegantly with emojis for readability.
" \
--mcp-config "$MCP_PATH" \
--permission-mode bypassPermissions \
--output-format text > "$LOG_DIR/rfp_summary_${MODE}_${STAMP}.md" 2>> "$LOG_DIR/test-cron.log"; then
  echo "⚠️  Markdown summary generation failed." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "✅ Markdown summary written → $LOG_DIR/rfp_summary_${MODE}_${STAMP}.md" | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 4: Notifications ---
NEW_RFPS=$(jq '.total_rfps_detected // 0' "$LOG_DIR/rfp_results_${MODE}_${STAMP}.json" 2>/dev/null || echo 0)

if [ "$NEW_RFPS" -gt 0 ]; then
  echo "📢 Sending notifications for $NEW_RFPS new RFP(s)..." | tee -a "$LOG_DIR/test-cron.log"

  SUMMARY=$(jq -r '
    .highlights? // [] |
    map("*" + (.organization // "Unknown Org") + "* — " + (.summary_json.title // "Untitled") + "\n<" + (.src_link // "no link") + ">") |
    join("\n\n")
  ' "$LOG_DIR/rfp_results_${MODE}_${STAMP}.json" 2>/dev/null || echo "No highlights found")

  # --- EMAIL via Resend ---
  if [ -n "$RESEND_API_KEY" ]; then
    curl -s -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer $RESEND_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"from\": \"Yellow Panther <alerts@yellowpanther.ai>\",
        \"to\": [\"team@yellowpanther.ai\"],
        \"subject\": \"🟡 ${NEW_RFPS} New RFP(s) Detected (${MODE})\",
        \"html\": \"<h3>New RFP Opportunities (${MODE})</h3><pre>${SUMMARY}</pre><p>See logs/rfp_summary_${MODE}_${STAMP}.md for details.</p>\"
      }" >/dev/null 2>&1 && echo "✅ Email sent via Resend" >> "$LOG_DIR/test-cron.log" || echo "⚠️  Email send failed" >> "$LOG_DIR/test-cron.log"
  else
    echo "⚠️  RESEND_API_KEY missing — skipping email" >> "$LOG_DIR/test-cron.log"
  fi

  # --- TEAMS WEBHOOK ---
  if [ -n "$TEAMS_WEBHOOK_URL" ]; then
    curl -s -H "Content-Type: application/json" -d "{
      \"@type\": \"MessageCard\",
      \"@context\": \"https://schema.org/extensions\",
      \"summary\": \"Yellow Panther RFP Alert (${MODE})\",
      \"themeColor\": \"0078D7\",
      \"title\": \"🟡 ${NEW_RFPS} New RFP(s) Detected (${MODE})\",
      \"text\": \"${SUMMARY}\"
    }" "$TEAMS_WEBHOOK_URL" >/dev/null 2>&1 && echo "✅ Teams alert sent" >> "$LOG_DIR/test-cron.log" || echo "⚠️  Teams webhook failed" >> "$LOG_DIR/test-cron.log"
  else
    echo "⚠️  TEAMS_WEBHOOK_URL missing — skipping Teams alert" >> "$LOG_DIR/test-cron.log"
  fi

else
  echo "ℹ️  No new RFPs detected — skipping notifications." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 5: Cleanup Old Logs ---
find "$LOG_DIR" -type f -mtime +7 -name "*.md" -delete
find "$LOG_DIR" -type f -mtime +30 -name "*.log" -delete

echo "✅ Completed RFP Monitor Run @ $STAMP (${MODE})" | tee -a "$LOG_DIR/test-cron.log"
jq -r '{timestamp: "'$STAMP'", mode: "'$MODE'", total_rfps_detected, avg_confidence: .scoring_summary.avg_confidence, top_opportunity: .scoring_summary.top_opportunity}' \
  "$LOG_DIR/rfp_results_${MODE}_${STAMP}.json" >> "$LOG_DIR/batch_summary.log" 2>/dev/null || true
