# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Signal Noise App** is an AI-powered sports intelligence and RFP (Request for Proposal) analysis platform. It combines:
- **Sports Entity Database**: Browse/search clubs, leagues, venues, staff using a Neo4j knowledge graph
- **RFP Intelligence**: Monitor LinkedIn for procurement opportunities using AI agents
- **AI Chat Interface**: CopilotKit-powered conversational AI with MCP tool integration

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
- **Neo4j**: Primary knowledge graph database for entities and relationships (2,210+ entities)
- **Supabase**: Cache layer with 22 production tables for performance
- **MCPClientBus** (`src/lib/mcp/MCPClientBus.ts`): Unified interface for all MCP tools

### AI & Agent System
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): Core AI orchestration
- **CopilotKit** (`@copilotkit/*`): AI chat interface integrated throughout the app
- **MCP Tools**: Model Context Protocol servers for specialized capabilities

### MCP Servers (configured in `mcp-config.json`)
| Server | Purpose | Environment Variables |
|--------|---------|----------------------|
| neo4j-mcp | Knowledge graph queries | NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD |
| brightData | Web scraping (LinkedIn, Crunchbase, Google News) | BRIGHTDATA_API_TOKEN |
| supabase | Database operations | SUPABASE_ACCESS_TOKEN |
| perplexity-mcp | Market intelligence research | PERPLEXITY_API_KEY |
| byterover-mcp | Email intelligence | BYTEROVER_API_KEY |

### Key Integration Points

**CopilotKit Integration**:
- Provider in `src/app/layout.tsx`
- API route at `src/app/api/copilotkit/route.ts`
- Used extensively (1000+ references) for AI chat throughout the app

**Entity System**:
- Neo4j queries via `src/lib/neo4j.ts`
- Entity browsing at `src/app/entity-browser/`
- Cache service at `src/services/EntityCacheService.ts`

**RFP Detection**:
- BrightData webhooks for LinkedIn monitoring
- AI-powered analysis using Claude Agent SDK
- Detection scripts in root directory (run-rfp-*.sh)

## Environment Variables

Required for development (see `.env.example`):

```bash
# Neo4j Knowledge Graph
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# AI Services
ANTHROPIC_API_KEY=your-claude-api-key
BRIGHTDATA_API_TOKEN=your-brightdata-token
PERPLEXITY_API_KEY=your-perplexity-key

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
- **Neo4j**: Core database with 593+ references in the codebase
- **CopilotKit**: Primary AI chat interface (1000+ references)
- **Claude Agent SDK**: AI agent orchestration (60+ references)
- **Better Auth**: Authentication system (20+ references)

### Placeholder/Unused Systems
- **Mastra**: Basic setup only, minimal active usage
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

## Testing

- Test files are in `tests/` directory with `.mjs` extension
- Run individual test: `node tests/test-name.mjs`
- MCP integration test: `npm run test:mcp`

## Deployment

- Production runs on port 4328 (`npm run start`)
- EC2/VPS deployment scripts available in root directory
- Vercel deployment possible (frontend-only mode)
