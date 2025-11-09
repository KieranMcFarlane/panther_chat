#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | BrightData-First RFP Detection (v1.0)
# ----------------------------------------------------------
# Strategy: BrightData comprehensive web → Perplexity validation → BrightData targeted
# Optimized for: Direct RFP documents, procurement portals, PDF links
# ==========================================================

# Set detection strategy for tagging results
export DETECTION_STRATEGY="brightdata"

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

CLAUDE_BIN="$(command -v claude || echo "$HOME/.nvm/versions/node/v20.18.3/bin/claude")"

# --- BATCH MODE HANDLING ---
MODE=${1:-batch1}
DEBUG=${2:-false}
BATCH_NUM=$(echo "$MODE" | grep -oE '[0-9]+')
BATCH_NUM=${BATCH_NUM:-1}  # fallback if grep returns empty
RANGE_START=$(( (BATCH_NUM - 1) * 300 ))
RANGE_END=$(( RANGE_START + 299 ))

# --- LOCK FILE (batch-specific AND strategy-specific to allow parallel execution) ---
LOCK="/tmp/rfp-monitor-brightdata-${MODE}.lock"
LOCK_TIMEOUT_HOURS=${LOCK_TIMEOUT_HOURS:-3}  # Consider lock stale after 3 hours

if [ -e "$LOCK" ]; then
  # Check if lock file is stale (cross-platform stat command)
  if [[ "$(uname)" == "Darwin" ]]; then
    # macOS stat command
    LOCK_MOD_TIME=$(stat -f %m "$LOCK" 2>/dev/null || echo "0")
  else
    # Linux stat command
    LOCK_MOD_TIME=$(stat -c %Y "$LOCK" 2>/dev/null || echo "0")
  fi
  
  if [ "$LOCK_MOD_TIME" != "0" ]; then
    CURRENT_TIME=$(date +%s)
    LOCK_AGE=$((CURRENT_TIME - LOCK_MOD_TIME))
    LOCK_AGE_HOURS=$((LOCK_AGE / 3600))
    LOCK_AGE_MINS=$(((LOCK_AGE % 3600) / 60))
    
    if [ "$LOCK_AGE_HOURS" -ge "$LOCK_TIMEOUT_HOURS" ]; then
      echo "🧹 Stale lock file detected (${LOCK_AGE_HOURS}h ${LOCK_AGE_MINS}m old) — removing and continuing..." | tee -a "$LOG_DIR/test-cron.log"
      rm -f "$LOCK"
    else
      echo "⚠️  Another RFP run for ${MODE} already in progress (lock ${LOCK_AGE_HOURS}h ${LOCK_AGE_MINS}m old) — skipping." | tee -a "$LOG_DIR/test-cron.log"
      echo "   To force run, remove: $LOCK" | tee -a "$LOG_DIR/test-cron.log"
      exit 0
    fi
  else
    # Could not read lock file age - assume stale and remove
    echo "⚠️  Could not determine lock file age — removing and continuing..." | tee -a "$LOG_DIR/test-cron.log"
    rm -f "$LOCK"
  fi
fi

trap 'rm -f "$LOCK"' EXIT
: > "$LOCK"

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

export SEARCH_MODE="${SEARCH_MODE:-granular}"
echo "🧭 SEARCH_MODE=$SEARCH_MODE" | tee -a "$LOG_DIR/test-cron.log"


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

# --- NORMALIZE NEO4J USER VARIABLE (handle both NEO4J_USER and NEO4J_USERNAME) ---
# Some .env files use NEO4J_USER, others use NEO4J_USERNAME - normalize to NEO4J_USERNAME
if [[ -n "${NEO4J_USER:-}" && -z "${NEO4J_USERNAME:-}" ]]; then
  export NEO4J_USERNAME="$NEO4J_USER"
fi

