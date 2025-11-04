#!/bin/bash

# 📡 LIVE CRON LOG MONITOR
echo "🏆 RFP CRON JOB - LIVE LOG MONITOR"
echo "================================"
echo "Cron Schedule: Daily at 3:00 AM"
echo "Watching: logs/smart-rfp-cron.log"
echo "Press Ctrl+C to stop"
echo ""

# Create log file if it doesn't exist
touch logs/smart-rfp-cron.log

# Show last 5 lines and then follow
echo "📝 Recent logs:"
tail -5 logs/smart-rfp-cron.log
echo ""
echo "📡 Monitoring live... (waiting for cron job to run at 3:00 AM)"

# Follow the log file
tail -f logs/smart-rfp-cron.log