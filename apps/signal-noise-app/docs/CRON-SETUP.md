# Sports RFP Intelligence Cron Job Configuration

## Daily Automated Sync (Recommended: 2:30 AM)

### Add to your crontab:
```bash
# Edit crontab
crontab -e

# Add this line for daily execution at 2:30 AM
30 2 * * * cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && node scripts/daily-rfp-sync.js >> logs/cron.log 2>&1

# Alternative: Run at 9:00 AM for business hours monitoring
0 9 * * * cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && node scripts/daily-rfp-sync.js >> logs/cron.log 2>&1
```

### Cron Schedule Examples:
```bash
# Every day at 2:30 AM (recommended for off-peak hours)
30 2 * * *

# Every day at 9:00 AM (business hours)
0 9 * * *

# Every weekday at 8:00 AM (Mon-Fri)
0 8 * * 1-5

# Every 6 hours (4 times daily)
0 */6 * * *
```

## Testing the Cron Job

### Test the script manually:
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
node scripts/daily-rfp-sync.js
```

### Test cron scheduling (run in 1 minute for testing):
```bash
# Add to crontab for testing
* * * * * cd /path/to/signal-noise-app && node scripts/daily-rfp-sync.js

# Check after 1 minute, then remove the test line
crontab -e
```

## Monitoring & Logs

### Log locations:
- **Daily logs**: `logs/daily-rfp-cron-YYYY-MM-DD.log`
- **Cron output**: `logs/cron.log`

### Check recent execution:
```bash
# View today's log
cat logs/daily-rfp-cron-$(date +%Y-%m-%d).log

# View cron execution logs
tail -f logs/cron.log

# Check if cron is running
ps aux | grep cron
```

## Configuration Options

### Environment variables for cron:
Add to your `.env` file or set in the crontab:
```bash
# In crontab
30 2 * * * cd /path/to/signal-noise-app && NODE_ENV=production BRIGHTDATA_API_TOKEN=your_token node scripts/daily-rfp-sync.js

# Or ensure .env is loaded
30 2 * * * cd /path/to/signal-noise-app && source .env && node scripts/daily-rfp-sync.js
```

### Customize execution timing:
```bash
# Run at different times based on your needs:
30 2 * * *  # 2:30 AM - Off-peak, minimal system impact
0 9 * * *   # 9:00 AM - Start of business day
30 18 * * *  # 6:30 PM - End of business day review
```

## Troubleshooting

### Common issues:
1. **Node.js not found**: Use full path to node executable
   ```bash
   which node
   # Use full path in cron: /usr/local/bin/node
   ```

2. **Environment variables missing**: Source your .env file
   ```bash
   30 2 * * * cd /path && source .env && node scripts/daily-rfp-sync.js
   ```

3. **Permission issues**: Make script executable
   ```bash
   chmod +x scripts/daily-rfp-sync.js
   ```

### Debug cron issues:
```bash
# Check cron service status
sudo service cron status  # Linux
brew services list | grep cron  # macOS

# View system cron logs
tail -f /var/log/syslog | grep CRON  # Linux
log stream --predicate 'process == "cron"'  # macOS
```

## Backup & Recovery

### Export cron configuration:
```bash
crontab -l > backup-crontab.txt
```

### Restore cron configuration:
```bash
crontab backup-crontab.txt
```

## Performance Impact

- **Execution time**: ~2-5 minutes
- **Memory usage**: Minimal
- **Network requests**: ~10-15 API calls to your local server
- **Storage**: Creates daily log files (~1-5KB each)

## Next Steps

1. **Set up the cron job** using your preferred schedule
2. **Test manually** first to ensure the script works
3. **Monitor logs** for first few executions
4. **Set up notifications** (optional) for successful/failed runs
5. **Review metrics** weekly to fine-tune timing