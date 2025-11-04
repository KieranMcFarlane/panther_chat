#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | Daily RFP Detection System (v4.1)
# ----------------------------------------------------------
# Full production-ready script.
# ✅ Loads .env (for servers)
# ✅ Falls back to .txt secrets (for local)
# ✅ Sends Resend + Teams notifications
# ✅ Compatible with cron + Render + Supabase Edge
# ==========================================================

# --- BASIC PATHS ---
BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$LOG_DIR"

# Log all Claude MCP interactions for transparency
export CLAUDE_LOG_LEVEL=debug
export CLAUDE_LOG_FILE="$LOG_DIR/claude_mcp_trace_${STAMP}.log"

# --- LOAD .env IF PRESENT ---
if [ -f "$BASE_DIR/.env" ]; then
  echo "📦 Loading environment variables from .env" | tee -a "$LOG_DIR/test-cron.log"
  # Read each line that has KEY=VALUE (ignore comments & blanks)
  while IFS='=' read -r key value; do
    # Skip empty or comment lines
    if [[ -z "$key" || "$key" =~ ^# ]]; then
      continue
    fi
    # Trim surrounding quotes
    value="${value%\"}"
    value="${value#\"}"
    export "$key"="$value"
  done < "$BASE_DIR/.env"
else
  echo "⚠️  .env file not found — falling back to local key files" | tee -a "$LOG_DIR/test-cron.log"
fi

# --- FALLBACK TO LOCAL TXT KEYS ---
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.z.ai/api/anthropic}"
export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-$(cat $BASE_DIR/zai_key.txt 2>/dev/null || echo '')}"
export RESEND_API_KEY="${RESEND_API_KEY:-$(cat $BASE_DIR/resend_key.txt 2>/dev/null || echo '')}"
export TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-$(cat $BASE_DIR/teams_webhook.txt 2>/dev/null || echo '')}"

# --- ENVIRONMENT CHECK ---
{
  echo "=== RFP RUN @ $(date -u) (UTC) ==="
  echo "whoami: $(whoami)"
  echo "PATH: $PATH"
  echo "CLAUDE_AUTH: ${ANTHROPIC_AUTH_TOKEN:0:8}****"
  echo "RESEND_KEY: ${RESEND_API_KEY:0:6}****"
  echo "TEAMS_WEBHOOK: ${TEAMS_WEBHOOK_URL:+set}"
} >> "$LOG_DIR/test-cron.log" 2>&1

# --- PATH & LOCK ---
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
export PATH="$HOME/.nvm/versions/node/v20.18.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

LOCK="/tmp/rfp-monitor.lock"
if [ -e "$LOCK" ]; then
  echo "⚠️  Another RFP run already in progress — exiting." | tee -a "$LOG_DIR/test-cron.log"
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT
: > "$LOCK"

CLAUDE_BIN="$(command -v claude || echo "$HOME/.nvm/versions/node/v20.18.3/bin/claude")"

# --- STEP 1: Run main RFP detection ---
echo "🤖 Running Yellow Panther RFP Monitor..." | tee -a "$LOG_DIR/test-cron.log"
if ! gtimeout 20m "$CLAUDE_BIN" -p "
Follow COMPLETE-RFP-MONITORING-SYSTEM.md to:
1. Query ALL entities from Neo4j using:
   MATCH (e:Entity)
   WHERE e.type IN ['Club','League','Federation','Tournament']
   RETURN e.name, e.sport, e.country
2. Process entities in batches of 300 until all (~4,000) have been checked.
   Maintain running JSON state between batches (do not reset).
3. For each batch:
   - Use BrightData and Perplexity to detect RFPs.
   - Append structured records {organization, type, sport, country, src_link, summary_json, confidence, detected_at} to a cumulative list.
