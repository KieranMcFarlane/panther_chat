#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { Command } from "commander";
import neo4j from "neo4j-driver";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const server = new Server(
  {
    name: "artificial-intelligence-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// TheSportsDB API base URL
const SPORTSDB_API_BASE = "https://www.thesportsdb.com/api/v2/json/3";

// Neo4j configuration
const NEO4J_URI = process.env.NEO4J_URI || "neo4j+s://cce1f84b.databases.neo4j.io";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0";

// Initialize Neo4j driver
const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// Badge storage configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BADGES_DIR = path.join(__dirname, '..', '..', 'badges');
const LEAGUES_DIR = path.join(__dirname, '..', '..', 'badges', 'leagues');

// Available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_sports_leagues",
        description: "Search for sports leagues",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for leagues",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_league_details",
        description: "Get detailed information about a specific league",
        inputSchema: {
          type: "object",
          properties: {
            league_id: {
              type: "string",
              description: "TheSportsDB league ID",
            },
          },
          required: ["league_id"],
        },
      },
      {
        name: "search_teams",
        description: "Search for teams in a league",
        inputSchema: {
          type: "object",
          properties: {
            league_id: {
              type: "string",
              description: "TheSportsDB league ID",
            },
            query: {
              type: "string",
              description: "Search query for teams",
            },
          },
          required: ["league_id"],
        },
      },
      {
        name: "get_team_details",
        description: "Get detailed information about a specific team",
        inputSchema: {
          type: "object",
          properties: {
            team_id: {
              type: "string",
              description: "TheSportsDB team ID",
            },
          },
          required: ["team_id"],
        },
      },
      {
        name: "get_live_scores",
        description: "Get live sports scores",
        inputSchema: {
          type: "object",
          properties: {
            sport: {
              type: "string",
              description: "Sport name (e.g., 'soccer', 'basketball', 'football')",
            },
          },
        },
      },
      {
        name: "get_events_by_date",
        description: "Get sports events for a specific date",
        inputSchema: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Date in YYYY-MM-DD format",
            },
            sport: {
              type: "string",
              description: "Sport name (optional)",
            },
          },
          required: ["date"],
        },
      },
      {
        name: "create_badge",
        description: "Create a new badge in the Neo4j database",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Badge name",
            },
            description: {
              type: "string",
              description: "Badge description",
            },
            category: {
              type: "string",
              description: "Badge category (e.g., 'achievement', 'skill', 'milestone')",
            },
            icon_url: {
              type: "string",
              description: "URL for badge icon (optional)",
            },
            requirements: {
              type: "string",
              description: "Requirements to earn the badge",
            },
          },
          required: ["name", "description", "category"],
        },
      },
      {
        name: "get_badges",
        description: "Get all badges from the Neo4j database",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by badge category (optional)",
            },
          },
        },
      },
      {
        name: "award_badge_to_user",
        description: "Award a badge to a user",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID to award the badge to",
            },
            badge_id: {
              type: "string",
              description: "Badge ID to award",
            },
            reason: {
              type: "string",
              description: "Reason for awarding the badge",
            },
          },
          required: ["user_id", "badge_id"],
        },
      },
      {
        name: "get_user_badges",
        description: "Get all badges awarded to a specific user",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID",
            },
          },
          required: ["user_id"],
        },
      },
      {
        name: "check_badge_requirements",
        description: "Check if a user meets the requirements for a specific badge",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID to check",
            },
            badge_id: {
              type: "string",
              description: "Badge ID to check requirements for",
            },
          },
          required: ["user_id", "badge_id"],
        },
      },
      {
        name: "download_club_badge",
        description: "Download a club badge from TheSportsDB and save it locally",
        inputSchema: {
          type: "object",
          properties: {
            club_name: {
              type: "string",
              description: "Name of the sports club",
            },
            filename: {
              type: "string",
              description: "Custom filename (optional, auto-generated if not provided)",
            },
          },
          required: ["club_name"],
        },
      },
      {
        name: "map_entity_to_badge_file",
        description: "Map a Neo4j entity to a local badge file",
        inputSchema: {
          type: "object",
          properties: {
            entity_id: {
              type: "string",
              description: "Entity ID from Neo4j",
            },
            badge_path: {
              type: "string",
              description: "Local path to the badge image file",
            },
            club_name: {
              type: "string",
              description: "Club name for reference",
            },
          },
          required: ["entity_id", "badge_path"],
        },
      },
      {
        name: "bulk_download_club_badges",
        description: "Download badges for multiple clubs and map to entities",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              description: "Array of club entities to process",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "Entity ID",
                  },
                  name: {
                    type: "string",
                    description: "Club name",
                  },
                },
                required: ["id", "name"],
              },
            },
            dry_run: {
              type: "boolean",
              description: "Show what would be downloaded without actually downloading (default: false)",
            },
          },
          required: ["entities"],
        },
      },
      {
        name: "scan_club_entities",
        description: "Scan Neo4j for club entities",
        inputSchema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              description: "Entity type to scan (e.g., 'Club', 'Team', 'Organization')",
            },
            limit: {
              type: "number",
              description: "Maximum number of entities to scan (default: 100)",
            },
          },
        },
      },
      {
        name: "auto_download_all_club_badges",
        description: "Automatically scan Neo4j for club entities and download all their badges",
        inputSchema: {
          type: "object",
          properties: {
            dry_run: {
              type: "boolean",
              description: "Show what would be downloaded without actually downloading (default: false)",
            },
          },
        },
      },
      {
        name: "download_league_badge",
        description: "Download a league badge by league ID and name",
        inputSchema: {
          type: "object",
          properties: {
            league_id: {
              type: "string",
              description: "TheSportsDB league ID (e.g., '4328' for English Premier League)",
            },
            league_name: {
              type: "string", 
              description: "Name of the league (e.g., 'English Premier League')",
            },
            filename: {
              type: "string",
              description: "Custom filename for the badge (optional)",
            },
          },
          required: ["league_id", "league_name"],
        },
      },
      {
        name: "scan_league_entities",
        description: "Scan Neo4j for league entities",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of entities to scan (default: 100)",
            },
          },
        },
      },
      {
        name: "auto_download_all_league_badges",
        description: "Automatically scan Neo4j for league entities and download all their badges (skips those without leagueId)",
        inputSchema: {
          type: "object",
          properties: {
            dry_run: {
              type: "boolean",
              description: "Show what would be downloaded without actually downloading (default: false)",
            },
          },
        },
      },
      {
        name: "scan_and_download_missing_badges",
        description: "Scan Neo4j for all entities without badges and automatically download them (both clubs and leagues)",
        inputSchema: {
          type: "object",
          properties: {
            dry_run: {
              type: "boolean",
              description: "Show what would be downloaded without actually downloading (default: false)",
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error("No arguments provided");
  }

  try {
    switch (name) {
      case "search_sports_leagues":
        if (typeof args.query !== 'string') {
          throw new Error("Query must be a string");
        }
        return await searchSportsLeagues(args.query);
      
      case "get_league_details":
        if (typeof args.league_id !== 'string') {
          throw new Error("League ID must be a string");
        }
        return await getLeagueDetails(args.league_id);
      
      case "search_teams":
        if (typeof args.league_id !== 'string') {
          throw new Error("League ID must be a string");
        }
        if (typeof args.query !== 'string') {
          throw new Error("Query must be a string");
        }
        return await searchTeams(args.league_id, args.query);
      
      case "get_team_details":
        if (typeof args.team_id !== 'string') {
          throw new Error("Team ID must be a string");
        }
        return await getTeamDetails(args.team_id);
      
      case "get_live_scores":
        if (args.sport && typeof args.sport !== 'string') {
          throw new Error("Sport must be a string");
        }
        return await getLiveScores(args.sport as string | undefined);
      
      case "get_events_by_date":
        if (typeof args.date !== 'string') {
          throw new Error("Date must be a string");
        }
        if (args.sport && typeof args.sport !== 'string') {
          throw new Error("Sport must be a string");
        }
        return await getEventsByDate(args.date, args.sport as string | undefined);
      
      case "create_badge":
        if (typeof args.name !== 'string') {
          throw new Error("Badge name must be a string");
        }
        if (typeof args.description !== 'string') {
          throw new Error("Badge description must be a string");
        }
        if (typeof args.category !== 'string') {
          throw new Error("Badge category must be a string");
        }
        return await createBadge(
          args.name,
          args.description,
          args.category,
          args.icon_url as string | undefined,
          args.requirements as string | undefined
        );
      
      case "get_badges":
        return await getBadges(args.category as string | undefined);
      
      case "award_badge_to_user":
        if (typeof args.user_id !== 'string') {
          throw new Error("User ID must be a string");
        }
        if (typeof args.badge_id !== 'string') {
          throw new Error("Badge ID must be a string");
        }
        return await awardBadgeToUser(
          args.user_id,
          args.badge_id,
          args.reason as string | undefined
        );
      
      case "get_user_badges":
        if (typeof args.user_id !== 'string') {
          throw new Error("User ID must be a string");
        }
        return await getUserBadges(args.user_id);
      
      case "check_badge_requirements":
        if (typeof args.user_id !== 'string') {
          throw new Error("User ID must be a string");
        }
        if (typeof args.badge_id !== 'string') {
          throw new Error("Badge ID must be a string");
        }
        return await checkBadgeRequirements(args.user_id, args.badge_id);
      
      case "download_club_badge":
        if (typeof args.club_name !== 'string') {
          throw new Error("Club name must be a string");
        }
        return await downloadClubBadge(
          args.club_name,
          args.filename as string | undefined
        );
      
      case "map_entity_to_badge_file":
        if (typeof args.entity_id !== 'string') {
          throw new Error("Entity ID must be a string");
        }
        if (typeof args.badge_path !== 'string') {
          throw new Error("Badge path must be a string");
        }
        return await mapEntityToBadgeFile(
          args.entity_id,
          args.badge_path,
          args.club_name as string | undefined
        );
      
      case "bulk_download_club_badges":
        if (!Array.isArray(args.entities)) {
          throw new Error("Entities must be an array");
        }
        return await bulkDownloadClubBadges(
          args.entities,
          args.dry_run as boolean | undefined ?? false
        );
      
      case "scan_club_entities":
        return await scanClubEntities(
          args.entity_type as string | undefined,
          args.limit as number | undefined ?? 100
        );
      
      case "auto_download_all_club_badges":
        return await autoDownloadAllClubBadges(
          args.dry_run as boolean | undefined ?? false
        );
      
      case "download_league_badge":
        if (typeof args.league_id !== 'string' || typeof args.league_name !== 'string') {
          throw new Error("League ID and league name must be strings");
        }
        return await downloadLeagueBadge(
          args.league_id,
          args.league_name,
          args.filename as string | undefined
        );
      
      case "scan_league_entities":
        return await scanLeagueEntities(
          args.limit as number | undefined ?? 100
        );
      
      case "auto_download_all_league_badges":
        return await autoDownloadAllLeagueBadges(
          args.dry_run as boolean | undefined ?? false
        );
      
      case "scan_and_download_missing_badges":
        return await scanAndDownloadMissingBadges(
          args.dry_run as boolean | undefined ?? false
        );
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Tool implementations
async function searchSportsLeagues(query: string) {
  const url = `${SPORTSDB_API_BASE}/search_all_leagues.php?l=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Operation failed: ${errorMessage}`);
  }
}

async function getLeagueDetails(leagueId: string) {
  const url = `${SPORTSDB_API_BASE}/lookupleague.php?id=${leagueId}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get league details: ${errorMessage}`);
  }
}

async function searchTeams(leagueId: string, query: string) {
  const url = `${SPORTSDB_API_BASE}/search_all_teams.php?l=${leagueId}&t=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to search teams: ${errorMessage}`);
  }
}

