# TheSportsDB Badge URL Patterns - CORRECT USAGE

## ❌ INCORRECT PATTERNS (These return 404 errors)
- `https://www.thesportsdb.com/images/media/team/badge/{teamName}-badge.png`
- `https://www.thesportsdb.com/images/media/team/badge/tottenham-hotspur-badge.png`
- `https://www.thesportsdb.com/images/media/league/badge/{leagueName}-badge.png`

## ✅ CORRECT PATTERNS (These work)
- `https://r2.thesportsdb.com/images/media/team/badge/{teamId}.png`
- `https://r2.thesportsdb.com/images/media/league/badge/{leagueId}.png`

### Examples of Working URLs:
- `https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png` (Arsenal)
- `https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png` (Chelsea)
- `https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png` (Premier League)

## How to Get Correct Badge URLs

### Method 1: Use TheSportsDB API
```bash
# Get team data with badge URL
curl "https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Arsenal"

# Look for: "strTeamBadge" field in response
```

### Method 2: Use MCP Tools (Recommended)
```javascript
// MCP tools automatically get correct URLs
// Use the brightData MCP tools for reliable downloads
```

### Method 3: Use Entity IDs from Database
```bash
# Use actual team/league IDs from Neo4j or TheSportsDB
# IDs are alphanumeric strings like: xzqdr11517660252, gasy9d1737743125
```

## Badge Download Process

1. **Query TheSportsDB API** to get entity data with correct badge URLs
2. **Extract the badge URL** from the response (strTeamBadge for teams, strBadge for leagues)
3. **Download using the r2.thesportsdb.com domain**
4. **Validate the file** is actually a PNG (not HTML error page)

## File Validation
Always check downloaded files:
```bash
file {filename}.png  # Should show "PNG image data"
ls -la {filename}.png # Should be >5KB, not exactly 1,245 bytes
```

## Error Prevention
- Never use descriptive names in URLs (like "arsenal-badge.png")
- Always use the actual ID-based URLs from the API
- Validate file types after download
- Log all download attempts and results

---
*Created: 2025-09-29*
*Purpose: Prevent future 404 errors when downloading badges*