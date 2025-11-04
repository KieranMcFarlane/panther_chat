#!/bin/bash

# Cron Automation Setup for RFP Intelligence Monitoring
# Sets up automated Claude Code execution for continuous monitoring

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOMATION_SCRIPT="${SCRIPT_DIR}/claude-code-rfp-automation.sh"
CRON_FILE="${SCRIPT_DIR}/rfp-crontab.txt"

echo "⏰ RFP Intelligence Cron Automation Setup"
echo "========================================"
echo ""

# Verify automation script exists
if [[ ! -f "$AUTOMATION_SCRIPT" ]]; then
    echo "❌ Automation script not found: $AUTOMATION_SCRIPT"
    exit 1
fi

echo "✅ Found automation script: $AUTOMATION_SCRIPT"

# Create cron configuration
cat > "$CRON_FILE" << EOF
# RFP Intelligence Automation Cron Jobs
# Generated: $(date)

# Run RFP analysis every weekday at 9:00 AM (London time)
0 9 * * 1-5 cd "$SCRIPT_DIR" && "$AUTOMATION_SCRIPT" >> "${SCRIPT_DIR}/RUN_LOGS/cron_daily_\$(date +\%Y\%m\%d).log" 2>&1

# Run quick scan every 4 hours during business hours
0 8,12,16 * * 1-5 cd "$SCRIPT_DIR" && "$AUTOMATION_SCRIPT" >> "${SCRIPT_DIR}/RUN_LOGS/cron_4hourly_\$(date +\%Y\%m\%d_\%H).log" 2>&1

# Weekly comprehensive analysis every Sunday at 10:00 PM
0 22 * * 0 cd "$SCRIPT_DIR" && "$AUTOMATION_SCRIPT" >> "${SCRIPT_DIR}/RUN_LOGS/cron_weekly_\$(date +\%Y\%m\%d).log" 2>&1

# Monthly backtest on the 1st of each month at 6:00 AM
0 6 1 * * cd "$SCRIPT_DIR" && "$AUTOMATION_SCRIPT" >> "${SCRIPT_DIR}/RUN_LOGS/cron_monthly_\$(date +\%Y\%m).log" 2>&1

EOF

echo "📅 Cron configuration created: $CRON_FILE"
echo ""
echo "Cron Schedule:"
echo "• Daily: Weekdays 9:00 AM (London time)"
echo "• 4-Hourly: 8 AM, 12 PM, 4 PM (Mon-Fri)"
echo "• Weekly: Sundays 10:00 PM (comprehensive)"
echo "• Monthly: 1st of month 6:00 AM (backtest)"
echo ""

# Check if crontab is available
if ! command -v crontab &> /dev/null; then
    echo "⚠️  crontab not available on this system"
    echo "Manual setup may be required"
    exit 1
fi

echo "🔧 Installing cron jobs..."

# Backup existing crontab
crontab -l > "${SCRIPT_DIR}/crontab_backup_$(date +%Y%m%d_%H%M%S).txt" 2>/dev/null || echo "# No existing crontab to backup"

# Install new cron jobs
{ crontab -l 2>/dev/null || echo "# Existing crontab"; cat "$CRON_FILE"; } | crontab -

echo "✅ Cron jobs installed successfully"
echo ""
echo "📊 Monitoring Setup:"
echo "• Logs directory: ${SCRIPT_DIR}/RUN_LOGS"
echo "• Automation script: $AUTOMATION_SCRIPT"
echo "• Cron config: $CRON_FILE"
echo ""
echo "🔍 Management Commands:"
echo "• View cron jobs: crontab -l"
echo "• Edit cron jobs: crontab -e"
echo "• View logs: ls -la ${SCRIPT_DIR}/RUN_LOGS/"
echo "• Test run: $AUTOMATION_SCRIPT"
echo ""
echo "⚠️  Important Notes:"
echo "• Ensure Claude Code CLI is installed and accessible"
echo "• Verify MCP configuration is correct"
echo "• Monitor disk space for logs"
echo "• Adjust schedule based on API rate limits"
echo ""
echo "🎉 Automation setup complete!"