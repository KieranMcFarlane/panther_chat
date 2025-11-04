# 4000+ Entity Badge Management System

## Overview

This system provides an intelligent solution for downloading and managing badges for 4000+ sports entities from Neo4j, automatically classifying them as clubs or leagues and downloading their respective badges.

## System Components

### 1. Intelligent Entity Classification

The system uses multiple criteria to classify entities:

#### **High-Confidence Classifications:**
- **Direct Types**: `type: 'Club'` or `type: 'League'`
- **Pattern Matching**: Name patterns like "FC", "United", "League", "Premier", etc.
- **Property Analysis**: `leagueId`, `badgePath`, `leagueBadgePath`

#### **Classification Logic:**
```javascript
// Clear clubs
if (entity.type === 'Club') return 'club';

// Clear leagues  
if (entity.type === 'League') return 'league';

// Pattern-based classification
if (entity.name.includes('League') || entity.name.includes('Premier')) {
    return 'league';
}

if (entity.name.endsWith('FC') || entity.name.includes('United')) {
    return 'club';
}

// Organizations need special handling
if (entity.type === 'Organization' && entity.name.includes('League')) {
    return 'league';
}
```

### 2. Optimized Batch Processing

- **Batch Size**: 25-50 entities per batch (configurable)
- **Rate Limiting**: 700-1000ms delay between API calls
- **Parallel Processing**: Up to 5 concurrent downloads
- **Error Handling**: Automatic retries for failed downloads
- **Memory Management**: Prevents memory overload with large datasets

### 3. Progress Tracking & Resume Capability

- **Progress File**: Tracks processed, failed, and skipped entities
- **Resume Support**: Can continue from where it left off
- **Detailed Logging**: Timestamped logs for debugging
- **Statistics**: Real-time progress metrics

## Usage Instructions

### Quick Start

```bash
# Run the optimized badge downloader
node optimized-badge-downloader.js

# Run in dry-run mode first (no actual downloads)
DRY_RUN=true node optimized-badge-downloader.js

# Run with custom batch size
BATCH_SIZE=10 node optimized-badge-downloader.js
```

### Configuration Options

```javascript
// In optimized-badge-downloader.js
const BATCH_SIZE = 25;           // Entities per batch
const API_DELAY = 1000;          // Delay between API calls (ms)
const MAX_RETRIES = 2;           // Retry attempts for failures
const PARALLEL_LIMIT = 5;        // Concurrent downloads
const DRY_RUN = false;          // Test mode without downloading
```

### File Structure

```
/Users/kieranmcfarlane/Downloads/panther_chat/
├── badges/                           # Main badge storage
│   ├── manchester-united-badge.png
│   ├── chelsea-badge.png
│   ├── liverpool-badge.png
│   └── leagues/                      # League badges
│       ├── premier-league-badge.png
│       ├── la-liga-badge.png
│       └── bundesliga-badge.png
├── optimized-badge-downloader.js     # Main downloader script
├── comprehensive-badge-manager.js    # Advanced management system
├── download-progress.json            # Progress tracking
├── download.log                      # Detailed logs
└── badge-download-report.json        # Final report
```

## Entity Classification Rules

### Club Detection
- **Type**: `Club`, `Team`
- **Name Patterns**:
  - Ends with "FC", "United", "City", "Athletic"
  - Contains "Football Club", "Soccer Club"
  - Specific club names: "Arsenal", "Chelsea", "Liverpool", etc.

### League Detection
- **Type**: `League`
- **Name Patterns**:
  - Ends with "League", "Premier", "Championship", "Division"
  - Contains "Serie", "Bundesliga", "LaLiga", "Ligue"
  - Specific league names: "Premier League", "La Liga", etc.

### Organization Handling
- **Type**: `Organization`
- **Logic**: Check if organization name contains league indicators
- **Examples**: "Premier League Organization", "Football League"

## API Integration

### MCP Server Integration

The system integrates with the artificial-intelligence-mcp server:

```javascript
// Download club badge
const result = await callMCPTool('download_club_badge', {
    club_name: 'Manchester United',
    filename: 'manchester-united-badge.png'
});

// Download league badge  
const result = await callMCPTool('download_league_badge', {
    league_id: '4328',
    league_name: 'Premier League',
    filename: 'premier-league-badge.png'
});
```

