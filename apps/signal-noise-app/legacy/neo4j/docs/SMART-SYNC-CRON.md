# Smart Incremental RFP Sync - Cron Job Setup

## Intelligent Sync Strategy

This cron job implements **smart incremental processing**:

### 🔄 **First Run (Full Sync)**
- Processes ALL sports entities from your Neo4j knowledge graph
- Populates cache with processed entity IDs
- Stores sync state and timestamps

### 🔄 **Subsequent Runs (Incremental)**
- Queries Neo4j for entities created **since last sync**
- Processes **only new entities** 
- Skips already processed entities (unless manually forced)
- Updates cache and sync state

### 📊 **Cache Management**
- Maintains `.cache/sync-state.json` with processed entities
- Tracks last sync timestamp and processing statistics
- Supports manual full sync override when needed

## Cron Configuration

### Daily Smart Sync (Recommended)
```bash
# Edit crontab
crontab -e

# Add for daily smart sync at 3:00 AM
0 3 * * * cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && node scripts/smart-rfp-sync.js

# Alternative: Business hours sync at 9:00 AM
0 9 * * * cd /path/to/signal-noise-app && node scripts/smart-rfp-sync.js
```

### Weekly Full Sync Refresh (Optional)
```bash
# Weekly full refresh on Sunday at 2:00 AM
0 2 * * 0 cd /path/to/signal-noise-app && node scripts/smart-rfp-sync.js --force-full
```

## Usage Examples

### Normal Incremental Sync
```bash
# Daily automated sync (processes only new entities)
node scripts/smart-rfp-sync.js

# With entity limit (for testing)
node scripts/smart-rfp-sync.js --limit=10
```

### Manual Operations
```bash
# Force full sync of all entities
node scripts/smart-rfp-sync.js --force-full

# Process limited batch for testing
node scripts/smart-rfp-sync.js --limit=5 --force-full
```

## Cache & State Management

### Sync State Location
```
.cache/sync-state.json
```

### State Structure
```json
{
  "lastSync": "2025-01-17T10:30:00.000Z",
  "processedEntities": {
    "premier-league": {
      "lastProcessed": "2025-01-17T10:30:00.000Z",
      "entityType": "league", 
      "entityName": "Premier League",
      "sport": "Football",
      "tier": 1
    }
  },
  "fullSyncCompleted": true,
  "stats": {
    "totalProcessed": 4422,
    "lastProcessedCount": 12,
    "consecutiveFailures": 0
  }
}
```

## Monitoring & Logs

### Log Files
- **Daily logs**: `logs/smart-sync-YYYY-MM-DD.log`
- **Cron output**: Check system cron logs

### Monitor Sync Health
```bash
# Check today's sync activity
cat logs/smart-sync-$(date +%Y-%m-%d).log

# View sync state
cat .cache/sync-state.json | jq '.'

# Check processed entities count
cat .cache/sync-state.json | jq '.stats.totalProcessed'
```

## Performance Optimization

### Incremental Sync Benefits
- **First run**: ~10-15 minutes (all entities)
- **Subsequent runs**: ~30 seconds (new entities only)
- **Database load**: Minimal (only queries new entities)
- **API calls**: Significantly reduced

### Entity Processing Priority
1. **Tier 1**: Premier League, Formula 1, major competitions
2. **Tier 2**: Championship clubs, major venues  
3. **Tier 3**: Other sports organizations

## Troubleshooting

### Reset Sync State
```bash
# Remove cache to force full sync
rm .cache/sync-state.json
```

### Check Neo4j Connection
```bash
# Test entity retrieval
node -e "
const { SmartRFPSync } = require('./scripts/smart-rfp-sync.js');
const sync = new SmartRFPSync();
sync.neo4jService.getAllSportsEntities().then(console.log);
"
```

### Manual Full Sync
```bash
# Force complete refresh of all entities
node scripts/smart-rfp-sync.js --force-full
```

## Advanced Configuration

### Environment Variables
Add to `.env` for cron execution:
```bash
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

### Custom Schedules
```bash
# Every 6 hours (frequent updates)
0 */6 * * * node scripts/smart-rfp-sync.js

# Weekdays only (business-focused)
0 8 * * 1-5 node scripts/smart-rfp-sync.js

# Monthly full refresh
0 2 1 * * node scripts/smart-rfp-sync.js --force-full
```

## Integration with Existing System

The smart sync integrates seamlessly with:
- **RFP Intelligence Dashboard**: Shows newly processed opportunities
- **Entity Browser**: Displays sync status and timestamps  
- **Neo4j Knowledge Graph**: Source of truth for entities
- **Supabase Cache**: Fast frontend data access

## Expected Performance

### Initial Full Sync
- **Entities processed**: 4,000+ sports entities
- **Duration**: 10-15 minutes
- **API calls**: 4,000+ requests
- **Generated opportunities**: 4,000+ RFP scenarios

### Daily Incremental Sync
- **New entities**: 0-50 (typical)
- **Duration**: 30-60 seconds  
- **API calls**: 0-50 requests
- **Generated opportunities**: 0-50 new scenarios

This smart approach ensures your system stays current with minimal resource usage while providing comprehensive coverage of your sports entity knowledge graph.