async function getTeamDetails(teamId: string) {
  const url = `${SPORTSDB_API_BASE}/lookupteam.php?id=${teamId}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get team details: ${errorMessage}`);
  }
}

async function getLiveScores(sport?: string) {
  let url = `${SPORTSDB_API_BASE}/livescore.php`;
  if (sport) {
    url += `?s=${encodeURIComponent(sport)}`;
  }
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get live scores: ${errorMessage}`);
  }
}

async function getEventsByDate(date: string, sport?: string) {
  let url = `${SPORTSDB_API_BASE}/eventsday.php?d=${date}`;
  if (sport) {
    url += `&s=${encodeURIComponent(sport)}`;
  }
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get events by date: ${errorMessage}`);
  }
}

// Badge management functions
async function createBadge(name: string, description: string, category: string, iconUrl?: string, requirements?: string) {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `
      CREATE (b:Badge {
        id: randomUUID(),
        name: $name,
        description: $description,
        category: $category,
        icon_url: $iconUrl,
        requirements: $requirements,
        created_at: datetime()
      })
      RETURN b
      `,
      { name, description, category, iconUrl, requirements }
    );
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result.records[0]?.get('b')?.properties, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create badge: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function getBadges(category?: string) {
  const session = driver.session();
  
  try {
    let query = 'MATCH (b:Badge) WHERE 1=1';
    const params: any = {};
    
    if (category) {
      query += ' AND b.category = $category';
      params.category = category;
    }
    
    query += ' RETURN b ORDER BY b.created_at DESC';
    
    const result = await session.run(query, params);
    
    const badges = result.records.map(record => record.get('b').properties);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(badges, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get badges: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function awardBadgeToUser(userId: string, badgeId: string, reason?: string) {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})
      MATCH (b:Badge {id: $badgeId})
      MERGE (u)-[r:EARNED_BADGE]->(b)
      SET r.awarded_at = datetime(),
          r.reason = $reason
      RETURN u, b, r
      `,
      { userId, badgeId, reason }
    );
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            user: result.records[0]?.get('u')?.properties,
            badge: result.records[0]?.get('b')?.properties,
            award: result.records[0]?.get('r')?.properties
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to award badge: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function getUserBadges(userId: string) {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[r:EARNED_BADGE]->(b:Badge)
      RETURN b, r
      ORDER BY r.awarded_at DESC
      `,
      { userId }
    );
    
    const badges = result.records.map(record => ({
      badge: record.get('b').properties,
      award: record.get('r').properties
    }));
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(badges, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get user badges: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function checkBadgeRequirements(userId: string, badgeId: string) {
  const session = driver.session();
  
  try {
    // First get the badge requirements
    const badgeResult = await session.run(
      'MATCH (b:Badge {id: $badgeId}) RETURN b',
      { badgeId }
    );
    
    const badge = badgeResult.records[0]?.get('b')?.properties;
    
    if (!badge) {
      throw new Error('Badge not found');
    }
    
    // Check if user already has the badge
    const existingAward = await session.run(
      `
      MATCH (u:User {id: $userId})-[r:EARNED_BADGE]->(b:Badge {id: $badgeId})
      RETURN r
      `,
      { userId, badgeId }
    );
    
    const hasBadge = existingAward.records.length > 0;
    
    // Here you would implement custom logic to check if user meets requirements
    // For now, we'll return the badge info and current status
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            badge,
            hasBadge,
            requirements: badge.requirements,
            recommendation: hasBadge ? 'User already has this badge' : 'User may be eligible for this badge'
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to check badge requirements: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function downloadLeagueBadge(leagueId: string, leagueName: string, filename?: string) {
  try {
    // Get league details from TheSportsDB
    const url = `${SPORTSDB_API_BASE}/lookupleague.php?id=${leagueId}`;
    const response = await fetch(url);
    const data: any = await response.json();
    
    if (!data?.leagues || data.leagues.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `No league found for ID: ${leagueId}`
            }, null, 2),
          },
        ],
      };
    }
    
    const league = data.leagues[0];
    const badgeUrl = league.strBadge;
    
    if (!badgeUrl) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `No badge available for league: ${leagueName}`,
              league
            }, null, 2),
          },
        ],
      };
    }
    
    // Ensure leagues directory exists
    await fs.ensureDir(LEAGUES_DIR);
    
    // Generate filename if not provided
    const safeLeagueName = leagueName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const badgeFilename = filename || `${safeLeagueName}-league-badge.png`;
    const badgePath = path.join(LEAGUES_DIR, badgeFilename);
    
    // Download the badge image
    const imageResponse = await fetch(badgeUrl);
    const imageBuffer = await imageResponse.buffer();
    
    // Save the image
    await fs.writeFile(badgePath, imageBuffer);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            localPath: badgePath,
            filename: badgeFilename,
            leagueName,
            leagueId,
            badgeUrl
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download league badge: ${errorMessage}`);
  }
}

// Badge download and mapping functions
async function downloadClubBadge(clubName: string, filename?: string) {
  try {
    // Search for the club in TheSportsDB
    const url = `${SPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(clubName)}`;
    const response = await fetch(url);
    const data: any = await response.json();
    
    if (!data?.teams || data.teams.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `No club found for: ${clubName}`
            }, null, 2),
          },
        ],
      };
    }
    
    const club = data.teams[0];
    const badgeUrl = club.strTeamBadge;
    
    if (!badgeUrl) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `No badge available for: ${clubName}`,
              club
            }, null, 2),
          },
        ],
      };
    }
    
    // Ensure badges directory exists
    await fs.ensureDir(BADGES_DIR);
    
    // Generate filename if not provided
    const safeClubName = clubName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const badgeFilename = filename || `${safeClubName}-badge.png`;
    const badgePath = path.join(BADGES_DIR, badgeFilename);
    
    // Download the badge image
    const imageResponse = await fetch(badgeUrl);
    const imageBuffer = await imageResponse.buffer();
    
    // Save the image
    await fs.writeFile(badgePath, imageBuffer);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Badge downloaded successfully for: ${clubName}`,
            club,
            badgeUrl,
            localPath: badgePath,
            filename: badgeFilename
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to download club badge: ${errorMessage}`);
  }
}

async function mapEntityToBadgeFile(entityId: string, badgePath: string, clubName?: string) {
  const session = driver.session();
  
  try {
    // Check if the file exists
    if (!await fs.pathExists(badgePath)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Badge file not found: ${badgePath}`
            }, null, 2),
          },
        ],
      };
    }
    
    // Update the entity with badge path
    const result = await session.run(
      `
      MATCH (e {id: $entityId})
      SET e.badge_path = $badgePath,
          e.badge_club_name = $clubName,
          e.badge_updated_at = datetime()
      RETURN e
      `,
      { entityId, badgePath, clubName }
    );
    
    if (result.records.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Entity not found: ${entityId}`
            }, null, 2),
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Entity mapped to badge file successfully`,
            entityId,
            badgePath,
            clubName,
            entity: result.records[0].get('e').properties
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to map entity to badge file: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function mapLeagueToBadgeFile(entityId: string, badgePath: string, leagueName: string) {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH (e:Entity {id: $entityId})
       SET e.leagueBadgePath = $badgePath,
           e.leagueBadgeFilename = $filename,
           e.hasLeagueBadge = true,
           e.leagueBadgeUpdatedAt = datetime()
       RETURN e`,
      {
        entityId,
        badgePath,
        filename: path.basename(badgePath)
      }
    );
    
    if (result.records.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Entity not found: ${entityId}`
            }, null, 2),
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `League entity mapped to badge file successfully`,
            entityId,
            badgePath,
            leagueName,
            entity: result.records[0].get('e').properties
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to map league entity to badge file: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function bulkDownloadClubBadges(entities: Array<{id: string, name: string}>, dryRun: boolean = false) {
  const results = [];
  
  for (const entity of entities) {
    try {
      if (dryRun) {
        // Just search for the club
        const url = `${SPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(entity.name)}`;
        const response = await fetch(url);
        const data: any = await response.json();
        
        const hasBadge = data?.teams?.[0]?.strTeamBadge ? true : false;
        
        results.push({
          entityId: entity.id,
          entityName: entity.name,
          success: hasBadge,
          club: data?.teams?.[0] || null,
          message: hasBadge ? "Would download badge" : "No badge available"
        });
      } else {
        // Download and map
        const downloadResult = await downloadClubBadge(entity.name);
        const downloadData = JSON.parse(downloadResult.content[0].text);
        
        if (downloadData.success) {
          const mapResult = await mapEntityToBadgeFile(
            entity.id,
            downloadData.localPath,
            entity.name
          );
          const mapData = JSON.parse(mapResult.content[0].text);
          
          results.push({
            entityId: entity.id,
            entityName: entity.name,
            downloadSuccess: downloadData.success,
            mapSuccess: mapData.success,
            localPath: downloadData.localPath,
            club: downloadData.club,
            downloadMessage: downloadData.message,
            mapMessage: mapData.message
          });
        } else {
          results.push({
            entityId: entity.id,
            entityName: entity.name,
            success: false,
            error: downloadData.message
          });
        }
      }
    } catch (error) {
      results.push({
        entityId: entity.id,
        entityName: entity.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          summary: {
            total: entities.length,
            successful: results.filter(r => r.success !== false).length,
            failed: results.filter(r => r.success === false).length,
            dryRun
          },
          results
        }, null, 2),
      },
    ],
  };
}