# --- LOAD NEO4J ENV VARIABLES (from mcp-config.json) ---
MCP_CFG="$BASE_DIR/mcp-config.json"
if [ -f "$MCP_CFG" ]; then
  # Extract values from JSON (may contain ${VAR} template strings)
  NEO4J_URI_TEMPLATE=$(jq -r '.mcpServers["neo4j-mcp"].env.NEO4J_URI' "$MCP_CFG")
  NEO4J_USERNAME_TEMPLATE=$(jq -r '.mcpServers["neo4j-mcp"].env.NEO4J_USERNAME' "$MCP_CFG")
  NEO4J_PASSWORD_TEMPLATE=$(jq -r '.mcpServers["neo4j-mcp"].env.NEO4J_PASSWORD' "$MCP_CFG")
  
  # Expand template variables using eval (safe since we control the template)
  # If template contains ${VAR}, expand it; otherwise use the template as-is
  if [[ "$NEO4J_URI_TEMPLATE" == *"\${"* ]]; then
    export NEO4J_URI=$(eval echo "$NEO4J_URI_TEMPLATE")
  else
    export NEO4J_URI="$NEO4J_URI_TEMPLATE"
  fi
  
  if [[ "$NEO4J_USERNAME_TEMPLATE" == *"\${"* ]]; then
    export NEO4J_USERNAME=$(eval echo "$NEO4J_USERNAME_TEMPLATE")
    # If expansion failed (still contains ${} or empty), use already-normalized NEO4J_USERNAME
    if [[ "$NEO4J_USERNAME" == *"\${"* || -z "$NEO4J_USERNAME" ]]; then
      # Use the already-normalized value from .env (NEO4J_USER -> NEO4J_USERNAME)
      export NEO4J_USERNAME="${NEO4J_USERNAME:-${NEO4J_USER:-}}"
    fi
  else
    export NEO4J_USERNAME="$NEO4J_USERNAME_TEMPLATE"
  fi
  
  if [[ "$NEO4J_PASSWORD_TEMPLATE" == *"\${"* ]]; then
    export NEO4J_PASSWORD=$(eval echo "$NEO4J_PASSWORD_TEMPLATE")
  else
    export NEO4J_PASSWORD="$NEO4J_PASSWORD_TEMPLATE"
  fi
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


# --- DEBUG: Check Neo4j Connection + Entity Fetch (randomized for verification) ---
echo "🔍 Testing Neo4j query before Claude run..." | tee -a "$LOG_DIR/test-cron.log"

if command -v cypher-shell >/dev/null 2>&1; then
  # Random query to verify each run is unique - shows different entities each time
  TEST_QUERY="MATCH (e:Entity) RETURN e.name, e.type ORDER BY rand() LIMIT 10;"
  echo "Running randomized test query: $TEST_QUERY" >> "$LOG_DIR/test-cron.log"
  echo "🎲 Random sample entities (verify each run shows different results):" | tee -a "$LOG_DIR/test-cron.log"
  cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USERNAME" -p "$NEO4J_PASSWORD" "$TEST_QUERY" 2>&1 | tee -a "$LOG_DIR/test-cron.log" || \
    echo "⚠️  Neo4j connection failed or no results." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  cypher-shell not installed or not in PATH — skipping direct Neo4j test." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 1: Run Claude (Batch Query + RFP Detection) ---
echo "🤖 Running Yellow Panther RFP Monitor..." | tee -a "$LOG_DIR/test-cron.log"

# Temporarily disable exit-on-error for Claude execution and JSON processing
# This ensures the script continues even if Claude fails or JSON parsing has issues
set +e

if [[ "$SEARCH_MODE" == "granular" ]]; then
  CLAUDE_TASK="
Query 50 entities from Neo4j (SKIP ${RANGE_START} LIMIT 50). For each:
1. BrightData web: <name> + <sport> + \"RFP\" OR \"tender\" filetype:pdf
2. Perplexity: Validate findings
3. Tag: ACTIVE_RFP (has PDF/document) or SIGNAL (news)
4. Write to Supabase with detection_strategy='brightdata'
5. Print: [ENTITY-FOUND] <name> or [ENTITY-NONE]

