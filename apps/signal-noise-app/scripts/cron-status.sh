#!/bin/bash

# 📊 RFP SYNC STATUS CHECKER

echo "🏆 SMART RFP SYNC STATUS"
echo "======================="
echo "Checked: $(date)"
echo ""

# Check cron job status
echo "📅 CRON JOB STATUS:"
if crontab -l | grep -q "smart-rfp-sync.js"; then
    echo "✅ Cron job is configured"
    cron_line=$(crontab -l | grep "smart-rfp-sync.js")
    echo "Schedule: $(echo $cron_line | cut -d' ' -f1-5)"
else
    echo "❌ No cron job found"
fi

echo ""

# Check sync state
echo "📊 SYNC STATE:"
if [ -f ".cache/sync-state.json" ]; then
    echo "✅ Sync state exists"
    last_sync=$(cat .cache/sync-state.json | jq -r '.lastSync // "Never"' 2>/dev/null)
    total_processed=$(cat .cache/sync-state.json | jq -r '.stats.totalProcessed // 0' 2>/dev/null)
    echo "Last sync: ${last_sync}"
    echo "Total processed: ${total_processed} entities"
    
    if [ "$last_sync" != "Never" ]; then
        sync_date=$(date -d "$last_sync" +%s 2>/dev/null || echo "0")
        now=$(date +%s)
        diff=$((now - sync_date))
        hours_ago=$((diff / 3600))
        echo "Hours since last sync: ${hours_ago}"
    fi
else
    echo "❌ No sync state found (first run pending)"
fi

echo ""

# Check logs
echo "📝 LOG STATUS:"
if [ -f "logs/smart-rfp-cron.log" ]; then
    log_size=$(wc -l < logs/smart-rfp-cron.log)
    last_log=$(tail -1 logs/smart-rfp-cron.log 2>/dev/null | cut -d']' -f2-)
    echo "✅ Log file exists (${log_size} lines)"
    echo "Last log entry: ${last_log}"
else
    echo "❌ No log file found"
fi

# Check today's specific log
today=$(date +%Y-%m-%d)
today_log="logs/smart-sync-${today}.log"
if [ -f "$today_log" ]; then
    echo "✅ Today's detailed log exists"
    last_result=$(grep "🎉 SMART SYNC COMPLETED" "$today_log" | tail -1 | grep -o "[0-9]* successful" || echo "0")
    echo "Today's successful runs: ${last_result:-0}"
else
    echo "ℹ️  No detailed log for today yet"
fi

echo ""

# System health check
echo "🔧 SYSTEM HEALTH:"
if command -v node >/dev/null 2>&1; then
    node_version=$(node --version)
    echo "✅ Node.js: ${node_version}"
else
    echo "❌ Node.js not found"
fi

if [ -f "scripts/smart-rfp-sync.js" ]; then
    echo "✅ Sync script exists"
else
    echo "❌ Sync script missing"
fi

echo ""

# Next run info
echo "⏰ NEXT RUNS:"
echo "Scheduled: Daily at 3:00 AM"
echo "Next run: $(date -d "tomorrow 03:00" 2>/dev/null || echo "Tomorrow 3:00 AM")"
echo ""
echo "💡 Manual commands:"
echo "  node scripts/smart-rfp-sync.js --limit=5  # Test run"
echo "  tail -f logs/smart-rfp-cron.log           # Watch logs"
echo "  crontab -e                               # Edit cron jobs"