async function bulkDownloadLeagueBadges(entities: Array<{id: string, name: string, leagueId?: string}>, dryRun: boolean = false) {
  const results = [];
  
  for (const entity of entities) {
    try {
      if (dryRun) {
        // For leagues, we need the league ID to get the badge
        if (!entity.leagueId) {
          results.push({
            entityId: entity.id,
            entityName: entity.name,
            success: false,
            message: "No league ID provided - cannot download badge"
          });
          continue;
        }
        
        // Just check if league exists and has badge
        const url = `${SPORTSDB_API_BASE}/lookupleague.php?id=${entity.leagueId}`;
        const response = await fetch(url);
        const data: any = await response.json();
        
        const hasBadge = data?.leagues?.[0]?.strBadge ? true : false;
        
        results.push({
          entityId: entity.id,
          entityName: entity.name,
          success: hasBadge,
          league: data?.leagues?.[0] || null,
          message: hasBadge ? "Would download league badge" : "No league badge available"
        });
      } else {
        if (!entity.leagueId) {
          results.push({
            entityId: entity.id,
            entityName: entity.name,
            success: false,
            error: "No league ID provided"
          });
          continue;
        }
        
        // Download and map
        const downloadResult = await downloadLeagueBadge(entity.leagueId, entity.name);
        const downloadData = JSON.parse(downloadResult.content[0].text);
        
        if (downloadData.success) {
          const mapResult = await mapLeagueToBadgeFile(
            entity.id,
            downloadData.localPath,
            entity.name
          );
          const mapData = JSON.parse(mapResult.content[0].text);
          
          results.push({
            entityId: entity.id,
            entityName: entity.name,
            downloadSuccess: downloadData.success,
            mapSuccess: mapData.success,
            localPath: downloadData.localPath,
            leagueId: entity.leagueId,
            message: "League badge downloaded and mapped successfully"
          });
        } else {
          results.push({
            entityId: entity.id,
            entityName: entity.name,
            success: false,
            error: downloadData.message
          });
        }
      }
    } catch (error) {
      results.push({
        entityId: entity.id,
        entityName: entity.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          summary: {
            total: entities.length,
            successful: results.filter(r => r.success !== false).length,
            failed: results.filter(r => r.success === false).length,
            dryRun
          },
          results
        }, null, 2),
      },
    ],
  };
}

