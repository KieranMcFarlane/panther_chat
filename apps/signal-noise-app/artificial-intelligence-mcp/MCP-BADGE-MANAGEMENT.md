# Artificial Intelligence MCP Server - Badge Management Documentation

## Overview

The Artificial Intelligence MCP server provides comprehensive badge management capabilities for sports entities (clubs and leagues) stored in Neo4j. It automatically downloads badges from TheSportsDB API and maps them to local entities for frontend display.

## Features

### 🔍 Smart Entity Scanning
- Automatically identifies club and league entities in Neo4j
- Detects entities missing badges
- Handles duplicate and ambiguous entries intelligently

### ⚡ Automated Badge Management
1. **Scan** - Find entities without badges
2. **Find** - Search TheSportsDB API
3. **Download** - Save badges locally
4. **Map** - Update Neo4j with file paths

### 📁 Organized Storage
- Club badges: `badges/` folder
- League badges: `badges/leagues/` folder
- Safe, descriptive filenames

## Available Tools

### 🎯 Core Tools

#### `scan_and_download_missing_badges`
**The main tool for processing all entities without badges**

```javascript
const results = await scan_and_download_missing_badges({
  dry_run: false  // Set to true for testing
});
```

**What it does:**
- Scans Neo4j for entities without badges
- Categorizes them as clubs or leagues
- Downloads appropriate badges
- Maps them to entities in Neo4j
- Returns comprehensive results

#### `download_club_badge`
**Download a specific club badge**

```javascript
const result = await download_club_badge({
  club_name: "Arsenal",
  filename: "arsenal-custom-badge.png"  // Optional
});
```

#### `download_league_badge`
**Download a specific league badge**

```javascript
const result = await download_league_badge({
  league_id: "4328",
  league_name: "English Premier League",
  filename: "epl-badge.png"  // Optional
});
```

### 🔍 Scanning Tools

#### `scan_club_entities`
**Find club entities in Neo4j**

```javascript
const clubs = await scan_club_entities({
  entity_type: "Club",  // Optional
  limit: 100
});
```

#### `scan_league_entities`
**Find league entities in Neo4j**

```javascript
const leagues = await scan_league_entities({
  limit: 100
});
```

### 🚀 Batch Processing Tools

#### `bulk_download_club_badges`
**Process multiple club entities**

```javascript
const results = await bulk_download_club_badges({
  entities: [
    { id: "entity-1", name: "Arsenal" },
    { id: "entity-2", name: "Chelsea" }
  ],
  dry_run: false
});
```

#### `bulk_download_league_badges`
**Process multiple league entities**

```javascript
const results = await bulk_download_league_badges({
  entities: [
    { id: "entity-1", name: "EPL", leagueId: "4328" },
    { id: "entity-2", name: "La Liga", leagueId: "4335" }
  ],
  dry_run: false
});
```

#### `auto_download_all_club_badges`
**Automatically process all club entities**

```javascript
const results = await auto_download_all_club_badges({
  dry_run: false
});
```

#### `auto_download_all_league_badges`
**Automatically process all league entities**

```javascript
const results = await auto_download_all_league_badges({
  dry_run: false
});
```

## Usage Examples

### 1. Initial Setup - Process All Missing Badges

```javascript
// First, test what would be processed
const testResults = await scan_and_download_missing_badges({
  dry_run: true
});

console.log("Will process:", testResults.summary);

// Then actually process them
const finalResults = await scan_and_download_missing_badges({
  dry_run: false
});
```

### 2. Process Specific Leagues

```javascript
// Download English Premier League badge
const eplBadge = await download_league_badge({
  league_id: "4328",
  league_name: "English Premier League"
});
```

### 3. Process New Entities

```javascript
// When you add new entities, just run the scanner again
const newResults = await scan_and_download_missing_badges({
  dry_run: false
});
```

## File Structure

After processing, badges are organized as:

