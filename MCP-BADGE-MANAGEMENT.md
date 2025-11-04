# MCP Badge Management System

## Overview
This document describes how to use the MCP (Model Context Protocol) tools to download and map badges for sports entities in the Neo4j database.

## Available MCP Tools

### Artificial Intelligence MCP Server
The artificial-intelligence-mcp server provides the following badge management tools:

1. **`scan_and_download_missing_badges`** - Main tool for comprehensive badge management
2. **`download_club_badge`** - Download club badges from TheSportsDB API
3. **`download_league_badge`** - Download league badges from TheSportsDB API
4. **`map_entity_to_badge_file`** - Map Neo4j entities to local badge files
5. **`bulk_download_club_badges`** - Process multiple clubs in batch
6. **`bulk_download_league_badges`** - Process multiple leagues in batch
7. **`scan_club_entities`** - Scan Neo4j for club entities
8. **`scan_league_entities`** - Scan Neo4j for league entities

### Neo4j MCP Server
- **`execute_query`** - Run Cypher queries against Neo4j
- **`create_node`** - Create nodes in Neo4j
- **`create_relationship`** - Create relationships in Neo4j

### BrightData MCP Server
- **`scrape_as_markdown`** - Scrape web content
- **`search_engine`** - Search the web

## Current Status

### Entities Ready for Badge Processing
The following entities have been identified and updated with proper structure:

#### League Entities
1. **Premier League (json_seed)**
   - ID: 4328
   - Type: League
   - Badge Status: Missing
   - Expected Badge Path: `badges/leagues/english-premier-league-league-badge.png`

2. **Indian Premier League (IPL) (json_seed)**
   - ID: 13579
   - Type: League
   - Badge Status: Missing
   - Expected Badge Path: `badges/leagues/indian-premier-league-league-badge.png`

3. **Australian Football League (AFL) (json_seed)**
   - ID: 1248
   - Type: League
   - Badge Status: Missing
   - Expected Badge Path: `badges/leagues/australian-football-league-league-badge.png`

#### Club Entities
1. **Manchester United**
   - ID: 133602
   - Type: Club
   - Badge Status: Missing
   - Expected Badge Path: `badges/manchester-united-badge.png`

2. **São Paulo FC**
   - ID: 6603
   - Type: Club
   - Badge Status: Missing
   - Expected Badge Path: `badges/sao-paulo-badge.png`

## File Structure
```
badges/
├── manchester-united-badge.png
├── sao-paulo-badge.png
└── leagues/
    ├── english-premier-league-league-badge.png
    ├── indian-premier-league-league-badge.png
    └── australian-football-league-league-badge.png
```

## Usage Instructions

### Prerequisites
1. Ensure artificial-intelligence-mcp server is running:
   ```bash
   cd apps/signal-noise-app/artificial-intelligence-mcp
   npm run dev
   ```

2. Verify Neo4j connection is working

3. Create badges directories:
   ```bash
   mkdir -p badges/leagues
   ```

### Basic Usage

#### 1. Scan and Download All Missing Badges
```javascript
// Test first (dry run)
const testResults = await scan_and_download_missing_badges({
  dry_run: true
});

// Then execute
const finalResults = await scan_and_download_missing_badges({
  dry_run: false
});
```

#### 2. Download Individual Club Badge
```javascript
const result = await download_club_badge({
  clubName: 'Manchester United',
  clubId: '133602',
  badgeName: 'manchester-united-badge.png'
});
```

#### 3. Download Individual League Badge
```javascript
const result = await download_league_badge({
  leagueName: 'Premier League',
  leagueId: '4328',
  badgeName: 'english-premier-league-league-badge.png'
});
```

#### 4. Map Entity to Badge File
```javascript
const result = await map_entity_to_badge_file({
  entityName: 'Manchester United',
  entityType: 'Club',
  badgePath: 'badges/manchester-united-badge.png'
});
```

### API Endpoints

#### TheSportsDB API
- **Team Lookup**: `https://www.thesportsdb.com/api/v1/json/3/lookupteam.php?id={teamId}`
- **League Lookup**: `https://www.thesportsdb.com/api/v1/json/3/lookupleague.php?id={leagueId}`
- **Badge URLs**: `https://www.thesportsdb.com/images/media/team/badge/{teamId}.png`

### Example API Responses

#### Team Response
```json
{
  "teams": [
    {
      "idTeam": "133602",
      "strTeam": "Manchester United",
      "strLeague": "English Premier League",
      "strTeamBadge": "https://www.thesportsdb.com/images/media/team/badge/133602.png"
    }
  ]
}
```

#### League Response
```json
{
  "leagues": [
    {
      "idLeague": "4328",
      "strLeague": "Premier League",
      "strBadge": "https://www.thesportsdb.com/images/media/league/badge/4328.png"
    }
  ]
}
```

## Current Implementation Status

✅ **Completed**
- Neo4j database setup
- Entity structure update (Club/League labels)
- Basic MCP server configuration
- Entity identification and classification
- Directory structure creation

🔄 **In Progress**
- Badge download automation
- Entity-to-badge mapping
- Bulk processing capabilities

⏳ **Pending**
- Complete badge download for all entities
- Error handling and retry logic
- Progress tracking and reporting
- Integration with frontend display

## Database Schema

### Entity Properties
```cypher
// Club Entity
{
  name: "Manchester United",
  entityType: "Club",
  id: "133602",
  badgePath: "badges/manchester-united-badge.png",
  badgeDownloadedAt: "2024-01-15T10:30:00Z"
}

// League Entity
{
  name: "Premier League",
  entityType: "League", 
  leagueId: "4328",
  leagueBadgePath: "badges/leagues/english-premier-league-league-badge.png",
  leagueBadgeDownloadedAt: "2024-01-15T10:30:00Z"
}
```

## Troubleshooting

### Common Issues

1. **MCP Server Not Running**
   - Start the server: `npm run dev`
   - Check port 3001 is available
   - Verify no other services using the port

2. **Entity Not Found**
   - Ensure entity has proper Club/League label
   - Verify entity has required ID field (id for clubs, leagueId for leagues)
   - Check entity name format

3. **Badge Download Failed**
   - Verify TheSportsDB API key is valid
   - Check internet connection
   - Verify badge URL format
   - Check file permissions

4. **Neo4j Connection Issues**
   - Verify database is running
   - Check connection credentials
   - Ensure proper database permissions

## Next Steps

1. **Complete Badge Downloads**
   - Process all 5 identified entities
   - Handle download failures gracefully
   - Verify badge file integrity

2. **Expand Entity Database**
   - Add more clubs and leagues
   - Implement entity discovery
   - Bulk entity processing

3. **Frontend Integration**
   - Display badges in UI components
   - Implement badge upload functionality
   - Add badge management admin panel

4. **Advanced Features**
   - Badge versioning
   - Badge metadata storage
   - Badge analytics and usage tracking

## Monitoring and Maintenance

### Health Checks
- Monitor MCP server status
- Check Neo4j connectivity
- Verify badge file availability
- Track API rate limits

### Performance Optimization
- Implement batch processing
- Cache frequently accessed badges
- Optimize database queries
- Monitor memory usage

---

**Created:** 2024-01-15
**Status:** Active Development
**Version:** 1.0.0