4. Write all unique records to Supabase (table: rfp_opportunities).
5. Return structured JSON summary with total_rfps_detected, entities_checked, and batch_count.
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "mcp__neo4j__*,mcp__brightdata__*,mcp__perplexity__*,mcp__supabase__*" \
--permission-mode bypassPermissions \
--output-format json > "$LOG_DIR/rfp_results_${STAMP}.json" 2>> "$LOG_DIR/test-cron.log"; then
  echo "❌ Claude RFP detection failed or timed out." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 2: Markdown Summary ---
echo "🧠 Generating Markdown Summary..." | tee -a "$LOG_DIR/test-cron.log"
if ! gtimeout 10m "$CLAUDE_BIN" -p "
Summarize ./logs/rfp_results_${STAMP}.json in Markdown.
Include:
- Total RFPs detected
- Avg confidence
- Source URLs (src_link) for top 5
- Recommended actions
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "Read,Write" \
--permission-mode bypassPermissions \
--output-format text > "$LOG_DIR/rfp_summary_${STAMP}.md" 2>> "$LOG_DIR/test-cron.log"; then
  echo "⚠️  Markdown summary generation failed." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 3: Notification Phase ---
NEW_RFPS=$(jq '.total_rfps_detected // 0' "$LOG_DIR/rfp_results_${STAMP}.json" 2>/dev/null || echo 0)

if [ "$NEW_RFPS" -gt 0 ]; then
  echo "📢 Sending notifications for $NEW_RFPS new RFP(s)..." | tee -a "$LOG_DIR/test-cron.log"

  SUMMARY=$(jq -r '
    .highlights? // [] |
    map("*" + (.organization // "Unknown Org") + "* — " + (.summary_json.title // "Untitled") + "\n<" + (.src_link // "no link") + ">") |
    join("\n\n")
  ' "$LOG_DIR/rfp_results_${STAMP}.json" 2>/dev/null || echo "No highlights found")

  # --- EMAIL via Resend ---
  if [ -n "$RESEND_API_KEY" ]; then
    curl -s -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer $RESEND_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"from\": \"Yellow Panther <alerts@yellowpanther.ai>\",
        \"to\": [\"team@yellowpanther.ai\"],
        \"subject\": \"🟡 ${NEW_RFPS} New RFP(s) Detected\",
        \"html\": \"<h3>New RFP Opportunities</h3><pre>${SUMMARY}</pre><p>See logs/rfp_summary_${STAMP}.md for details.</p>\"
      }" >/dev/null 2>&1 && echo "✅ Email sent via Resend" >> "$LOG_DIR/test-cron.log" || echo "⚠️  Email send failed" >> "$LOG_DIR/test-cron.log"
  else
    echo "⚠️  RESEND_API_KEY missing — skipping email" >> "$LOG_DIR/test-cron.log"
  fi

  # --- TEAMS WEBHOOK ---
  if [ -n "$TEAMS_WEBHOOK_URL" ]; then
    curl -s -H "Content-Type: application/json" -d "{
      \"@type\": \"MessageCard\",
      \"@context\": \"https://schema.org/extensions\",
      \"summary\": \"Yellow Panther RFP Alert\",
      \"themeColor\": \"0078D7\",
      \"title\": \"🟡 ${NEW_RFPS} New RFP(s) Detected\",
      \"text\": \"${SUMMARY}\"
    }" "$TEAMS_WEBHOOK_URL" >/dev/null 2>&1 && echo "✅ Teams alert sent" >> "$LOG_DIR/test-cron.log" || echo "⚠️  Teams webhook failed" >> "$LOG_DIR/test-cron.log"
  else
    echo "⚠️  TEAMS_WEBHOOK_URL missing — skipping Teams alert" >> "$LOG_DIR/test-cron.log"
  fi

else
  echo "ℹ️  No new RFPs detected — skipping notifications." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 4: Clean Logs ---
find "$LOG_DIR" -type f -mtime +7 -name "*.json" -delete
find "$LOG_DIR" -type f -mtime +7 -name "*.md" -delete
find "$LOG_DIR" -type f -mtime +30 -name "*.log" -delete

echo "✅ Completed RFP Monitor Run @ $STAMP" | tee -a "$LOG_DIR/test-cron.log"
