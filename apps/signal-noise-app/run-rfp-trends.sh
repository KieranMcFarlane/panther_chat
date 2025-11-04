#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | RFP Trend Analyzer (v2)
# ----------------------------------------------------------
# • Compares today's & yesterday's master reports
# • Extracts daily RFP trend insights
# • Sends email + Teams summaries
# • Persists structured history to Supabase
# ==========================================================

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
TREND_JSON="$LOG_DIR/rfp_trend_analysis_${STAMP}.json"
TREND_MD="$LOG_DIR/rfp_trend_summary_${STAMP}.md"
mkdir -p "$LOG_DIR"

echo "📊 Running daily RFP trend analysis (v2)..." | tee -a "$LOG_DIR/test-cron.log"

# --- Load environment variables from .env ---
if [ -f "$BASE_DIR/.env" ]; then
  echo "📦 Loading .env variables" | tee -a "$LOG_DIR/test-cron.log"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    value="${value%\"}"; value="${value#\"}"
    export "$key"="$value"
  done < "$BASE_DIR/.env"
fi

# --- Fallback keys for local runs ---
export RESEND_API_KEY="${RESEND_API_KEY:-$(cat $BASE_DIR/resend_key.txt 2>/dev/null || echo '')}"
export TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-$(cat $BASE_DIR/teams_webhook.txt 2>/dev/null || echo '')}"
export SUPABASE_URL="${SUPABASE_URL:-}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-$(cat $BASE_DIR/zai_key.txt 2>/dev/null || echo '')}"
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.z.ai/api/anthropic}"

CLAUDE_BIN="$(command -v claude || echo "$HOME/.nvm/versions/node/v20.18.3/bin/claude")"

# --- Fetch the 2 most recent master reports from Supabase ---
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Supabase credentials missing. Skipping trend analysis." | tee -a "$LOG_DIR/test-cron.log"
  exit 0
fi

REPORTS_JSON="$LOG_DIR/tmp_reports_${STAMP}.json"
curl -s "${SUPABASE_URL}/rest/v1/rfp_master_reports?order=created_at.desc&limit=2" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -o "$REPORTS_JSON"

NUM_REPORTS=$(jq 'length' "$REPORTS_JSON")
if [ "$NUM_REPORTS" -lt 2 ]; then
  echo "ℹ️  Not enough reports to compare (need at least 2)." | tee -a "$LOG_DIR/test-cron.log"
  exit 0
fi

TODAY_JSON=$(jq -r '.[0].json_path' "$REPORTS_JSON")
YESTERDAY_JSON=$(jq -r '.[1].json_path' "$REPORTS_JSON")

echo "🧮 Comparing:" | tee -a "$LOG_DIR/test-cron.log"
echo "   Today: $TODAY_JSON" | tee -a "$LOG_DIR/test-cron.log"
echo "   Yesterday: $YESTERDAY_JSON" | tee -a "$LOG_DIR/test-cron.log"

# --- Step 1: Generate JSON trend analysis ---
if ! gtimeout 10m "$CLAUDE_BIN" -p "
Compare these two RFP master reports:
- File 1: $YESTERDAY_JSON (yesterday)
- File 2: $TODAY_JSON (today)

Output a JSON object:
{
  \"total_change\": number,
  \"new_rfps\": [ {\"organization\": string, \"sport\": string, \"country\": string, \"src_link\": string} ],
  \"dropped_rfps\": [string],
  \"top_growing_sectors\": [string],
  \"regional_trends\": [{\"region\": string, \"change\": number}],
  \"confidence_trend\": {\"yesterday_avg\": number, \"today_avg\": number, \"delta\": number},
  \"growth_rate\": number,
  \"strategic_recommendation\": string
}
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "Read,Write" \
--permission-mode bypassPermissions \
--output-format json > "$TREND_JSON" 2>> "$LOG_DIR/test-cron.log"; then
  echo "⚠️  Trend analysis generation failed." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- Step 2: Create Markdown summary ---
if ! gtimeout 5m "$CLAUDE_BIN" -p "
Summarize ./logs/rfp_trend_analysis_${STAMP}.json in Markdown.
Include:
- Overall RFP volume change
- Top 3 new sectors
- Regional shifts
- Confidence delta
- Strategic recommendation
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "Read,Write" \
--permission-mode bypassPermissions \
--output-format text > "$TREND_MD" 2>> "$LOG_DIR/test-cron.log"; then
  echo "⚠️  Markdown summary generation failed." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- Step 3: Email + Teams notifications ---
SUBJECT="🟡 Yellow Panther | Daily RFP Trend Insights — $(date +'%b %d, %Y')"
SUMMARY_HTML="<h2>${SUBJECT}</h2><pre>$(cat "$TREND_MD")</pre>"

if [ -n "$RESEND_API_KEY" ]; then
  curl -s -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"from\": \"Yellow Panther <alerts@yellowpanther.ai>\",
      \"to\": [\"team@yellowpanther.ai\"],
      \"subject\": \"${SUBJECT}\",
      \"html\": \"${SUMMARY_HTML}\"
    }" >/dev/null 2>&1 && echo "✅ Trend email sent" | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  RESEND_API_KEY missing — skipping email." | tee -a "$LOG_DIR/test-cron.log"
fi

if [ -n "$TEAMS_WEBHOOK_URL" ]; then
  RECOMMEND=$(jq -r '.strategic_recommendation // "No recommendation."' "$TREND_JSON")
  curl -s -H "Content-Type: application/json" -d "{
    \"@type\": \"MessageCard\",
    \"@context\": \"https://schema.org/extensions\",
    \"summary\": \"RFP Trend Insights\",
    \"themeColor\": \"0078D7\",
    \"title\": \"${SUBJECT}\",
    \"text\": \"${RECOMMEND}\"
  }" "$TEAMS_WEBHOOK_URL" >/dev/null 2>&1 && echo "✅ Teams alert sent" | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  TEAMS_WEBHOOK_URL missing — skipping Teams alert." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- Step 4: Persist trend history to Supabase ---
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; then
  TOTAL_CHANGE=$(jq '.total_change // 0' "$TREND_JSON")
  GROWTH=$(jq '.growth_rate // 0' "$TREND_JSON")
  CONF=$(jq '.confidence_trend.today_avg // 0' "$TREND_JSON")
  SECTORS=$(jq '.top_growing_sectors // []' "$TREND_JSON")
  REGIONS=$(jq '.regional_trends // []' "$TREND_JSON")
  RECOMMEND=$(jq -r '.strategic_recommendation // ""' "$TREND_JSON")

  curl -s -X POST "${SUPABASE_URL}/rest/v1/rfp_trends_history" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"date\": \"$(date -u +%Y-%m-%d)\",
      \"total_rfps\": ${TOTAL_CHANGE},
      \"avg_confidence\": ${CONF},
      \"top_sectors\": ${SECTORS},
      \"top_regions\": ${REGIONS},
      \"growth_rate\": ${GROWTH},
      \"strategic_recommendation\": \"${RECOMMEND}\"
    }" >/dev/null 2>&1 && echo "📡 Trend history saved to Supabase" | tee -a "$LOG_DIR/test-cron.log"
fi

echo "✅ Trend analysis complete. Files saved:" | tee -a "$LOG_DIR/test-cron.log"
echo "   JSON: $TREND_JSON" | tee -a "$LOG_DIR/test-cron.log"
echo "   MD:   $TREND_MD" | tee -a "$LOG_DIR/test-cron.log"
