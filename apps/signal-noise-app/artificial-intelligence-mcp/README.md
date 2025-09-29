# Artificial Intelligence MCP Server

MCP (Model Context Protocol) server for Artificial Intelligence tools and TheSportsDB API integration.

## Features

- **Sports Data Integration**: Access to TheSportsDB API for comprehensive sports information
- **League Search**: Search and get detailed information about sports leagues
- **Team Information**: Search teams and get detailed team information
- **Live Scores**: Get real-time sports scores
- **Event Scheduling**: Get sports events by date
- **AI-Powered Insights**: Leverage AI for sports analytics and predictions

## Available Tools

### search_sports_leagues
Search for sports leagues by name or keyword.

**Parameters:**
- `query` (string): Search query for leagues

### get_league_details
Get detailed information about a specific league.

**Parameters:**
- `league_id` (string): TheSportsDB league ID

### search_teams
Search for teams within a specific league.

**Parameters:**
- `league_id` (string): TheSportsDB league ID
- `query` (string): Search query for teams

### get_team_details
Get detailed information about a specific team.

**Parameters:**
- `team_id` (string): TheSportsDB team ID

### get_live_scores
Get live sports scores.

**Parameters:**
- `sport` (string, optional): Sport name (e.g., 'soccer', 'basketball', 'football')

### get_events_by_date
Get sports events for a specific date.

**Parameters:**
- `date` (string): Date in YYYY-MM-DD format
- `sport` (string, optional): Sport name

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`

## Usage

The server is designed to work with Claude Code and other MCP-compatible clients. Once configured, the tools will be available automatically in your Claude Code sessions.

## API Integration

This server integrates with TheSportsDB API (https://www.thesportsdb.com/api/v2/json/3/) to provide comprehensive sports data including:

- League information and standings
- Team details and statistics
- Live scores and match results
- Event schedules and historical data
- Player information when available

## Configuration

The server uses the free tier of TheSportsDB API with the API key "3". For production use, you may want to upgrade to a paid plan for higher rate limits and additional features.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start the server
npm start
```

## License

MIT License - see LICENSE file for details.