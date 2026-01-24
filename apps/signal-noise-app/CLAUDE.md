# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Signal Noise App** is an AI-powered sports intelligence and RFP (Request for Proposal) analysis platform. It combines:
- **Sports Entity Database**: Browse/search clubs, leagues, venues, staff using FalkorDB (Neo4j-compatible graph database) with 3,400+ entities
- **RFP Intelligence**: Monitor LinkedIn for procurement opportunities using AI agents with temporal intelligence
- **AI Chat Interface**: CopilotKit-powered conversational AI with MCP tool integration
- **Temporal Intelligence**: Track entity timelines, analyze patterns, and close the feedback loop on RFP outcomes
- **GraphRAG Narrative Building**: Convert temporal episodes into Claude-friendly narratives with token-bounded compression

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server on port 3005
npm run build            # Production build
npm run start            # Start production server on port 4328
npm run lint             # Run ESLint

# Testing
npm run test             # Run test suite
npm run test:claude-agent # Test Claude Agent integration
npm run test:agui-integration # Test AGUI interface
npm run test:api-endpoints  # Test API endpoints
npm run test:mcp         # Test MCP server integrations

# Database Sync
npm run sync:once        # Run database sync once
npm run sync:monitor     # Monitor database sync status
npm run sync:health      # Check database sync health
```

## Architecture

### Frontend (Next.js 14)
- **Pages**: File-based routing in `src/app/`
- **Components**: Reusable UI in `src/components/` (Radix UI + shadcn/ui)
- **Styling**: Tailwind CSS with Football Manager-inspired dark theme
- **State Management**: SWR for server state, React Context for client state

### Data Layer
- **FalkorDB**: Primary graph database (Neo4j-compatible) with 3,400+ sports entities
- **Neo4j Aura**: Cloud backup and some legacy queries
- **Supabase**: Cache layer with 22 production tables for performance
- **Graphiti Service** (`backend/graphiti_service.py`): Temporal knowledge graph for RFP episode tracking
- **MCPClientBus** (`src/lib/mcp/MCPClientBus.ts`): Unified interface for all MCP tools
- **Narrative Builder** (`backend/narrative_builder.py`): Converts temporal episodes to token-bounded narratives

### AI & Agent System
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): Core AI orchestration
- **CopilotKit** (`@copilotkit/*`): AI chat interface integrated throughout the app
- **MCP Tools**: Model Context Protocol servers for specialized capabilities

### MCP Servers (configured in `mcp-config.json`)
| Server | Purpose | Environment Variables |
|--------|---------|----------------------|
| neo4j-mcp | Knowledge graph queries via Neo4j Aura | NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE |
| falkordb-mcp | Native FalkorDB graph database (backend/falkordb_mcp_server_fastmcp.py) | FALKORDB_URI, FALKORDB_USER, FALKORDB_PASSWORD |
| brightData | Web scraping (LinkedIn, Crunchbase, Google News) | BRIGHTDATA_API_TOKEN |
| supabase | Database operations (22 production tables) | SUPABASE_ACCESS_TOKEN |
| perplexity-mcp | Market intelligence research | PERPLEXITY_API_KEY |
| byterover-mcp | Email intelligence | BYTEROVER_API_KEY |
| glm-4.5v | Visual reasoning for images (Z.AI) | ZAI_API_KEY |
| headless-verifier | RFP verification with Puppeteer | PUPPETEER_SKIP_DOWNLOAD |
| temporal-intelligence | Entity timeline tracking, RFP patterns, temporal fit scoring (backend/temporal_mcp_server.py) | FASTAPI_URL, SUPABASE_URL, SUPABASE_ANON_KEY |

### Key Integration Points

**CopilotKit Integration**:
- Provider in `src/app/layout.tsx`
- API route at `src/app/api/copilotkit/route.ts`
- Used extensively (1000+ references) for AI chat throughout the app

**Entity System**:
- Neo4j queries via `src/lib/neo4j.ts`
- Entity browsing at `src/app/entity-browser/`
- Cache service at `src/services/EntityCacheService.ts`

**RFP Detection & Temporal Intelligence**:
- BrightData webhooks for LinkedIn monitoring
- AI-powered analysis using Claude Agent SDK
- Temporal episode tracking via Graphiti service (`backend/graphiti_service.py`)
- Narrative builder compresses episodes into Claude-friendly narratives (`backend/narrative_builder.py`)
- Temporal MCP server provides timeline analysis tools (`backend/temporal_mcp_server.py`)
- Detection scripts in root directory (run-rfp-*.sh)

## Environment Variables

Required for development (see `.env.example`):

```bash
# Neo4j Aura (Cloud)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j

# FalkorDB (Local Graph Database)
FALKORDB_URI=bolt://localhost:7687
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-falkordb-password
FALKORDB_DATABASE=sports_intelligence

# AI Services
ANTHROPIC_API_KEY=your-claude-api-key
# OR use custom API via Z.AI:
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=your-zai-token
BRIGHTDATA_API_TOKEN=your-brightdata-token
PERPLEXITY_API_KEY=your-perplexity-key
ZAI_API_KEY=your-zai-api-key
BYTEROVER_API_KEY=your-byterover-api-key

# LiveKit (Voice Intelligence)
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_HOST=wss://your-livekit-instance.livekit.cloud
NEXT_PUBLIC_LIVEKIT_HOST=wss://your-livekit-instance.livekit.cloud

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_ACCESS_TOKEN=your-supabase-access-token

# AWS S3 (for badge storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=your-badge-bucket

# Better Auth
BETTER_AUTH_SECRET=your-auth-secret
BETTER_AUTH_URL=http://localhost:3005
```

## Important Implementation Notes

### Build Configuration
- `next.config.js` has `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` for ESLint - this is intentional for rapid development
- Some API routes are rewritten to `/api/placeholder` during build to avoid timeouts

### Active Systems
- **FalkorDB**: Core graph database with native Python client
- **Neo4j Aura**: Cloud backup (593+ references in codebase)
- **CopilotKit**: Primary AI chat interface (1000+ references)
- **Claude Agent SDK**: AI agent orchestration with MCP tools (60+ references)
- **Better Auth**: Authentication system (20+ references)
- **Graphiti**: Temporal knowledge graph for RFP episodes
- **Temporal Intelligence MCP**: Entity timeline tracking and pattern analysis

### Placeholder/Minimal Systems
- **Mastra**: Basic setup only (@ag-ui/mastra, @mastra/*), minimal active usage
- **Qdrant**: Vector database code exists but marked TODO
- **Redis**: Installed but not actively used in core workflows

### Badge System
- Badges stored in S3 or served from `r2.thesportsdb.com`
- Badge service at `src/services/badge-service.ts`
- Component at `src/components/badge/EntityBadge.tsx`

## Common Patterns

### Adding a New Page
Create files in `src/app/` following Next.js 14 App Router conventions:
```
src/app/your-page/
  ├── page.tsx          # Main page component
  ├── layout.tsx        # Optional layout wrapper
  └── client-page.tsx   # Use 'use client' for interactive components
```

### Creating an API Route
```
src/app/api/your-endpoint/route.ts
```
Export GET, POST, PUT, DELETE functions as named exports.

### Using SWR for Data Fetching
```typescript
import useSWR from 'swr';
const { data, error, isLoading } = useSWR('/api/entities', fetcher);
```

### CopilotKit Integration
Wrap components with `<CopilotKit>` provider and use `useCopilotChat()` hook for chat functionality.
- Custom API route at `src/app/api/copilotkit/route.ts` (bypasses CopilotRuntime for advanced MCP integration)
- Integrates with Claude Agent SDK and MCP tools for enhanced capabilities

### Backend Python Services
The `backend/` directory contains FastAPI services and MCP servers:
- **falkordb_mcp_server_fastmcp.py**: Native FalkorDB MCP server using FastMCP
- **temporal_mcp_server.py**: Temporal intelligence tools (timelines, patterns, fit analysis)
- **graphiti_service.py**: GraphRAG-based temporal knowledge graph service
- **narrative_builder.py**: Converts episodes to token-bounded narratives for Claude

Start backend services:
```bash
# Start FastAPI backend
cd backend && python run_server.py

# Run MCP servers (configured in mcp-config.json)
python backend/falkordb_mcp_server_fastmcp.py
python backend/temporal_mcp_server.py
```

## Testing

- Test files are in `tests/` directory with `.mjs` extension
- Run individual test: `node tests/test-name.mjs`
- MCP integration test: `npm run test:mcp`

## Backend Python Development

```bash
# Install Python dependencies
cd backend
pip install falkordb fastapi uvicorn mcp python-dotenv

# Run FastAPI backend
python run_server.py

# Test MCP servers
python falkordb_mcp_server_fastmcp.py
python temporal_mcp_server.py
```

## Deployment

- Production runs on port 4328 (`npm run start`)
- EC2/VPS deployment scripts available in root directory:
  - `deploy-to-production.sh` - Full production deployment
  - `deploy-hetzner.sh` - Hetzner cloud deployment
  - `docker-deploy.sh` - Docker-based deployment
  - `quick-deploy.sh` - Quick deployment script
- MCP server management:
  - `mcp-servers/start-mcp-servers.sh` - Start all MCP servers
  - `mcp-servers/stop-mcp-servers.sh` - Stop all MCP servers
- Vercel deployment possible (frontend-only mode)

## Key Integration Points

**Temporal Intelligence Flow**:
1. RFP detected via BrightData → recorded as episode in Graphiti
2. Entity timeline built from historical episodes
3. Narrative builder compresses episodes into Claude-friendly format
4. Temporal MCP tools provide timeline analysis and pattern recognition
5. Outcomes recorded to close feedback loop

**MCP Tool Integration**:
- All MCP tools accessible through `MCPClientBus` in frontend
- Python backend MCP servers use stdio transport
- Tools exposed to Claude Agent SDK via CopilotKit API route
- FalkorDB queries go through native MCP server for performance

## Recent Enhancements (January 2026)

### CopilotKit Integration Improvements
- Refactored CopilotKit API route (`src/app/api/copilotkit/route.ts`) for better streaming and error handling
- Enhanced entity pages with temporal intelligence tools
- Improved chat components for better MCP tool visibility

### Temporal Intelligence System
- **Graphiti Service**: Full temporal knowledge graph implementation with FalkorDB/Graphiti
- **Temporal MCP Server**: 8 tools for timeline analysis, pattern detection, and temporal fit scoring
- **Narrative Builder**: Token-bounded compression of episodes for efficient Claude context

### MCP Server Updates
- **FalkorDB FastMCP Server**: Native Python implementation using FastMCP framework
- **Temporal Intelligence MCP**: Complete temporal analysis toolkit
- Removed unused MCP servers from config (cleaned up glm-4.5v, headless-verifier)

## Common Development Tasks

### Adding a New MCP Tool
1. Add tool to appropriate Python MCP server in `backend/` (e.g., `temporal_mcp_server.py`)
2. Register tool in `mcp-config.json` if it's a new server
3. Tool becomes available through `MCPClientBus` automatically
4. Use in Claude Agent SDK via `query()` function with tools array

### Working with Temporal Episodes
```python
from backend.graphiti_service import GraphitiService
from backend.narrative_builder import build_narrative_from_episodes

service = await GraphitiService().initialize()
episodes = await service.get_entity_timeline(entity_id="arsenal")
narrative = build_narrative_from_episodes(episodes, max_tokens=2000)
```

### Entity Enrichment Pipeline
1. Entity detected in LinkedIn → BrightData scraper collects data
2. Data enriched via Perplexity market research
3. Entity stored in FalkorDB with relationships
4. Timeline updated with new episode
5. Narrative builder generates summary for AI agents

## Architecture Notes

### Database Strategy
- **FalkorDB (Local)**: Primary graph DB for entities and relationships, accessed via native Python MCP server
- **Neo4j Aura (Cloud)**: Backup and some legacy queries (NEO4J_* env vars)
- **Supabase**: Cache layer with 22 tables for performance optimization
- Legacy code may reference Neo4j but new development should use FalkorDB native client

### MCP Architecture
- Frontend uses `@modelcontextprotocol/sdk` with stdio transport
- Python MCP servers use FastMCP framework for rapid tool development
- All MCP servers configured in `mcp-config.json` with environment variable substitution
- `MCPClientBus` manages connections and provides unified tool interface

### AI Agent Orchestration
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) for core AI processing
- CopilotKit provides frontend chat interface and state management
- Custom streaming implementation bypasses CopilotRuntime for advanced MCP integration
- Temporal intelligence tools injected via MCP for context-aware RFP analysis

### Build Configuration Notes
- `next.config.js` has `ignoreBuildErrors: true` for ESLint - intentional for rapid development
- Some API routes rewritten to `/api/placeholder` during build to avoid timeouts:
  - `/api/production-pipeline-analytics/*`
  - `/api/rfp-backtesting/*`
  - `/api/supabase-query/*`
- Image optimization configured for S3 and TheSportsDB badge sources
