#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | Daily RFP Detection System (v2)
# ----------------------------------------------------------
# Automates COMPLETE-RFP-MONITORING-SYSTEM.md workflow.
# Runs via cron or manually, exports API keys, uses Claude
# in headless mode with MCP access, and logs to Supabase.
# Adds: internal lock + gtimeout protection.
# ==========================================================

# --- ENVIRONMENT SETUP ---
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
export PATH="$HOME/.nvm/versions/node/v20.18.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# --- BASIC PATHS ---
BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$LOG_DIR"

# --- INTERNAL LOCK ---
LOCK="/tmp/rfp-monitor.lock"
if [ -e "$LOCK" ]; then
  echo "⚠️ Another RFP Monitor run is already in progress. Exiting." | tee -a "$LOG_DIR/test-cron.log"
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT
: > "$LOCK"

# --- LOG HEADER ---
{
  echo "=== RFP RUN @ $(date -u) (UTC) ==="
  echo "whoami: $(whoami)"
  echo "PATH: $PATH"
  echo "node: $(command -v node || echo 'NOT FOUND')"
  echo "claude: $(command -v claude || echo 'NOT FOUND')"
} >> "$LOG_DIR/test-cron.log" 2>&1

echo "🔁 Starting RFP Monitor Run @ $STAMP" | tee -a "$LOG_DIR/test-cron.log"

# --- API KEYS ---
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="$(cat $BASE_DIR/zai_key.txt)"

# --- CLAUDE EXECUTABLE ---
if ! command -v claude &>/dev/null; then
  CLAUDE_BIN="/Users/kieranmcfarlane/.nvm/versions/node/v20.18.3/bin/claude"
else
  CLAUDE_BIN="$(command -v claude)"
fi

# --- GTimeout check (install if missing) ---
if ! command -v gtimeout &>/dev/null; then
  echo "⚠️ gtimeout not found — installing via Homebrew..." | tee -a "$LOG_DIR/test-cron.log"
  brew install coreutils >> "$LOG_DIR/test-cron.log" 2>&1
fi

# --- STEP 1: Run Claude Headlessly ---
echo "🤖 Running Claude RFP System Blueprint (15-min timeout)..."
if ! gtimeout 15m "$CLAUDE_BIN" -p "
Follow the detailed process defined in COMPLETE-RFP-MONITORING-SYSTEM.md.

Steps:
1. Use Neo4j MCP to extract all high-priority entities (RFP targets).
2. Use BrightData MCP to gather real-time data about potential tenders.
3. Use Perplexity MCP to reason over the scraped data and detect new RFPs.
4. Write all structured RFP detections to Supabase (table: rfps).
5. Return a concise JSON summary with the total RFPs inserted and key highlights.

Save a detailed JSON result file and a human-readable markdown report.
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "mcp__neo4j__*,mcp__brightdata__*,mcp__perplexity__*,mcp__supabase__*" \
--permission-mode bypassPermissions \
--output-format json > "$LOG_DIR/rfp_results_${STAMP}.json" 2>> "$LOG_DIR/test-cron.log"; then
  echo "❌ Claude RFP run failed or timed out." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 2: Generate Markdown Summary ---
echo "🧠 Generating summary markdown (15-min timeout)..."
if ! gtimeout 15m "$CLAUDE_BIN" -p "
Summarize ./logs/rfp_results_${STAMP}.json in Markdown.
Include:
- Total RFPs detected
- Sports & federations with opportunities
- Confidence averages
- High-priority actions for Yellow Panther.
" \
--mcp-config "$BASE_DIR/mcp-config.json" \
--allowedTools "Read,Write" \
--permission-mode bypassPermissions \
--output-format text > "$LOG_DIR/rfp_summary_${STAMP}.md" 2>> "$LOG_DIR/test-cron.log"; then
  echo "❌ Claude summary generation failed or timed out." | tee -a "$LOG_DIR/test-cron.log"
fi

# --- STEP 3: Clean up logs (older than 7 days) ---
find "$LOG_DIR" -type f -mtime +7 -name "*.json" -delete
find "$LOG_DIR" -type f -mtime +7 -name "*.md" -delete
find "$LOG_DIR" -type f -mtime +30 -name "*.log" -delete

# --- COMPLETION ---
echo "✅ Completed RFP Monitor Run @ $STAMP (Duration: $(($(date +%s) - $(date -r "$LOCK" +%s)))s)" | tee -a "$LOG_DIR/test-cron.log"
