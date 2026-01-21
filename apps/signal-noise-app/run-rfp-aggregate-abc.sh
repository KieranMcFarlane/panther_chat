#!/bin/bash
set -euo pipefail

# ==========================================================
# 🟡 Yellow Panther | Multi-Strategy ABC Aggregator (v1.0)
# ----------------------------------------------------------
# Combines results from 3 strategies (Perplexity, LinkedIn, BrightData)
# Generates comparison metrics, deduplicates overlapping findings,
# Creates strategy performance report with recommendations
# ==========================================================

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
# Accept RUN_DIR as first parameter, or default to LOG_DIR for backward compatibility
RUN_DIR="${1:-$LOG_DIR}"
STAMP=$(date +"%Y%m%d_%H%M%S")
MASTER_JSON="$RUN_DIR/rfp_master_report_${STAMP}.json"
MASTER_MD="$RUN_DIR/rfp_master_summary_${STAMP}.md"

mkdir -p "$LOG_DIR"
mkdir -p "$RUN_DIR"

echo "🧩 Aggregating batch results into master report..." | tee -a "$LOG_DIR/test-cron.log"
echo "📁 Using run directory: $RUN_DIR" | tee -a "$LOG_DIR/test-cron.log"

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

# --- Determine MCP config path (prefer runtime, fallback to regular) ---
MCP_CONFIG="${BASE_DIR}/mcp-config-runtime.json"
if [ ! -f "$MCP_CONFIG" ]; then
  MCP_CONFIG="${BASE_DIR}/mcp-config.json"
fi

# --- Collect results from all 3 strategies ---
echo "📊 Collecting strategy-specific results..." | tee -a "$LOG_DIR/test-cron.log"

PERPLEXITY_FILES=($(ls -t "$LOG_DIR"/rfp_results_batch*_perplexity_*_clean.json 2>/dev/null || true))
LINKEDIN_FILES=($(ls -t "$LOG_DIR"/rfp_results_batch*_linkedin_*_clean.json 2>/dev/null || true))
BRIGHTDATA_FILES=($(ls -t "$LOG_DIR"/rfp_results_batch*_brightdata_*_clean.json 2>/dev/null || true))

echo "   🧠 Perplexity: ${#PERPLEXITY_FILES[@]} batches" | tee -a "$LOG_DIR/test-cron.log"
echo "   💼 LinkedIn: ${#LINKEDIN_FILES[@]} batches" | tee -a "$LOG_DIR/test-cron.log"
echo "   🌐 BrightData: ${#BRIGHTDATA_FILES[@]} batches" | tee -a "$LOG_DIR/test-cron.log"

