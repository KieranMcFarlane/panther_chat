#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | RFP Aggregate Report Generator (v3)
# ----------------------------------------------------------
# Combines all batch results into a single master report,
# generates an executive Markdown summary, posts to Supabase,
# and sends notifications via Resend + Teams.
# ==========================================================

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
MASTER_JSON="$LOG_DIR/rfp_master_report_${STAMP}.json"
MASTER_MD="$LOG_DIR/rfp_master_summary_${STAMP}.md"

mkdir -p "$LOG_DIR"

echo "🧩 Aggregating batch results into master report..." | tee -a "$LOG_DIR/test-cron.log"

# --- Load .env (for keys) ---
if [ -f "$BASE_DIR/.env" ]; then
  while IFS='=' read -r key value; do
    if [[ -z "$key" || "$key" =~ ^# ]]; then continue; fi
    value="${value%\"}"
    value="${value#\"}"
    export "$key"="$value"
  done < "$BASE_DIR/.env"
fi

# --- Fallback key files ---
export RESEND_API_KEY="${RESEND_API_KEY:-$(cat $BASE_DIR/resend_key.txt 2>/dev/null || echo '')}"
export TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-$(cat $BASE_DIR/teams_webhook.txt 2>/dev/null || echo '')}"
export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-$(cat $BASE_DIR/zai_key.txt 2>/dev/null || echo '')}"
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.z.ai/api/anthropic}"

CLAUDE_BIN="$(command -v claude || echo "$HOME/.nvm/versions/node/v20.18.3/bin/claude")"

# --- Merge all rfp_results_batch*.json files ---
jq -s '
  {
    total_batches: length,
    total_rfps_detected: (map(.total_rfps_detected // 0) | add),
    entities_checked: (map(.entities_checked // 0) | add),
    all_highlights: (map(.highlights // []) | add)
  }
' "$LOG_DIR"/rfp_results_batch*.json > "$MASTER_JSON"

TOTAL_RFPS=$(jq '.total_rfps_detected' "$MASTER_JSON")
ENTITIES_CHECKED=$(jq '.entities_checked' "$MASTER_JSON")

echo "📊 Aggregated $TOTAL_RFPS RFPs across $ENTITIES_CHECKED entities." | tee -a "$LOG_DIR/test-cron.log"

# --- Generate Markdown summary via Claude ---
echo "🧠 Generating master summary..." | tee -a "$LOG_DIR/test-cron.log"
if ! gtimeout 10m "$CLAUDE_BIN" -p "
You are Yellow Panther’s data analyst.
Summarize ./logs/rfp_master_report_${STAMP}.json in Markdown for the executive team.
Include:

- Total RFPs detected and total entities checked
- Top 10 organizations with new opportunities
- Key sports sectors and regions (count and share)
- Average confidence if available
- Weekly trends and recommended focus areas
- Mention that data comes from all 15 batch scans
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "Read,Write" \
--permission-mode bypassPermissions \
--output-format text > "$MASTER_MD" 2>> "$LOG_DIR/test-cron.log"; then
  echo "⚠️  Master summary generation failed." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- Upload aggregate report to Supabase ---
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_ANON_KEY:-}" ]]; then
  curl -s -X POST "${SUPABASE_URL}/rest/v1/rfp_master_reports" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"created_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
      \"total_rfps\": ${TOTAL_RFPS},
      \"entities_checked\": ${ENTITIES_CHECKED},
      \"json_path\": \"${MASTER_JSON}\",
      \"md_path\": \"${MASTER_MD}\"
    }" >/dev/null 2>&1 && echo "📡 Uploaded master report to Supabase." | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  Missing Supabase credentials — skipping upload." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- Notifications (Resend + Teams) ---
SUBJECT="🟡 Yellow Panther | RFP Aggregate Report — $(date +'%b %d, %Y')"

if [ -n "$RESEND_API_KEY" ]; then
  curl -s -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"from\": \"Yellow Panther <alerts@yellowpanther.ai>\",
      \"to\": [\"team@yellowpanther.ai\"],
      \"subject\": \"${SUBJECT}\",
      \"html\": \"<h2>${SUBJECT}</h2><p>Total RFPs: ${TOTAL_RFPS}</p><p>Entities checked: ${ENTITIES_CHECKED}</p><hr><pre>$(cat "$MASTER_MD" | head -n 40)</pre>\"
    }" >/dev/null 2>&1 && echo "✅ Master email sent via Resend" | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  RESEND_API_KEY missing — skipping master email." | tee -a "$LOG_DIR/test-cron.log"
fi

if [ -n "$TEAMS_WEBHOOK_URL" ]; then
  SUMMARY_TEXT=$(jq -r '.all_highlights[:5] | map("*" + (.organization // "Unknown Org") + "* — <" + (.src_link // "no link") + ">") | join("\n")' "$MASTER_JSON")
  curl -s -H "Content-Type: application/json" -d "{
    \"@type\": \"MessageCard\",
    \"@context\": \"https://schema.org/extensions\",
    \"summary\": \"RFP Aggregate Report\",
    \"themeColor\": \"0078D7\",
    \"title\": \"${SUBJECT}\",
    \"text\": \"${SUMMARY_TEXT}\"
  }" "$TEAMS_WEBHOOK_URL" >/dev/null 2>&1 && echo "✅ Teams summary sent" | tee -a "$LOG_DIR/test-cron.log"
else
  echo "⚠️  TEAMS_WEBHOOK_URL missing — skipping Teams summary." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- Archive old logs ---
echo "📦 Archiving logs..." | tee -a "$LOG_DIR/test-cron.log"
tar -czf "$LOG_DIR/archive_${STAMP}.tar.gz" "$LOG_DIR"/rfp_results_batch*.json "$LOG_DIR"/rfp_summary_batch*.md "$MASTER_JSON" "$MASTER_MD" >/dev/null 2>&1
find "$LOG_DIR" -type f -mtime +7 -name "rfp_results_batch*.json" -delete
find "$LOG_DIR" -type f -mtime +7 -name "rfp_summary_batch*.md" -delete
find "$LOG_DIR" -type f -mtime +30 -name "*.log" -delete

echo "✅ Aggregation complete. Master report ready: $MASTER_JSON" | tee -a "$LOG_DIR/test-cron.log"
