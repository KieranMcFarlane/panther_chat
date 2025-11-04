#!/bin/bash

# 📡 LIVE RFP SYNC LOG MONITOR
# Real-time monitoring of the smart RFP cron job

echo "🏆 RFP CRON JOB MONITOR"
echo "========================="
echo "Schedule: Daily at 3:00 AM"
echo "Log file: logs/smart-rfp-cron.log"
echo ""
echo "Commands:"
echo "  ./scripts/watch-cron-logs.sh     # Watch logs live"
echo "  ./scripts/cron-status.sh         # Check current status"
echo "  crontab -l                       # List all cron jobs"
echo "  tail -f logs/smart-rfp-cron.log  # Direct log monitoring"
echo ""

# Check if cron job exists
if crontab -l | grep -q "smart-rfp-sync.js"; then
    echo "✅ Cron job is ACTIVE"
    echo "⏰ Next run: Tomorrow at 3:00 AM"
    echo ""
    echo "📊 Current cron entries:"
    crontab -l | grep -E "(smart-rfp|3.*node)"
else
    echo "❌ Cron job NOT found"
    echo "Run: crontab -e and add:"
    echo "0 3 * * * /opt/homebrew/bin/node scripts/smart-rfp-sync.js >> logs/smart-rfp-cron.log 2>&1"
fi

echo ""
echo "📁 Recent logs:"
if [ -f "logs/smart-rfp-cron.log" ]; then
    tail -10 logs/smart-rfp-cron.log 2>/dev/null || echo "No logs yet"
else
    echo "No log file exists yet"
fi

echo ""
echo "🔍 Monitor live logs now? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "📡 Starting live log monitoring... (Ctrl+C to stop)"
    tail -f logs/smart-rfp-cron.log
fi