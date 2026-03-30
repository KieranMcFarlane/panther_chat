# MCP Integration Setup Guide

This guide shows how to integrate your MCP servers (Neo4j, BrightData, Perplexity) with the CopilotKit sports intelligence platform using the **Claude Agent SDK**.

## Architecture Overview

```
[CopilotKit UI] → [Claude Agent SDK] → [MCP Servers]
                                   ↓
                            [Neo4j, BrightData, Perplexity]
```

- **CopilotKit**: Provides the chat UI interface
- **Claude Agent SDK**: Handles AI reasoning and tool execution
- **MCP Servers**: Provide access to Neo4j, BrightData, and Perplexity tools

## Current Implementation (Recommended)

The application now uses the **Claude Agent SDK** directly with MCP servers:

### 1. MCP Configuration

The MCP servers are configured in `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "neo4j-mcp": {
      "command": "npx",
      "args": ["-y", "@alanse/mcp-neo4j-server"],
      "env": {
        "NEO4J_URI": "neo4j+s://cce1f84b.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0",
        "NEO4J_DATABASE": "neo4j"
      }
    },
    "brightData": {
      "command": "npx",
      "args": ["-y", "@brightdata/mcp"],
      "env": {
        "API_TOKEN": "YOUR_BRIGHTDATA_API_TOKEN_HERE",
        "PRO_MODE": "true"
      }
    },
    "perplexity-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-perplexity-search"],
      "env": {
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE"
      }
    }
  }
}
```

### 2. Claude Agent SDK Integration

The backend uses the Claude Agent SDK to interface with MCP servers:

```typescript
// src/app/api/copilotkit/route.ts
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: userMessage,
  options: {
    mcpServers: {
      // MCP server configurations
    },
    allowedTools: [
      "mcp__neo4j-mcp__execute_query",
      "mcp__brightData__search",
      "mcp__perplexity-mcp__search"
    ]
  }
})) {
  // Handle responses and tool results
}
```

### 3. Install Dependencies

```bash
npm install @anthropic-ai/claude-agent-sdk @copilotkit/react-core @copilotkit/react-ui
```

## Option 2: Claude MCP Integration

For full MCP integration with Claude, add to your Claude MCP configuration:

```json
{
  "mcpServers": {
    "neo4j-mcp": {
      "command": "npx",
      "args": ["-y", "@alanse/mcp-neo4j-server"],
      "env": {
        "NEO4J_URI": "neo4j+s://cce1f84b.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j", 
        "NEO4J_PASSWORD": "llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0",
        "NEO4J_DATABASE": "neo4j",
        "AURA_INSTANCEID": "cce1f84b",
        "AURA_INSTANCENAME": "Instance01"
      }
    },
    "brightdata": {
      "command": "npx",
      "args": ["-y", "@brightdata/mcp"],
      "env": {
        "API_TOKEN": "YOUR_BRIGHTDATA_API_TOKEN_HERE",
        "PRO_MODE": "true"
      }
    },
    "perplexity-mcp": {
      "command": "npx", 
      "args": ["-y", "mcp-perplexity-search"],
      "env": {
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE"
      }
    }
  }
}
```

## Testing the Integration

Once configured, you can test the MCP integration by asking the AI:

1. **Neo4j Search:**
   - "Search for Premier League clubs in the database"
   - "Find information about Manchester United"
   - "List all players from England"

2. **BrightData Search:**
   - "Search for recent news about Liverpool FC"
   - "Find information about Premier League transfers"

3. **Perplexity Search:**
   - "Get AI analysis of current Premier League standings"
   - "Research sports business opportunities"

## Current Status

✅ **Completed:**
- CopilotKit Actions framework set up
- Mock API routes for all MCP tools
- Integration with existing chat interface
- Tool descriptions and parameters defined

🔄 **Next Steps:**
- Replace mock implementations with real MCP server calls
- Run actual MCP servers with your credentials
- Test end-to-end functionality

The platform now has the foundation to use your MCP tools for enhanced sports intelligence analysis!