async function scanClubEntities(entityType?: string, limit: number = 100) {
  const session = driver.session();
  
  try {
    let query = 'MATCH (e)';
    const params: any = {};
    
    if (entityType) {
      // Try different label patterns
      query += ' WHERE e:$entityType OR e:Club OR e:Team OR e:Organization';
      params.entityType = entityType;
    } else {
      query += ' WHERE e:Club OR e:Team OR e:Organization';
    }
    
    query += ` RETURN e.id as id, e.name as name, labels(e) as labels LIMIT ${limit}`;
    
    const result = await session.run(query, params);
    
    const entities = result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      labels: record.get('labels')
    }));
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            summary: {
              total: entities.length,
              entityType: entityType || 'Club/Team/Organization',
              limit
            },
            entities
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to scan club entities: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function scanLeagueEntities(limit: number = 100) {
  const session = driver.session();
  
  try {
    // Query to find all league entities - adjust the labels/properties as needed
    const result = await session.run(
      `MATCH (e:Entity) 
       WHERE e.type = 'league' OR e:League OR e.leagueId IS NOT NULL OR e.name CONTAINS 'League'
       RETURN e.id as id, e.name as name, e.leagueId as leagueId
       LIMIT $limit`,
      { limit }
    );
    
    const entities = result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      leagueId: record.get('leagueId')
    }));
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            count: entities.length,
            summary: {
              total: entities.length,
              entityType: 'League',
              limit
            },
            entities
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to scan league entities: ${errorMessage}`);
  } finally {
    await session.close();
  }
}

async function autoDownloadAllClubBadges(dryRun: boolean = false) {
  try {
    // First get all club entities from Neo4j
    const clubEntitiesResult = await scanClubEntities('Club', 5000);
    const clubData = JSON.parse(clubEntitiesResult.content[0].text);
    
    if (!clubData.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: "Failed to retrieve club entities",
              error: clubData.error
            }, null, 2),
          },
        ],
      };
    }
    
    // Then download badges for all clubs
    const downloadResults = await bulkDownloadClubBadges(clubData.entities, dryRun);
    const downloadData = JSON.parse(downloadResults.content[0].text);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Processed ${clubData.entities.length} club entities`,
            clubsFound: clubData.count,
            downloadResults: downloadData
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2),
        },
      ],
    };
  }
}

