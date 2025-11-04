#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | Daily RFP Detection System (v4)
# ----------------------------------------------------------
# Adds: src_link persistence + Resend + Teams notifications
# ==========================================================

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
export PATH="$HOME/.nvm/versions/node/v20.18.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$LOG_DIR"

LOCK="/tmp/rfp-monitor.lock"
if [ -e "$LOCK" ]; then
  echo "⚠️  Another run in progress — exiting." | tee -a "$LOG_DIR/test-cron.log"
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT
: > "$LOCK"

# --- ENV KEYS ---
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="$(cat $BASE_DIR/zai_key.txt)"
RESEND_API_KEY="${RESEND_API_KEY:-}"
TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-}"

CLAUDE_BIN="$(command -v claude || echo "$HOME/.nvm/versions/node/v20.18.3/bin/claude")"

# --- STEP 1: Run main RFP detection ---
echo "🤖 Running Yellow Panther RFP Monitor..."
if ! gtimeout 20m "$CLAUDE_BIN" -p "
Follow COMPLETE-RFP-MONITORING-SYSTEM.md to:
1. Query all Club/League/Federation/Tournament entities from Neo4j.
2. Use BrightData + Perplexity to detect new RFPs, extract {organization, type, sport, country, src_link, summary_json, confidence, detected_at}.
3. Write each record to Supabase (table: rfp_opportunities).
4. Return summary JSON with total_rfps_detected and key links.
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "mcp__neo4j__*,mcp__brightdata__*,mcp__perplexity__*,mcp__supabase__*" \
--permission-mode bypassPermissions \
--output-format json > "$LOG_DIR/rfp_results_${STAMP}.json" 2>> "$LOG_DIR/test-cron.log"; then
  echo "❌ Claude RFP detection failed or timed out." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 2: Markdown Summary ---
echo "🧠 Generating Markdown Summary..."
gtimeout 10m "$CLAUDE_BIN" -p "
Summarize ./logs/rfp_results_${STAMP}.json in Markdown.
Include: total detected, avg confidence, src_link URLs for top 5.
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "Read,Write" \
--permission-mode bypassPermissions \
--output-format text > "$LOG_DIR/rfp_summary_${STAMP}.md" 2>> "$LOG_DIR/test-cron.log"

# --- STEP 3: Notification Phase ---
NEW_RFPS=$(jq '.total_rfps_detected // 0' "$LOG_DIR/rfp_results_${STAMP}.json" 2>/dev/null || echo 0)

if [ "$NEW_RFPS" -gt 0 ]; then
  echo "📢 Sending notifications for $NEW_RFPS new RFPs..."

  # Extract highlights for notifications
  SUMMARY=$(jq -r '
    .highlights? // [] |
    map("*" + (.organization // "Unknown") + "* — " + (.summary_json.title // "Untitled") + "\n<" + (.src_link // "no link") + ">") |
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
        \"subject\": \"🟡 $NEW_RFPS New RFPs Detected\",
        \"html\": \"<h3>New RFP Opportunities</h3><pre>${SUMMARY}</pre><p>See logs/rfp_summary_${STAMP}.md for details.</p>\"
      }" >/dev/null 2>&1 || echo "⚠️  Email send failed" >> "$LOG_DIR/test-cron.log"
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
      \"title\": \"🟡 ${NEW_RFPS} New RFPs Detected\",
      \"text\": \"${SUMMARY}\"
    }" "$TEAMS_WEBHOOK_URL" >/dev/null 2>&1 || echo "⚠️  Teams webhook failed" >> "$LOG_DIR/test-cron.log"
  else
    echo "⚠️  TEAMS_WEBHOOK_URL missing — skipping Teams post" >> "$LOG_DIR/test-cron.log"
  fi
else
  echo "ℹ️  No new RFPs detected — skipping notifications." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 4: Log Cleanup ---
find "$LOG_DIR" -type f -mtime +7 -name "*.json" -delete
find "$LOG_DIR" -type f -mtime +7 -name "*.md" -delete
find "$LOG_DIR" -type f -mtime +30 -name "*.log" -delete

echo "✅ Completed run @ $STAMP" | tee -a "$LOG_DIR/test-cron.log"