```
badges/
├── arsenal-badge.png
├── chelsea-badge.png
├── manchester-united-badge.png
└── leagues/
    ├── english-premier-league-league-badge.png
    ├── la-liga-league-badge.png
    └── serie-a-league-badge.png
```

## Neo4j Entity Updates

### Club Entities
After processing, club entities get these properties:
- `badgePath`: Local file path to badge
- `badgeFilename`: Just the filename
- `hasBadge`: `true`
- `badgeUpdatedAt`: Timestamp of last update

### League Entities
After processing, league entities get these properties:
- `leagueBadgePath`: Local file path to badge
- `leagueBadgeFilename`: Just the filename
- `hasLeagueBadge`: `true`
- `leagueBadgeUpdatedAt`: Timestamp of last update

## Smart Features

### 🔍 Entity Detection
The system automatically identifies entities using:
- **Labels**: `Club`, `Team`, `Organization`, `League`
- **Properties**: `type = 'club'`, `type = 'league'`
- **Name patterns**: Entities with "FC", "United", "League" in names

### ⚠️ Ambiguity Handling
- **Leagues without `leagueId`**: Skipped for manual intervention
- **Multiple matches**: Reported for manual review
- **No API match**: Clearly flagged in results

### 🔄 Idempotent Processing
- **Safe to run multiple times**: Only processes entities without badges
- **Dry-run mode**: Test without making changes
- **Comprehensive logging**: Full visibility into what happened

## Error Handling

All tools return structured results with:
- **Success status**
- **Detailed error messages**
- **Per-entity results**
- **Summary statistics**

Example error response:
```json
{
  "success": false,
  "error": "Failed to download badge: Network error",
  "summary": {
    "total": 10,
    "successful": 7,
    "failed": 3
  },
  "results": [
    {
      "entityId": "entity-1",
      "entityName": "Arsenal",
      "success": true,
      "localPath": "/path/to/badges/arsenal-badge.png"
    },
    {
      "entityId": "entity-2", 
      "entityName": "Unknown Club",
      "success": false,
      "error": "No club found for: Unknown Club"
    }
  ]
}
```

## Best Practices

### 1. Always Test First
```javascript
// Always run with dry_run: true first
const testResults = await scan_and_download_missing_badges({
  dry_run: true
});
```

### 2. Monitor Results
Review the results to understand:
- How many entities were processed
- Which ones failed and why
- Which ones were skipped for manual intervention

### 3. Handle Ambiguity Manually
For leagues without `leagueId` or ambiguous matches:
1. Find the correct `leagueId` from TheSportsDB
2. Update the entity in Neo4j with the `leagueId`
3. Re-run the scanner

### 4. Regular Updates
Run the scanner periodically to catch:
- Newly added entities
- Entities that previously failed but might succeed now

## API Integration

### TheSportsDB API
The server integrates with TheSportsDB API:
- **Base URL**: `https://www.thesportsdb.com/api/v1/json/{API_KEY}`
- **Club search**: `/searchteams.php?t={club_name}`
- **League details**: `/lookupleague.php?id={league_id}`

### Required Environment Variables
```bash
# Neo4j Connection
NEO4J_URI=neo4j://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# TheSportsDB API
SPORTSDB_API_KEY=your_sportsdb_api_key
```

## Troubleshooting

### Common Issues

1. **"No club found" errors**
   - Check spelling of club names
   - Some clubs might not be in TheSportsDB database

2. **"No league found" errors**
   - Verify the `leagueId` is correct
   - Check TheSportsDB website for the correct league ID

3. **Permission errors**
   - Ensure the badges directory is writable
   - Check Neo4j connection permissions

4. **Network errors**
   - Verify internet connection
   - Check TheSportsDB API status

### Debug Mode
Enable verbose logging by setting:
```bash
DEBUG=mcp:* npm run dev
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the tool responses for detailed error messages
3. Verify your API keys and database connections
4. Test with dry-run mode first