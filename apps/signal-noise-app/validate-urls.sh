#!/bin/bash

# URL Validation Script for ABC Test Results
# Checks all URLs in the deduplicated master JSON file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/logs/test_abc_20251109_142157"
JSON_FILE="${RESULTS_DIR}/rfp_deduplicated_master.json"
VALIDATION_REPORT="${RESULTS_DIR}/url_validation_report_$(date +%Y%m%d_%H%M%S).json"
VALIDATION_SUMMARY="${RESULTS_DIR}/url_validation_summary_$(date +%Y%m%d_%H%M%S).md"

if [ ! -f "$JSON_FILE" ]; then
  echo "❌ JSON file not found: $JSON_FILE"
  exit 1
fi

echo "🔍 Starting URL validation..."
echo "📄 Input file: $JSON_FILE"
echo "📊 Report will be saved to: $VALIDATION_REPORT"
echo ""

# Extract all URLs using jq
URLS=$(jq -r '.rfps[] | "\(.organization)|\(.src_link)|\(.detection_strategy)|\(.summary_json.rfp_type)"' "$JSON_FILE")

TOTAL_URLS=$(echo "$URLS" | wc -l | tr -d ' ')
VALID_COUNT=0
INVALID_COUNT=0
REDIRECT_COUNT=0
TIMEOUT_COUNT=0
PLACEHOLDER_COUNT=0

# Initialize JSON report
echo "{\"validation_date\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"total_urls\": $TOTAL_URLS, \"results\": [" > "$VALIDATION_REPORT"

FIRST=true
while IFS='|' read -r organization url strategy rfp_type; do
  # Skip empty lines
  [ -z "$url" ] && continue
  
  # Check for placeholder URLs
  if [[ "$url" == *"example.com"* ]] || [[ "$url" == *"placeholder"* ]]; then
    PLACEHOLDER_COUNT=$((PLACEHOLDER_COUNT + 1))
    STATUS_CODE="PLACEHOLDER"
    HTTP_CODE="N/A"
    ERROR_MSG="Placeholder URL detected"
  else
    # Use curl to check URL with timeout
    HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}|%{time_total}" \
      --max-time 10 \
      --connect-timeout 5 \
      --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
      "$url" 2>&1) || true
    
    HTTP_CODE=$(echo "$HTTP_RESPONSE" | cut -d'|' -f1)
    REDIRECT_URL=$(echo "$HTTP_RESPONSE" | cut -d'|' -f2)
    TIME_TOTAL=$(echo "$HTTP_RESPONSE" | cut -d'|' -f3)
    
    # Check for curl errors
    if echo "$HTTP_RESPONSE" | grep -q "curl:"; then
      ERROR_MSG=$(echo "$HTTP_RESPONSE" | grep "curl:" | head -1)
      if echo "$ERROR_MSG" | grep -q "timeout\|timed out"; then
        STATUS_CODE="TIMEOUT"
        TIMEOUT_COUNT=$((TIMEOUT_COUNT + 1))
        HTTP_CODE="N/A"
      else
        STATUS_CODE="ERROR"
        INVALID_COUNT=$((INVALID_COUNT + 1))
        HTTP_CODE="N/A"
      fi
    elif [ -z "$HTTP_CODE" ] || [ "$HTTP_CODE" = "000" ]; then
      STATUS_CODE="ERROR"
      INVALID_COUNT=$((INVALID_COUNT + 1))
      HTTP_CODE="N/A"
      ERROR_MSG="No HTTP response"
    elif [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
      STATUS_CODE="VALID"
      VALID_COUNT=$((VALID_COUNT + 1))
      ERROR_MSG=""
    elif [ "$HTTP_CODE" -ge 300 ] && [ "$HTTP_CODE" -lt 400 ]; then
      STATUS_CODE="REDIRECT"
      REDIRECT_COUNT=$((REDIRECT_COUNT + 1))
      ERROR_MSG="Redirects to: ${REDIRECT_URL:-N/A}"
    elif [ "$HTTP_CODE" -eq 404 ]; then
      STATUS_CODE="NOT_FOUND"
      INVALID_COUNT=$((INVALID_COUNT + 1))
      ERROR_MSG="404 Not Found"
    elif [ "$HTTP_CODE" -ge 400 ]; then
      STATUS_CODE="ERROR"
      INVALID_COUNT=$((INVALID_COUNT + 1))
      ERROR_MSG="HTTP $HTTP_CODE"
    else
      STATUS_CODE="UNKNOWN"
      INVALID_COUNT=$((INVALID_COUNT + 1))
      ERROR_MSG="Unexpected response"
    fi
  fi
  
  # Add comma separator (except for first entry)
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> "$VALIDATION_REPORT"
  fi
  
  # Write result to JSON
  jq -n \
    --arg org "$organization" \
    --arg url "$url" \
    --arg strategy "$strategy" \
    --arg rfp_type "$rfp_type" \
    --arg status "$STATUS_CODE" \
    --arg http_code "$HTTP_CODE" \
    --arg error "$ERROR_MSG" \
    --arg time "$TIME_TOTAL" \
    '{
      organization: $org,
      url: $url,
      detection_strategy: $strategy,
      rfp_type: $rfp_type,
      status: $status,
      http_code: $http_code,
      error_message: $error,
      response_time_seconds: $time
    }' >> "$VALIDATION_REPORT"
  
  # Print progress
  case "$STATUS_CODE" in
    "VALID")
      echo "✅ $organization - $url"
      ;;
    "REDIRECT")
      echo "🔄 $organization - $url (redirects)"
      ;;
    "NOT_FOUND")
      echo "❌ $organization - $url (404)"
      ;;
    "PLACEHOLDER")
      echo "⚠️  $organization - $url (PLACEHOLDER)"
      ;;
    "TIMEOUT")
      echo "⏱️  $organization - $url (TIMEOUT)"
      ;;
    *)
      echo "⚠️  $organization - $url ($STATUS_CODE: $ERROR_MSG)"
      ;;
  esac
  
