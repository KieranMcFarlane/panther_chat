#!/bin/bash

# 🚀 SMART RFP SYNC - MANUAL TRIGGER
# Easy manual execution of the smart RFP sync system

echo "🏆 SMART RFP SYNC - MANUAL TRIGGER"
echo "================================="
echo ""

# Help text
show_help() {
    echo "Usage: ./scripts/trigger-rfp-sync.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --test           Run with 3 entities (quick test)"
    echo "  --small          Run with 10 entities"
    echo "  --medium         Run with 25 entities"
    echo "  --large          Run with 50 entities"
    echo "  --force-full     Force full sync (ignore incremental cache)"
    echo "  --status         Show current sync status"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/trigger-rfp-sync.sh --test           # Quick test run"
    echo "  ./scripts/trigger-rfp-sync.sh --force-full      # Full refresh"
    echo "  ./scripts/trigger-rfp-sync.sh --small           # Process 10 entities"
    echo ""
    echo "📁 Log files:"
    echo "  logs/smart-rfp-cron.log     # Cron execution logs"
    echo "  logs/smart-sync-$(date +%Y-%m-%d).log  # Today's detailed log"
    echo ""
}

# Parse command line arguments
LIMIT=""
FORCE_FULL=false
SHOW_STATUS=false

case "${1:-}" in
    --test)
        LIMIT=3
        echo "🧪 Running TEST sync (3 entities)"
        ;;
    --small)
        LIMIT=10
        echo "📦 Running SMALL sync (10 entities)"
        ;;
    --medium)
        LIMIT=25
        echo "📊 Running MEDIUM sync (25 entities)"
        ;;
    --large)
        LIMIT=50
        echo "🌟 Running LARGE sync (50 entities)"
        ;;
    --force-full)
        FORCE_FULL=true
        echo "🔄 Forcing FULL sync (all entities)"
        ;;
    --status)
        SHOW_STATUS=true
        echo "📊 Checking sync status..."
        ;;
    --bypass)
        echo "🧪 Running BYPASS mode (no webhook calls)"
        ;;
    --help|"")
        show_help
        exit 0
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo "Use --help for available options"
        exit 1
        ;;
esac

# Show status if requested
if [ "$SHOW_STATUS" = true ]; then
    ./scripts/cron-status.sh
    exit 0
fi

# Build command
CMD="/opt/homebrew/bin/node scripts/smart-rfp-sync.js"

if [ "$FORCE_FULL" = true ]; then
    CMD="$CMD --force-full"
fi

if [ ! -z "$LIMIT" ]; then
    CMD="$CMD --limit=$LIMIT"
fi

if [ "$1" = "--bypass" ]; then
    CMD="$CMD --bypass"
fi

echo "🚀 Executing: $CMD"
echo "⏰ Started: $(date)"
echo ""

# Execute the command
eval $CMD

# Check result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Manual sync completed successfully!"
    echo "📊 Check logs for details:"
    echo "  cat logs/smart-rfp-cron.log"
    echo ""
    echo "🔍 Check current status:"
    echo "  ./scripts/trigger-rfp-sync.sh --status"
else
    echo ""
    echo "❌ Manual sync failed!"
    echo "📝 Check error logs:"
    echo "  tail -20 logs/smart-rfp-cron.log"
fi