#!/bin/bash
set -euo pipefail

# ==========================================================
# 🧹 Clean Start Script
# ----------------------------------------------------------
# Performs a fresh run and sets the cutoff date for /tenders
# ==========================================================

BASE_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
LOG_DIR="$BASE_DIR/logs"
STAMP=$(date +"%Y%m%d_%H%M%S")
CLEAN_RUN_DIR="$LOG_DIR/clean_run_${STAMP}"

echo "🧹 Starting Clean Run"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will:"
echo "  1. Set cutoff date for /tenders page (only show RFPs from this run onwards)"
echo "  2. Reset ABC progress (start fresh)"
echo "  3. Run ALL batches with all 3 strategies (saves to Supabase)"
echo ""
read -p "Press Enter to continue (or Ctrl+C to cancel)..."
echo ""

# Step 1: Set cutoff date FIRST (before running batches)
echo "📅 Step 1: Setting cutoff date..."
CLEAN_RUN_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CLEAN_RUN_DATE_SIMPLE=$(date -u +"%Y-%m-%d")
echo "   Clean run date: $CLEAN_RUN_DATE"
echo "   Simple date: $CLEAN_RUN_DATE_SIMPLE"

# Create/update .env with cutoff date
if [ -f "$BASE_DIR/.env" ]; then
    # Remove old cutoff date if exists
    sed -i '' '/^RFP_CLEAN_RUN_DATE=/d' "$BASE_DIR/.env" 2>/dev/null || true
    sed -i '' '/^NEXT_PUBLIC_RFP_CLEAN_RUN_DATE=/d' "$BASE_DIR/.env" 2>/dev/null || true
    sed -i '' '/^# Clean run cutoff date/d' "$BASE_DIR/.env" 2>/dev/null || true
    # Add new cutoff date
    echo "" >> "$BASE_DIR/.env"
    echo "# Clean run cutoff date - /tenders page will only show RFPs from this date onwards" >> "$BASE_DIR/.env"
    echo "# Format: ISO 8601 UTC timestamp (e.g., 2025-11-10T12:00:00Z)" >> "$BASE_DIR/.env"
    echo "RFP_CLEAN_RUN_DATE=$CLEAN_RUN_DATE" >> "$BASE_DIR/.env"
    echo "NEXT_PUBLIC_RFP_CLEAN_RUN_DATE=$CLEAN_RUN_DATE" >> "$BASE_DIR/.env"
    echo "RFP_CLEAN_RUN_DATE_SIMPLE=$CLEAN_RUN_DATE_SIMPLE" >> "$BASE_DIR/.env"
    echo "✅ Cutoff date saved to .env"
else
    echo "⚠️  .env file not found, creating it..."
    echo "# Clean run cutoff date - /tenders page will only show RFPs from this date onwards" > "$BASE_DIR/.env"
    echo "RFP_CLEAN_RUN_DATE=$CLEAN_RUN_DATE" >> "$BASE_DIR/.env"
    echo "NEXT_PUBLIC_RFP_CLEAN_RUN_DATE=$CLEAN_RUN_DATE" >> "$BASE_DIR/.env"
    echo "RFP_CLEAN_RUN_DATE_SIMPLE=$CLEAN_RUN_DATE_SIMPLE" >> "$BASE_DIR/.env"
    echo "✅ Created .env with cutoff date"
fi

# Also create a marker file
echo "$CLEAN_RUN_DATE" > "$BASE_DIR/.clean-run-date"
echo "$CLEAN_RUN_DATE_SIMPLE" > "$BASE_DIR/.clean-run-date-simple"

# Step 2: Reset progress
echo ""
echo "🔄 Step 2: Resetting progress files..."
rm -f "$BASE_DIR/rfp-progress-abc.json"
echo "✅ Progress reset"

# Step 3: Run all batches with ABC orchestrator
echo ""
echo "🚀 Step 3: Running ALL batches with ABC orchestrator..."
echo "   This will process all entities with all 3 strategies"
echo "   Results will be saved to Supabase"
echo ""
echo "   Note: This may take a while depending on entity count"
echo "   You can monitor progress in: $LOG_DIR/test-cron.log"
echo ""

# Run the full ABC batch orchestrator with --reset flag
bash "$BASE_DIR/run-rfp-batches-abc.sh" --reset || {
    echo "⚠️  Batch processing failed or was interrupted"
    echo "   Check logs in: $LOG_DIR/test-cron.log"
    echo "   You can resume by running: ./run-rfp-batches-abc.sh"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Clean Run Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "   - Cutoff date: $CLEAN_RUN_DATE_SIMPLE"
echo "   - All batches processed with 3 strategies (Perplexity, LinkedIn, BrightData)"
echo "   - Results saved to Supabase"
echo ""
echo "📋 Next steps:"
echo "   1. Restart Next.js server to load new RFP_CLEAN_RUN_DATE env var"
echo "   2. Visit /tenders page - it will only show RFPs from $CLEAN_RUN_DATE_SIMPLE onwards"
echo "   3. All previous RFPs will be filtered out"
echo "   4. Future runs will add to this clean dataset"
echo ""
echo "📁 Logs:"
echo "   - Main log: $LOG_DIR/test-cron.log"
echo "   - Batch logs: $LOG_DIR/run_abc_*/"
echo ""