Return JSON:
{\"total_rfps_detected\": <n>, \"entities_checked\": <n>, \"detection_strategy\": \"brightdata\", \"highlights\": [{\"organization\": \"<name>\", \"src_link\": \"<url>\", \"detection_strategy\": \"brightdata\", \"summary_json\": {\"title\": \"<text>\", \"confidence\": <n>, \"urgency\": \"<level>\", \"fit_score\": <n>, \"rfp_type\": \"<type>\"}}], \"scoring_summary\": {\"avg_confidence\": <n>, \"avg_fit_score\": <n>, \"top_opportunity\": \"<name>\"}}
"
else
  CLAUDE_TASK="
1. Query 300 entities from Neo4j.
2. Group into 4-6 clusters by sport.
3. BrightData search for digital opportunities (RFPs + signals):
   - query: <sport> + (\"RFP\" OR \"tender\" OR \"invites proposals\" OR \"digital transformation\" OR \"mobile app\")
4. Classify results: 🟢 ACTIVE_RFP or 🟡 SIGNAL
5. Perplexity validation.
6. Write to Supabase with rfp_type classification.
7. Return JSON with both ACTIVE_RFPs and SIGNALs tagged.
"
fi

if ! gtimeout 45m "$CLAUDE_BIN" \
  -p "$CLAUDE_TASK" \
  --mcp-config "$MCP_PATH" \
  --allowedTools "mcp__neo4j-mcp__*,mcp__brightData__*,mcp__perplexity-mcp__*,mcp__supabase__*" \
  --permission-mode bypassPermissions \
  --output-format json \
  | tee >(awk '
      /\[BRIGHTDATA-START\]/ {print "🌐 BrightData: " $2 " — Crawling web..."; next}
      /\[PERPLEXITY-VALIDATE\]/ {print "🧠 Perplexity: " $2 " — Validating & enriching..."; next}
      /\[BRIGHTDATA-TARGETED\]/ {print "🎯 BrightData: " $2 " — Targeted domain search..."; next}
      /\[ENTITY-FOUND\]/ {print "✅ " $2 " — Found RFPs! (" $4 ")"; next}
      /\[ENTITY-NONE\]/  {print "⚪ " $2 " — No RFPs detected"; next}
      {print $0}
    ' >> "$LOG_DIR/test-cron.log") \
  > "$LOG_DIR/rfp_results_${MODE}_brightdata_${STAMP}.json" 2>> "$LOG_DIR/test-cron.log"; then
  echo "❌ Claude RFP detection failed or timed out - creating minimal result file" | tee -a "$LOG_DIR/test-cron.log"
  # Create minimal valid JSON result to allow script to continue
  echo '{"type":"result","subtype":"error","result":"Claude execution failed or timed out"}' > "$LOG_DIR/rfp_results_${MODE}_brightdata_${STAMP}.json"
fi


# --- CLEAN JSON EXTRACTION (new step) ---
RAW_FILE="$LOG_DIR/rfp_results_${MODE}_brightdata_${STAMP}.json"
CLEAN_FILE="$LOG_DIR/rfp_results_${MODE}_brightdata_${STAMP}_clean.json"

# Try multiple extraction strategies
if jq -e '.result' "$RAW_FILE" >/dev/null 2>&1; then
  # Extract result field and try to find JSON in it
  RESULT_TEXT=$(jq -r '.result' "$RAW_FILE")
  
  # Strategy 1: Try to extract JSON from markdown code blocks
  if printf '%s\n' "$RESULT_TEXT" | grep -q '```json'; then
    # Extract JSON between ```json and ```
    printf '%s\n' "$RESULT_TEXT" | sed -n '/```json/,/```/p' | sed '1d;$d' > "$CLEAN_FILE"
    # Validate extracted JSON
    if jq . "$CLEAN_FILE" >/dev/null 2>&1; then
      echo "✅ Extracted JSON from markdown code block → $CLEAN_FILE" | tee -a "$LOG_DIR/test-cron.log"
    else
      # Try alternative: extract JSON object directly from text
      printf '%s\n' "$RESULT_TEXT" | grep -oP '\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}' | head -1 > "$CLEAN_FILE" 2>/dev/null || true
      if jq . "$CLEAN_FILE" >/dev/null 2>&1; then
        echo "✅ Extracted JSON using regex fallback → $CLEAN_FILE" | tee -a "$LOG_DIR/test-cron.log"
      else
        echo "⚠️  Failed to extract valid JSON from markdown" | tee -a "$LOG_DIR/test-cron.log"
      fi
    fi
  # Strategy 2: Check if result itself is valid JSON with expected fields
  elif printf '%s\n' "$RESULT_TEXT" | jq -e '.total_rfps_detected' >/dev/null 2>&1; then
    printf '%s\n' "$RESULT_TEXT" > "$CLEAN_FILE"
    echo "✅ Result field is valid JSON → $CLEAN_FILE" | tee -a "$LOG_DIR/test-cron.log"
  # Strategy 3: Try to extract JSON object from text (look for complete object)
  elif printf '%s\n' "$RESULT_TEXT" | grep -q '{"total_rfps_detected"'; then
    # Extract from first { to last } for complete JSON object
    printf '%s\n' "$RESULT_TEXT" | sed -n '/{/,/^}$/p' | jq -s '.[0]' > "$CLEAN_FILE" 2>/dev/null
    if [ $? -eq 0 ] && [ -s "$CLEAN_FILE" ]; then
      echo "✅ Extracted JSON object from result text → $CLEAN_FILE" | tee -a "$LOG_DIR/test-cron.log"
    else
      # Fallback: create minimal valid JSON
      echo "{\"total_rfps_detected\": 0, \"entities_checked\": 0, \"highlights\": [], \"scoring_summary\": {\"avg_confidence\": 0, \"avg_fit_score\": 0, \"top_opportunity\": \"none\"}}" > "$CLEAN_FILE"
      echo "⚠️  JSON extraction failed — created minimal placeholder JSON" | tee -a "$LOG_DIR/test-cron.log"
      echo "⚠️  Claude may have returned markdown instead of JSON. Check raw file:" | tee -a "$LOG_DIR/test-cron.log"
      echo "   $RAW_FILE" | tee -a "$LOG_DIR/test-cron.log"
    fi
  else
    # Fallback: create minimal valid JSON and warn
    echo "{\"total_rfps_detected\": 0, \"entities_checked\": 0, \"highlights\": [], \"scoring_summary\": {\"avg_confidence\": 0, \"avg_fit_score\": 0, \"top_opportunity\": \"none\"}}" > "$CLEAN_FILE"
    echo "⚠️  Could not find JSON in result field — created minimal placeholder JSON" | tee -a "$LOG_DIR/test-cron.log"
    echo "   Raw file: $RAW_FILE" | tee -a "$LOG_DIR/test-cron.log"
  fi
else
  # No .result field - check if raw file is valid JSON with expected structure
  if jq -e '.total_rfps_detected' "$RAW_FILE" >/dev/null 2>&1; then
    cp "$RAW_FILE" "$CLEAN_FILE"
    echo "✅ Raw file is valid JSON with expected structure → $CLEAN_FILE" | tee -a "$LOG_DIR/test-cron.log"
  elif jq . "$RAW_FILE" >/dev/null 2>&1; then
    cp "$RAW_FILE" "$CLEAN_FILE"
    echo "⚠️  Raw file is valid JSON but missing expected fields → $CLEAN_FILE" | tee -a "$LOG_DIR/test-cron.log"
  else
    echo "{\"total_rfps_detected\": 0, \"entities_checked\": 0, \"highlights\": [], \"scoring_summary\": {\"avg_confidence\": 0, \"avg_fit_score\": 0, \"top_opportunity\": \"none\"}}" > "$CLEAN_FILE"
    echo "⚠️  Raw file is not valid JSON — created minimal placeholder JSON" | tee -a "$LOG_DIR/test-cron.log"
  fi
fi

# Validate that we have valid JSON in clean file
if ! jq . "$CLEAN_FILE" >/dev/null 2>&1; then
  echo "❌ ERROR: Clean JSON file is not valid JSON. Creating emergency fallback..." | tee -a "$LOG_DIR/test-cron.log"
  echo "   Raw file content preview:" | tee -a "$LOG_DIR/test-cron.log"
  head -20 "$RAW_FILE" | tee -a "$LOG_DIR/test-cron.log"
  # Create emergency fallback JSON to allow script to continue
  echo '{"total_rfps_detected": 0, "entities_checked": 0, "highlights": [], "scoring_summary": {"avg_confidence": 0, "avg_fit_score": 0, "top_opportunity": "none"}, "error": "JSON extraction failed"}' > "$CLEAN_FILE"
  echo "⚠️  Created emergency fallback JSON - batch will continue with 0 results" | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 2: Entity Coverage Check (use clean file) ---
ENTITIES_CHECKED=$(jq '.entities_checked // 0' "$CLEAN_FILE" 2>/dev/null || echo 0)
echo "🧩 Entities checked this run: ${ENTITIES_CHECKED}" | tee -a "$LOG_DIR/test-cron.log"
if [ "$ENTITIES_CHECKED" -lt 300 ]; then
  echo "⚠️  Warning: less than expected entities processed (should be ~300 per batch)." | tee -a "$LOG_DIR/test-cron.log"
fi

# Keep exit-on-error disabled for markdown/notifications - these are non-critical
# Script will complete successfully even if these steps fail

# --- STEP 3: Markdown Summary (uses clean JSON) ---
echo "🧠 Generating Markdown Summary..." | tee -a "$LOG_DIR/test-cron.log"

if ! gtimeout 10m "$CLAUDE_BIN" -p "
Summarize this JSON RFP detection file into a professional Markdown report for stakeholders.
Input: $LOG_DIR/rfp_results_${MODE}_brightdata_${STAMP}_clean.json
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
--output-format text > "$LOG_DIR/rfp_summary_${MODE}_brightdata_${STAMP}.md" 2>> "$LOG_DIR/test-cron.log"; then
  echo "⚠️  Markdown summary generation failed." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "✅ Markdown summary written → $LOG_DIR/rfp_summary_${MODE}_brightdata_${STAMP}.md" | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 4: Notifications (use clean file) ---
NEW_RFPS=$(jq '.total_rfps_detected // 0' "$CLEAN_FILE" 2>/dev/null || echo 0)

if [ "$NEW_RFPS" -gt 0 ]; then
  echo "📢 Sending notifications for $NEW_RFPS new RFP(s)..." | tee -a "$LOG_DIR/test-cron.log"

  SUMMARY=$(jq -r '
    .highlights? // [] |
    map("*" + (.organization // "Unknown Org") + "* - " + (.summary_json.title // "Untitled") + "\n<" + (.src_link // "no link") + ">") |
    join("\n\n")
  ' "$CLEAN_FILE" 2>/dev/null || echo "No highlights found")

  # --- EMAIL via Resend ---
  if [ -n "$RESEND_API_KEY" ]; then
    curl -s -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer $RESEND_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"from\": \"Yellow Panther <alerts@yellowpanther.ai>\",
        \"to\": [\"team@yellowpanther.ai\"],
        \"subject\": \"🟡 ${NEW_RFPS} New RFP(s) Detected [BrightData] (${MODE})\",
        \"html\": \"<h3>New RFP Opportunities [BrightData Strategy] (${MODE})</h3><pre>${SUMMARY}</pre><p>See logs/rfp_summary_${MODE}_brightdata_${STAMP}.md for details.</p>\"
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
  "$CLEAN_FILE" >> "$LOG_DIR/batch_summary.log" 2>/dev/null || true