if [ ${#PERPLEXITY_FILES[@]} -eq 0 ] && [ ${#LINKEDIN_FILES[@]} -eq 0 ] && [ ${#BRIGHTDATA_FILES[@]} -eq 0 ]; then
  echo "❌ No strategy result files found" | tee -a "$LOG_DIR/test-cron.log"
  exit 1
fi

# Combine all files for processing
ALL_FILES=("${PERPLEXITY_FILES[@]}" "${LINKEDIN_FILES[@]}" "${BRIGHTDATA_FILES[@]}")
CLEAN_FILES=()
INVALID_COUNT=0
for file in "${ALL_FILES[@]}"; do
  if jq empty "$file" 2>/dev/null; then
    CLEAN_FILES+=("$file")
  else
    ((INVALID_COUNT++)) || true
    echo "⚠️  Skipping invalid JSON: $(basename "$file")" | tee -a "$LOG_DIR/test-cron.log"
  fi
done

if [ ${#CLEAN_FILES[@]} -eq 0 ]; then
  echo "❌ No valid clean result files found after validation" | tee -a "$LOG_DIR/test-cron.log"
  exit 1
fi

if [ $INVALID_COUNT -gt 0 ]; then
  echo "⚠️  Skipped $INVALID_COUNT invalid file(s)" | tee -a "$LOG_DIR/test-cron.log"
fi

echo "📁 Found ${#CLEAN_FILES[@]} valid clean result file(s) to aggregate" | tee -a "$LOG_DIR/test-cron.log"

# Aggregate only valid clean files
jq -s '
  {
    total_batches: length,
    total_rfps_detected: (map(.total_rfps_detected // 0) | add),
    entities_checked: (map(.entities_checked // 0) | add),
    all_highlights: (map(.highlights // []) | add)
  }
' "${CLEAN_FILES[@]}" > "$MASTER_JSON"

# --- PHASE 1: URL AND DIGITAL FILTERING ---
echo "🔍 Filtering placeholder URLs and non-digital RFPs..." | tee -a "$LOG_DIR/test-cron.log"

FILTERED_MASTER="${MASTER_JSON%.json}_filtered.json"

# Filter placeholder URLs and non-digital RFPs
FILTERED_JSON=$(jq '
  . as $root |
  .all_highlights = (
    .all_highlights // [] |
    # Step 1: Filter placeholder URLs
    map(select(.src_link != null and .src_link != "")) |
    map(select(
      (.src_link | test("example\\.com|placeholder|test\\.com|dummy|fake"; "i")) | not
    )) |
    # Step 2: Filter non-digital RFPs by rfp_type
    map(select(
      (.summary_json.rfp_type // .rfp_type // "") | 
      test("Stadium Infrastructure|Hospitality Services|Construction|Apparel|Equipment|F&B|Event Production|Stadium Technology"; "i") | 
      not
    )) |
    # Step 3: Filter non-digital RFPs by title keywords
    map(select(
      ((.summary_json.title // .title // "") | ascii_downcase | 
       test("stadium|construction|hospitality|hotel|apparel|equipment|f&b|catering|physical|infrastructure"; "i")) | 
      not
    ))
  ) |
  .total_rfps_detected = (.all_highlights | length)
' "$MASTER_JSON" 2> "$LOG_DIR/aggregation_filter_error_${STAMP}.log")

FILTER_EXIT_CODE=$?
if [ $FILTER_EXIT_CODE -eq 0 ] && [ -n "$FILTERED_JSON" ]; then
  ORIGINAL_COUNT=$(jq '.all_highlights | length' "$MASTER_JSON" 2>/dev/null || echo 0)
  FILTERED_COUNT=$(echo "$FILTERED_JSON" | jq '.all_highlights | length' 2>/dev/null || echo 0)
  REMOVED=$((ORIGINAL_COUNT - FILTERED_COUNT))
  
  if [ "$REMOVED" -gt 0 ]; then
    echo "   ⚠️  Removed $REMOVED invalid/non-digital RFP(s) (placeholder URLs or non-digital projects)" | tee -a "$LOG_DIR/test-cron.log"
    echo "$FILTERED_JSON" > "$FILTERED_MASTER"
    mv "$FILTERED_MASTER" "$MASTER_JSON"
  else
    echo "   ✅ All RFPs passed filtering ($ORIGINAL_COUNT RFPs checked)" | tee -a "$LOG_DIR/test-cron.log"
  fi
else
  echo "   ⚠️  Filtering failed (exit code: $FILTER_EXIT_CODE), using original JSON" | tee -a "$LOG_DIR/test-cron.log"
  if [ -s "$LOG_DIR/aggregation_filter_error_${STAMP}.log" ]; then
    echo "   jq error: $(cat "$LOG_DIR/aggregation_filter_error_${STAMP}.log")" | tee -a "$LOG_DIR/test-cron.log"
  fi
fi

TOTAL_RFPS=$(jq -r '.total_rfps_detected' "$MASTER_JSON")
ENTITIES_CHECKED=$(jq -r '.entities_checked' "$MASTER_JSON")
TOTAL_BATCHES=$(jq -r '.total_batches' "$MASTER_JSON")

echo "📊 Aggregated $TOTAL_RFPS RFPs across $ENTITIES_CHECKED entities from $TOTAL_BATCHES batches." | tee -a "$LOG_DIR/test-cron.log"

# --- Generate Markdown summary via Claude ---
echo "🧠 Generating master summary..." | tee -a "$LOG_DIR/test-cron.log"
if ! gtimeout 10m "$CLAUDE_BIN" -p "
You are Yellow Panther's data analyst.
Summarize $MASTER_JSON in Markdown for the executive team.
Include:

- Total RFPs detected and total entities checked
- Top 10 organizations with new opportunities
- Key sports sectors and regions (count and share)
- Average confidence if available
- Weekly trends and recommended focus areas
- Mention that data comes from ${TOTAL_BATCHES} batch scans
" \
--mcp-config "$MCP_CONFIG" \
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

# --- Archive old logs (archive files from this run directory) ---
echo "📦 Archiving logs..." | tee -a "$LOG_DIR/test-cron.log"
tar -czf "$RUN_DIR/archive_${STAMP}.tar.gz" "${CLEAN_FILES[@]}" "$RUN_DIR"/rfp_summary_batch*.md "$MASTER_JSON" "$MASTER_MD" >/dev/null 2>&1 || true
# Cleanup old files in run directory (but keep the archive)
find "$RUN_DIR" -type f -mtime +7 -name "rfp_results_batch*_clean.json" -delete
find "$RUN_DIR" -type f -mtime +7 -name "rfp_summary_batch*.md" -delete
find "$RUN_DIR" -type f -mtime +7 -name "*.log" ! -name "batch_summary.log" -delete

echo "✅ Aggregation complete. Master report ready: $MASTER_JSON" | tee -a "$LOG_DIR/test-cron.log"
echo "📁 All run files saved to: $RUN_DIR" | tee -a "$LOG_DIR/test-cron.log"

# ==========================================================
# ABC STRATEGY COMPARISON LOGIC
# ==========================================================

# Create strategy-specific aggregations
PERP_MASTER="$RUN_DIR/rfp_perplexity_aggregated.json"
LINK_MASTER="$RUN_DIR/rfp_linkedin_aggregated.json"
BRIGHT_MASTER="$RUN_DIR/rfp_brightdata_aggregated.json"

echo "🧩 Aggregating by strategy..." | tee -a "$LOG_DIR/test-cron.log"

# Aggregate Perplexity results
if [ ${#PERPLEXITY_FILES[@]} -gt 0 ]; then
  jq -s '
    (map(.highlights // []) | add |
     map(select(.src_link != null and .src_link != "")) |
     map(select((.src_link | test("example\\.com|placeholder|test\\.com|dummy|fake"; "i")) | not)) |
     map(select((.summary_json.rfp_type // .rfp_type // "") | test("Stadium Infrastructure|Hospitality Services|Construction|Apparel|Equipment|F&B|Event Production|Stadium Technology"; "i") | not)) |
     map(select(((.summary_json.title // .title // "") | ascii_downcase | test("stadium|construction|hospitality|hotel|apparel|equipment|f&b|catering|physical|infrastructure"; "i")) | not))) as $filtered_highlights |
    {
      strategy: "perplexity",
      total_batches: length,
      total_rfps: ($filtered_highlights | length),
      total_entities_checked: (map(.entities_checked // 0) | add),
      all_highlights: $filtered_highlights,
      avg_confidence: (map(.scoring_summary.avg_confidence // 0) | add / length),
      avg_fit_score: (map(.scoring_summary.avg_fit_score // 0) | add / length)
    }
  ' "${PERPLEXITY_FILES[@]}" > "$PERP_MASTER"
  echo "   ✅ Perplexity: $(jq '.total_rfps' "$PERP_MASTER") RFPs from $(jq '.total_entities_checked' "$PERP_MASTER") entities" | tee -a "$LOG_DIR/test-cron.log"
fi

# Aggregate LinkedIn results
if [ ${#LINKEDIN_FILES[@]} -gt 0 ]; then
  jq -s '
    (map(.highlights // []) | add |
     map(select(.src_link != null and .src_link != "")) |
     map(select((.src_link | test("example\\.com|placeholder|test\\.com|dummy|fake"; "i")) | not)) |
     map(select((.summary_json.rfp_type // .rfp_type // "") | test("Stadium Infrastructure|Hospitality Services|Construction|Apparel|Equipment|F&B|Event Production|Stadium Technology"; "i") | not)) |
     map(select(((.summary_json.title // .title // "") | ascii_downcase | test("stadium|construction|hospitality|hotel|apparel|equipment|f&b|catering|physical|infrastructure"; "i")) | not))) as $filtered_highlights |
    {
      strategy: "linkedin",
      total_batches: length,
      total_rfps: ($filtered_highlights | length),
      total_entities_checked: (map(.entities_checked // 0) | add),
      all_highlights: $filtered_highlights,
      avg_confidence: (map(.scoring_summary.avg_confidence // 0) | add / length),
      avg_fit_score: (map(.scoring_summary.avg_fit_score // 0) | add / length)
    }
  ' "${LINKEDIN_FILES[@]}" > "$LINK_MASTER"
  echo "   ✅ LinkedIn: $(jq '.total_rfps' "$LINK_MASTER") RFPs from $(jq '.total_entities_checked' "$LINK_MASTER") entities" | tee -a "$LOG_DIR/test-cron.log"
fi

# Aggregate BrightData results
if [ ${#BRIGHTDATA_FILES[@]} -gt 0 ]; then
  jq -s '
    (map(.highlights // []) | add |
     map(select(.src_link != null and .src_link != "")) |
     map(select((.src_link | test("example\\.com|placeholder|test\\.com|dummy|fake"; "i")) | not)) |
     map(select((.summary_json.rfp_type // .rfp_type // "") | test("Stadium Infrastructure|Hospitality Services|Construction|Apparel|Equipment|F&B|Event Production|Stadium Technology"; "i") | not)) |
     map(select(((.summary_json.title // .title // "") | ascii_downcase | test("stadium|construction|hospitality|hotel|apparel|equipment|f&b|catering|physical|infrastructure"; "i")) | not))) as $filtered_highlights |
    {
      strategy: "brightdata",
      total_batches: length,
      total_rfps: ($filtered_highlights | length),
      total_entities_checked: (map(.entities_checked // 0) | add),
      all_highlights: $filtered_highlights,
      avg_confidence: (map(.scoring_summary.avg_confidence // 0) | add / length),
      avg_fit_score: (map(.scoring_summary.avg_fit_score // 0) | add / length)
    }
  ' "${BRIGHTDATA_FILES[@]}" > "$BRIGHT_MASTER"
  echo "   ✅ BrightData: $(jq '.total_rfps' "$BRIGHT_MASTER") RFPs from $(jq '.total_entities_checked' "$BRIGHT_MASTER") entities" | tee -a "$LOG_DIR/test-cron.log"
fi

# ==========================================================
# DEDUPLICATION & OVERLAP ANALYSIS
# ==========================================================

echo "🔍 Analyzing overlap and deduplicating..." | tee -a "$LOG_DIR/test-cron.log"

# Combine all RFPs and deduplicate by organization + title similarity
DEDUP_MASTER="$RUN_DIR/rfp_deduplicated_master.json"

# Fix: Check if files exist before running jq, and handle null titles
if [ -f "$PERP_MASTER" ] && [ -f "$LINK_MASTER" ] && [ -f "$BRIGHT_MASTER" ]; then
  jq -s '
    # Combine all highlights from all strategies
    map(.all_highlights // []) | add |
    
    # Filter out null/empty titles before deduplication
    map(select((.summary_json.title // .title // "") != "")) |
    
    # Group by organization name (case-insensitive)
    group_by(.organization | ascii_downcase) |
    
    # For each group, deduplicate by title similarity
    map(
      group_by(
        ((.summary_json.title // .title // "untitled") | tostring | ascii_downcase | gsub("[^a-z0-9]"; ""))
      ) |
      map(
        # Sort by fit_score and take highest
        sort_by(-(.summary_json.fit_score // .fit_score // 0)) |
        .[0] |
        # Add found_by_strategies array
        . + {
          found_by_strategies: [
            (if .detection_strategy == "perplexity" then "perplexity" else empty end),
            (if .detection_strategy == "linkedin" then "linkedin" else empty end),
            (if .detection_strategy == "brightdata" then "brightdata" else empty end)
          ]
        }
      )
    ) |
    add |
    
    # Final deduplication summary
    {
      total_unique_rfps: length,
      rfps: .,
      overlap_analysis: {
        perplexity_only: [.[] | select(.detection_strategy == "perplexity")] | length,
        linkedin_only: [.[] | select(.detection_strategy == "linkedin")] | length,
        brightdata_only: [.[] | select(.detection_strategy == "brightdata")] | length
      }
    }
  ' "$PERP_MASTER" "$LINK_MASTER" "$BRIGHT_MASTER" > "$DEDUP_MASTER" 2> "$LOG_DIR/deduplication_error_${STAMP}.log"
  
  if [ $? -ne 0 ]; then
    echo "⚠️  Deduplication jq command failed, check $LOG_DIR/deduplication_error_${STAMP}.log" | tee -a "$LOG_DIR/test-cron.log"
    if [ -s "$LOG_DIR/deduplication_error_${STAMP}.log" ]; then
      echo "   Error: $(cat "$LOG_DIR/deduplication_error_${STAMP}.log")" | tee -a "$LOG_DIR/test-cron.log"
    fi
    echo '{"total_unique_rfps": 0, "rfps": [], "overlap_analysis": {}}' > "$DEDUP_MASTER"
  fi
else
  echo "⚠️  Missing aggregated files for deduplication:" | tee -a "$LOG_DIR/test-cron.log"
  [ ! -f "$PERP_MASTER" ] && echo "   Missing: $PERP_MASTER" | tee -a "$LOG_DIR/test-cron.log"
  [ ! -f "$LINK_MASTER" ] && echo "   Missing: $LINK_MASTER" | tee -a "$LOG_DIR/test-cron.log"
  [ ! -f "$BRIGHT_MASTER" ] && echo "   Missing: $BRIGHT_MASTER" | tee -a "$LOG_DIR/test-cron.log"
  echo '{"total_unique_rfps": 0, "rfps": [], "overlap_analysis": {}}' > "$DEDUP_MASTER"
fi

UNIQUE_RFPS=$(jq '.total_unique_rfps' "$DEDUP_MASTER" 2>/dev/null || echo 0)
echo "   📊 Deduplicated to $UNIQUE_RFPS unique RFPs" | tee -a "$LOG_DIR/test-cron.log"

# ==========================================================
# STRATEGY COMPARISON REPORT
# ==========================================================

COMPARISON_MD="$RUN_DIR/rfp_strategy_comparison_${STAMP}.md"

cat > "$COMPARISON_MD" << 'COMPARISON_EOF'
# 🎯 Multi-Strategy RFP Detection Comparison

## Executive Summary

This report compares the performance of three different RFP detection strategies run in parallel on the same entity set.

COMPARISON_EOF

# Add strategy metrics table
cat >> "$COMPARISON_MD" << COMPARISON_EOF2

## Strategy Performance Metrics

| Strategy | Total RFPs | Entities | Avg Confidence | Avg Fit Score | Unique Finds |
|----------|-----------|----------|----------------|---------------|--------------|
COMPARISON_EOF2

# Perplexity row
if [ -f "$PERP_MASTER" ]; then
  PERP_RFPS=$(jq '.total_rfps' "$PERP_MASTER")
  PERP_ENTITIES=$(jq '.total_entities_checked' "$PERP_MASTER")
  PERP_CONF=$(jq '.avg_confidence' "$PERP_MASTER")
  PERP_FIT=$(jq '.avg_fit_score' "$PERP_MASTER")
  PERP_UNIQUE=$(jq '.overlap_analysis.perplexity_only' "$DEDUP_MASTER")
  echo "| 🧠 Perplexity | $PERP_RFPS | $PERP_ENTITIES | $PERP_CONF | $PERP_FIT | $PERP_UNIQUE |" >> "$COMPARISON_MD"
fi

# LinkedIn row
if [ -f "$LINK_MASTER" ]; then
  LINK_RFPS=$(jq '.total_rfps' "$LINK_MASTER")
  LINK_ENTITIES=$(jq '.total_entities_checked' "$LINK_MASTER")
  LINK_CONF=$(jq '.avg_confidence' "$LINK_MASTER")
  LINK_FIT=$(jq '.avg_fit_score' "$LINK_MASTER")
  LINK_UNIQUE=$(jq '.overlap_analysis.linkedin_only' "$DEDUP_MASTER")
  echo "| 💼 LinkedIn | $LINK_RFPS | $LINK_ENTITIES | $LINK_CONF | $LINK_FIT | $LINK_UNIQUE |" >> "$COMPARISON_MD"
fi

# BrightData row
if [ -f "$BRIGHT_MASTER" ]; then
  BRIGHT_RFPS=$(jq '.total_rfps' "$BRIGHT_MASTER")
  BRIGHT_ENTITIES=$(jq '.total_entities_checked' "$BRIGHT_MASTER")
  BRIGHT_CONF=$(jq '.avg_confidence' "$BRIGHT_MASTER")
  BRIGHT_FIT=$(jq '.avg_fit_score' "$BRIGHT_MASTER")
  BRIGHT_UNIQUE=$(jq '.overlap_analysis.brightdata_only' "$DEDUP_MASTER")
  echo "| 🌐 BrightData | $BRIGHT_RFPS | $BRIGHT_ENTITIES | $BRIGHT_CONF | $BRIGHT_FIT | $BRIGHT_UNIQUE |" >> "$COMPARISON_MD"
fi

# Combined row
echo "| **📊 Combined** | **$UNIQUE_RFPS** | **-** | **-** | **-** | **-** |" >> "$COMPARISON_MD"

# Add recommendations
cat >> "$COMPARISON_MD" << 'COMPARISON_EOF3'

## Recommendations

Based on the strategy comparison:

1. **Primary Strategy**: Use the strategy with highest unique finds and best quality metrics
2. **Hybrid Approach**: Combine top 2 strategies for comprehensive coverage
3. **Resource Optimization**: Consider cost/performance ratio for production deployment

## Top 10 Unique RFPs by Strategy

### 🧠 Perplexity-Only Finds
COMPARISON_EOF3

if [ -f "$DEDUP_MASTER" ]; then
  jq -r '.rfps[] | select(.detection_strategy == "perplexity") | "- **\(.organization)**: \(.summary_json.title // .title) (Fit: \(.summary_json.fit_score // .fit_score))"' "$DEDUP_MASTER" | head -10 >> "$COMPARISON_MD"
fi

cat >> "$COMPARISON_MD" << 'COMPARISON_EOF4'

### 💼 LinkedIn-Only Finds
COMPARISON_EOF4

if [ -f "$DEDUP_MASTER" ]; then
  jq -r '.rfps[] | select(.detection_strategy == "linkedin") | "- **\(.organization)**: \(.summary_json.title // .title) (Fit: \(.summary_json.fit_score // .fit_score))"' "$DEDUP_MASTER" | head -10 >> "$COMPARISON_MD"
fi

cat >> "$COMPARISON_MD" << 'COMPARISON_EOF5'

### 🌐 BrightData-Only Finds
COMPARISON_EOF5

if [ -f "$DEDUP_MASTER" ]; then
  jq -r '.rfps[] | select(.detection_strategy == "brightdata") | "- **\(.organization)**: \(.summary_json.title // .title) (Fit: \(.summary_json.fit_score // .fit_score))"' "$DEDUP_MASTER" | head -10 >> "$COMPARISON_MD"
fi

echo "" >> "$COMPARISON_MD"
echo "---" >> "$COMPARISON_MD"
echo "*Generated: $(date)*" >> "$COMPARISON_MD"

echo "✅ Strategy comparison report: $COMPARISON_MD" | tee -a "$LOG_DIR/test-cron.log"

# Copy deduplicated master to standard location for backward compatibility
cp "$DEDUP_MASTER" "$MASTER_JSON"

echo "🎉 ABC aggregation complete!" | tee -a "$LOG_DIR/test-cron.log"
echo "   📊 View comparison: $COMPARISON_MD" | tee -a "$LOG_DIR/test-cron.log"
echo "   📁 Deduplicated results: $MASTER_JSON" | tee -a "$LOG_DIR/test-cron.log"

exit 0