done <<< "$URLS"

# Close JSON array and add summary
echo "" >> "$VALIDATION_REPORT"
echo "], \"summary\": {" >> "$VALIDATION_REPORT"
echo "  \"valid\": $VALID_COUNT," >> "$VALIDATION_REPORT"
echo "  \"invalid\": $INVALID_COUNT," >> "$VALIDATION_REPORT"
echo "  \"redirects\": $REDIRECT_COUNT," >> "$VALIDATION_REPORT"
echo "  \"timeouts\": $TIMEOUT_COUNT," >> "$VALIDATION_REPORT"
echo "  \"placeholders\": $PLACEHOLDER_COUNT," >> "$VALIDATION_REPORT"
echo "  \"total\": $TOTAL_URLS" >> "$VALIDATION_REPORT"
echo "}}" >> "$VALIDATION_REPORT"

# Generate markdown summary
cat > "$VALIDATION_SUMMARY" << EOF
# URL Validation Report

**Validation Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Source File**: \`$(basename "$JSON_FILE")\`  
**Total URLs Checked**: $TOTAL_URLS

---

## Summary

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ **Valid** | $VALID_COUNT | $(awk "BEGIN {printf \"%.1f\", ($VALID_COUNT/$TOTAL_URLS)*100}")% |
| ❌ **Invalid** | $INVALID_COUNT | $(awk "BEGIN {printf \"%.1f\", ($INVALID_COUNT/$TOTAL_URLS)*100}")% |
| 🔄 **Redirects** | $REDIRECT_COUNT | $(awk "BEGIN {printf \"%.1f\", ($REDIRECT_COUNT/$TOTAL_URLS)*100}")% |
| ⏱️ **Timeouts** | $TIMEOUT_COUNT | $(awk "BEGIN {printf \"%.1f\", ($TIMEOUT_COUNT/$TOTAL_URLS)*100}")% |
| ⚠️ **Placeholders** | $PLACEHOLDER_COUNT | $(awk "BEGIN {printf \"%.1f\", ($PLACEHOLDER_COUNT/$TOTAL_URLS)*100}")% |

---

## Invalid URLs (404/Errors)

EOF

# Extract invalid URLs
jq -r '.results[] | select(.status == "NOT_FOUND" or .status == "ERROR" or .status == "PLACEHOLDER" or .status == "TIMEOUT") | "- **\(.organization)** (`\(.detection_strategy)`) - \(.url)\n  - Status: \(.status)\n  - Error: \(.error_message)"' "$VALIDATION_REPORT" >> "$VALIDATION_SUMMARY"

cat >> "$VALIDATION_SUMMARY" << EOF

---

## Redirects

EOF

jq -r '.results[] | select(.status == "REDIRECT") | "- **\(.organization)** (`\(.detection_strategy)`) - \(.url)\n  - Redirects to: \(.error_message)"' "$VALIDATION_REPORT" >> "$VALIDATION_SUMMARY"

cat >> "$VALIDATION_SUMMARY" << EOF

---

## Valid URLs

EOF

jq -r '.results[] | select(.status == "VALID") | "- **\(.organization)** (`\(.detection_strategy)`) - \(.url)"' "$VALIDATION_REPORT" >> "$VALIDATION_SUMMARY"

cat >> "$VALIDATION_SUMMARY" << EOF

---

## Strategy Breakdown

EOF

# Count by strategy
for strategy in perplexity linkedin brightdata; do
  STRATEGY_TOTAL=$(jq -r ".results[] | select(.detection_strategy == \"$strategy\") | .url" "$VALIDATION_REPORT" | wc -l | tr -d ' ')
  STRATEGY_VALID=$(jq -r ".results[] | select(.detection_strategy == \"$strategy\" and .status == \"VALID\") | .url" "$VALIDATION_REPORT" | wc -l | tr -d ' ')
  STRATEGY_INVALID=$(jq -r ".results[] | select(.detection_strategy == \"$strategy\" and (.status == \"NOT_FOUND\" or .status == \"ERROR\" or .status == \"PLACEHOLDER\")) | .url" "$VALIDATION_REPORT" | wc -l | tr -d ' ')
  
  if [ "$STRATEGY_TOTAL" -gt 0 ]; then
    VALID_PCT=$(awk "BEGIN {printf \"%.1f\", ($STRATEGY_VALID/$STRATEGY_TOTAL)*100}")
    echo "### $strategy" >> "$VALIDATION_SUMMARY"
    echo "- Total: $STRATEGY_TOTAL" >> "$VALIDATION_SUMMARY"
    echo "- Valid: $STRATEGY_VALID ($VALID_PCT%)" >> "$VALIDATION_SUMMARY"
    echo "- Invalid: $STRATEGY_INVALID" >> "$VALIDATION_SUMMARY"
    echo "" >> "$VALIDATION_SUMMARY"
  fi
done

echo ""
echo "✅ Validation complete!"
echo "📊 JSON Report: $VALIDATION_REPORT"
echo "📄 Markdown Summary: $VALIDATION_SUMMARY"
echo ""
echo "Summary:"
echo "  ✅ Valid: $VALID_COUNT"
echo "  ❌ Invalid: $INVALID_COUNT"
echo "  🔄 Redirects: $REDIRECT_COUNT"
echo "  ⏱️  Timeouts: $TIMEOUT_COUNT"
echo "  ⚠️  Placeholders: $PLACEHOLDER_COUNT"