### TheSportsDB API Integration

```javascript
// API Endpoints
GET https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Manchester%20United
GET https://www.thesportsdb.com/api/v1/json/3/lookupleague.php?id=4328

// Badge URLs
https://www.thesportsdb.com/images/media/team/badge/{teamId}.png
https://www.thesportsdb.com/images/media/league/badge/{leagueId}.png
```

## Performance Optimization

### For 4000+ Entities:

1. **Batch Processing**: Process 25-50 entities at a time
2. **Rate Limiting**: Respect API rate limits (1-2 second delays)
3. **Memory Management**: Clear memory between batches
4. **Progress Tracking**: Save progress frequently
5. **Error Recovery**: Retry failed downloads automatically
6. **Parallel Processing**: Use concurrent downloads where possible

### Expected Performance:
- **Total Entities**: 4,000+
- **Processing Time**: ~2-4 hours
- **Success Rate**: 80-90%
- **Storage Required**: ~50-100MB
- **API Calls**: ~4,000-5,000

## Monitoring and Troubleshooting

### Progress Monitoring

```bash
# Check current progress
cat badges/download-progress.json

# View detailed logs
tail -f badges/download.log

# Check final report
cat badges/badge-download-report.json
```

### Common Issues

1. **API Rate Limits**: Adjust `API_DELAY` if getting 429 errors
2. **Memory Issues**: Reduce `BATCH_SIZE` if memory overflow occurs
3. **Classification Errors**: Check `download.log` for misclassified entities
4. **Download Failures**: Check retry logic and network connectivity

### Manual Intervention

```bash
# Retry failed entities
node retry-failed-downloads.js

# Reclassify specific entities
node reclassify-entity.js --id "entity123" --type "club"

# Download specific badge
node download-specific-badge.js --name "Manchester United" --type "club"
```

## Integration with Existing Systems

### Badge Service Integration

```javascript
// Update badge-service.ts to use downloaded badges
const badgePath = `badges/${entityName}-badge.png`;
const localBadgeExists = await fs.pathExists(badgePath);

if (localBadgeExists) {
    return {
        url: `/badges/${entityName}-badge.png`,
        source: 'local',
        path: badgePath
    };
}
```

### Neo4j Updates

```javascript
// Update Neo4j with badge paths
await session.run(`
    MATCH (e {id: $entityId})
    SET e.badgePath = $badgePath,
        e.badgeDownloadedAt = datetime(),
        e.badgeSource = 'local'
    RETURN e
`, { entityId, badgePath });
```

## Best Practices

1. **Start Small**: Test with 10-20 entities first
2. **Monitor Progress**: Check logs frequently during large runs
3. **Backup Data**: Backup existing badges before mass download
4. **Rate Limiting**: Be conservative with API delays
5. **Error Handling**: Implement comprehensive error recovery
6. **Documentation**: Document any custom classification rules

## Advanced Features

### Custom Classification Rules

```javascript
// Add custom patterns to CLASSIFICATION object
const CUSTOM_PATTERNS = {
    // Custom league patterns
    CUSTOM_LEAGUES: [
        /cup$/i, /tournament$/i, /series$/i
    ],
    
    // Custom club patterns  
    CUSTOM_CLUBS: [
        /association$/i, /sporting$/i, /dynamo$/i
    ]
};
```

### Badge Validation

```javascript
// Validate downloaded badges
async function validateBadge(badgePath) {
    const stats = await fs.stat(badgePath);
    
    // Check file size (should be > 1KB)
    if (stats.size < 1024) {
        return false;
    }
    
    // Check if it's actually an image
    const buffer = await fs.readFile(badgePath);
    return buffer.toString('hex', 0, 4) === '89504e47'; // PNG signature
}
```

### Automatic Retry Logic

```javascript
// Implement exponential backoff
async function downloadWithRetry(entity, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await downloadBadge(entity);
            if (result.success) return result;
            
            // Exponential backoff
            await new Promise(resolve => 
                setTimeout(resolve, Math.pow(2, i) * 1000)
            );
        } catch (error) {
            if (i === maxRetries - 1) throw error;
        }
    }
}
```

This system provides a comprehensive solution for managing badges for 4000+ entities with intelligent classification, optimized processing, and robust error handling.