async function autoDownloadAllLeagueBadges(dryRun: boolean = false) {
  try {
    // First get all league entities from Neo4j
    const leagueEntitiesResult = await scanLeagueEntities(500);
    const leagueData = JSON.parse(leagueEntitiesResult.content[0].text);
    
    if (!leagueData.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: "Failed to retrieve league entities",
              error: leagueData.error
            }, null, 2),
          },
        ],
      };
    }
    
    // Filter out entities without leagueId (they need manual intervention)
    const validLeagues = leagueData.entities.filter((entity: any) => entity.leagueId);
    const skippedLeagues = leagueData.entities.filter((entity: any) => !entity.leagueId);
    
    // Then download badges for all valid leagues
    const downloadResults = await bulkDownloadLeagueBadges(validLeagues, dryRun);
    const downloadData = JSON.parse(downloadResults.content[0].text);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Processed ${validLeagues.length} league entities (${skippedLeagues.length} skipped due to missing leagueId)`,
            leaguesFound: leagueData.count,
            validLeagues: validLeagues.length,
            skippedLeagues: skippedLeagues.length,
            skippedLeagueNames: skippedLeagues.map((l: any) => l.name),
            downloadResults: downloadData
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2),
        },
      ],
    };
  }
}

async function scanAndDownloadMissingBadges(dryRun: boolean = false) {
  const session = driver.session();
  
  try {
    // Scan for entities that don't have badges yet
    const result = await session.run(
      `MATCH (e:Entity)
       WHERE (e.type = 'club' OR e:Club OR e:Team OR e:Organization) 
         AND (e.badgePath IS NULL OR e.badgePath = '')
         AND e.name IS NOT NULL
       RETURN e.id as id, e.name as name, 'club' as entityType
       
       UNION ALL
       
       MATCH (e:Entity) 
       WHERE (e.type = 'league' OR e:League) 
         AND (e.leagueBadgePath IS NULL OR e.leagueBadgePath = '')
         AND (e.name IS NOT NULL)
         AND e.leagueId IS NOT NULL
       RETURN e.id as id, e.name as name, e.leagueId as leagueId, 'league' as entityType
       
       LIMIT 10000`
    );
    
    const entities = result.records.map(record => {
      const data: any = {
        id: record.get('id'),
        name: record.get('name'),
        entityType: record.get('entityType')
      };
      
      if (record.has('leagueId')) {
        data.leagueId = record.get('leagueId');
      }
      
      return data;
    });
    
    const clubEntities = entities.filter(e => e.entityType === 'club');
    const leagueEntities = entities.filter(e => e.entityType === 'league');
    
    let clubResults = { summary: { total: 0, successful: 0, failed: 0 }, results: [] };
    let leagueResults = { summary: { total: 0, successful: 0, failed: 0 }, results: [] };
    
    // Process clubs
    if (clubEntities.length > 0) {
      const clubDownloadResult = await bulkDownloadClubBadges(clubEntities, dryRun);
      clubResults = JSON.parse(clubDownloadResult.content[0].text);
    }
    
    // Process leagues  
    if (leagueEntities.length > 0) {
      const leagueDownloadResult = await bulkDownloadLeagueBadges(leagueEntities, dryRun);
      leagueResults = JSON.parse(leagueDownloadResult.content[0].text);
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Scanned and processed ${entities.length} entities without badges`,
            summary: {
              totalEntities: entities.length,
              clubsFound: clubEntities.length,
              leaguesFound: leagueEntities.length,
              dryRun
            },
            clubResults,
            leagueResults,
            skippedLeagues: entities.filter(e => e.entityType === 'league' && !e.leagueId).map(e => e.name)
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2),
        },
      ],
    };
  } finally {
    await session.close();
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Artificial Intelligence MCP server started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});