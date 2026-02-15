# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Signal Noise App** is an AI-powered sports intelligence and RFP (Request for Proposal) analysis platform. It combines:
- **Sports Entity Database**: Browse/search clubs, leagues, venues, staff using FalkorDB (Neo4j-compatible graph database) with 3,400+ entities
- **Hypothesis-Driven Discovery**: EIG-based hypothesis prioritization for intelligent entity exploration with deterministic cost control
- **Ralph Loop**: Batch-enforced signal validation with 3-pass governance and confidence scoring
- **Template System**: Automated discovery, enrichment, expansion, and validation of procurement patterns
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
| brightData | **DEPRECATED** - Now uses BrightData SDK directly (see below) | BRIGHTDATA_API_TOKEN |
| supabase | Database operations (22 production tables) | SUPABASE_ACCESS_TOKEN |
| perplexity-mcp | Market intelligence research | PERPLEXITY_API_KEY |
| byterover-mcp | Email intelligence | BYTEROVER_API_KEY |
| glm-4.5v | Visual reasoning for images (Z.AI) | ZAI_API_KEY |
| headless-verifier | RFP verification with Puppeteer | PUPPETEER_SKIP_DOWNLOAD |
| temporal-intelligence | Entity timeline tracking, RFP patterns, temporal fit scoring (backend/temporal_mcp_server.py) | FASTAPI_URL, SUPABASE_URL, SUPABASE_ANON_KEY |

**Note**: The `brightData` MCP server entry is deprecated. We now use the **BrightData SDK** (official Python package) directly for all web scraping. See "BrightData Web Scraping" section below.

### BrightData Web Scraping (SDK, NOT MCP)

**CRITICAL**: All BrightData web scraping uses the official Python SDK package, NOT MCP servers.

**File**: `backend/brightdata_sdk_client.py`

**Primary Discovery Methods**:

| Method | Returns | Use Case |
|--------|---------|----------|
| `search_engine(query, engine)` | Search results with position, title, URL, snippet | Domain discovery |
| `scrape_as_markdown(url)` | Clean markdown content | Official site scraping |
| `scrape_batch(urls)` | Multiple URLs scraped concurrently | Batch processing |

**Usage Examples**:

```python
from backend.brightdata_sdk_client import BrightDataSDKClient

# Create SDK client (NOT MCP)
brightdata = BrightDataSDKClient()

# Example 1: Search for domains
results = await brightdata.search_engine(
    query='"Arsenal FC" official website',
    engine='google',
    num_results=10
)
# Returns: {status: 'success', results: [{position, title, url, snippet}, ...]}

# Example 2: Scrape content
content = await brightdata.scrape_as_markdown('https://arsenal.com')
# Returns: {status: 'success', content: 'markdown text', ...}

# Example 3: Batch scraping
urls = ['https://site1.com', 'https://site2.com']
results = await brightdata.scrape_batch(urls)
# Returns: {status: 'success', total_urls: 2, successful: 2, results: [...]}

# Example 4: Job board scraping
jobs = await brightdata.scrape_jobs_board(
    entity_name='Arsenal FC',
    keywords=['CRM', 'Digital', 'Data']
)
# Returns: search results for job postings

# Example 5: Press release scraping
press = await brightdata.scrape_press_release(entity_name='Arsenal FC')
# Returns: search results for press releases
```

**Do NOT use MCP tools** for BrightData:
- ❌ `mcp__brightdata__*` (MCP tools)
- ❌ `mcp__brightdata-mcp__*` (MCP tools)
- ❌ Any MCP tool with "brightdata" in the name

**Always use the SDK client**:
- ✅ `BrightDataSDKClient()` class
- ✅ Direct Python methods: `search_engine()`, `scrape_as_markdown()`, `scrape_batch()`
- ✅ Convenience methods: `scrape_jobs_board()`, `scrape_press_release()`

**Benefits**:
- Direct Python integration (no MCP overhead)
- Automatic proxy rotation (handled by SDK)
- Anti-bot protection built-in
- HTTP fallback for reliability (using httpx when SDK unavailable)
- Async/concurrent scraping support
- Pay-per-success pricing model

**Environment Variable**: `BRIGHTDATA_API_TOKEN` (required)

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
- **Hypothesis-Driven Discovery**: EIG-based entity exploration with cost control
- **Ralph Loop**: Signal validation with 3-pass governance
- **Template System**: Discovery, enrichment, expansion, and validation of patterns

### Placeholder/Minimal Systems
- **Mastra**: Basic setup only (@ag-ui/mastra, @mastra/*), minimal active usage
- **Qdrant**: Vector database code exists but marked TODO
- **Redis**: Installed but not actively used in core workflows

### Badge System
- Badges stored in S3 or served from `r2.thesportsdb.com`
- Badge service at `src/services/badge-service.ts`
- Component at `src/components/badge/EntityBadge.tsx`

## Decision Types (Internal vs External)

### Internal Development (Code-Level)

The Ralph Loop uses these decision types in the codebase:

- **ACCEPT**: Strong evidence of future procurement action (+0.06 delta)
- **WEAK_ACCEPT**: Capability present but procurement intent unclear (+0.02 delta)
- **REJECT**: No evidence or evidence contradicts hypothesis (0.00 delta)
- **NO_PROGRESS**: Evidence exists but adds no new predictive information (0.00 delta)
- **SATURATED**: Category exhausted, no new information expected (0.00 delta)

### External Communication (Sales/Customers)

For APIs, documentation, and customer communication, we use different names:

- **Procurement Signal** (same as ACCEPT): Strong procurement intent detected 🎯
- **Capability Signal** (same as WEAK_ACCEPT): Digital capability detected 💡
- **No Signal** (REJECT/NO_PROGRESS): No evidence detected ❌
- **Saturated** (SATURATED): Category exhausted 🔄

### Why the Difference?

"Weak Accept" sounds negative to customers. "Capability Signal" accurately reflects that the entity has digital maturity without implying procurement intent.

**Key distinction**:
- **Capability Signal** = Has the technology
- **Procurement Signal** = Buying the technology

Sales team uses this distinction to prioritize:
- **Procurement Signal** → Immediate outreach (high probability of sale)
- **Capability Signal** → Monitor/watchlist (may purchase in future)

### API Endpoints

**Discovery & Validation**:
- `/api/validate-exploration` (port 8001) - Ralph Loop validation for exploration governance
- `/api/ralph/confidence-bands` - Get band definitions with pricing
- `/api/ralph/decision-mapping` - Get internal → external name mapping

**Entity & Dossier**:
- `/api/dossier` - Generate entity dossiers with temporal intelligence
- `/api/entities` - Browse/search entity database

**Temporal Intelligence**:
- `/api/graphiti/*` - Graphiti temporal knowledge graph operations

**Batch Processing**:
- `/api/batch-process` - Batch entity discovery
- `/api/batch-processor` - Batch signal validation

**Claude Agent**:
- `/api/claude-agent` - Direct Claude Agent SDK integration
- `/api/chat-simple` - Simple chat interface

### Confidence Bands (Pricing)

| Band | Range | Meaning | Price |
|------|-------|---------|-------|
| EXPLORATORY | <0.30 | Research phase | $0 |
| INFORMED | 0.30-0.60 | Monitoring | $500/entity/month |
| CONFIDENT | 0.60-0.80 | Sales engaged | $2,000/entity/month |
| ACTIONABLE | >0.80 + gate | Immediate outreach | $5,000/entity/month |

**Note**: ACTIONABLE requires both high confidence (>0.80) AND the actionable gate (≥2 ACCEPTs across ≥2 categories).

### Confidence Calculation (Hypothesis-Driven Discovery)

Confidence scores are calculated using the **Delta System** in hypothesis-driven discovery:

**Starting Point**: 0.50 (neutral prior)

**Deltas per Decision**:
- **ACCEPT**: +0.06 (strong evidence of procurement intent)
- **WEAK_ACCEPT**: +0.02 (capability present, intent unclear)
- **REJECT**: 0.00 (no evidence or contradicts hypothesis)
- **NO_PROGRESS**: 0.00 (no new information)
- **SATURATED**: 0.00 (category exhausted)

**Formula**:
```
final_confidence = 0.50 + (num_ACCEPT * 0.06) + (num_WEAK_ACCEPT * 0.02)
```

**Bounds**: 0.00 to 1.00 (enforced by system)

**Example Calculation**:
```
Starting: 0.50
3 ACCEPT signals: +0.18 (3 * 0.06)
2 WEAK_ACCEPT signals: +0.04 (2 * 0.02)
Final: 0.72 (CONFIDENT band)
```

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

## Core Discovery & Validation Systems

### Schema Definitions

**File**: `backend/schemas.py`

The system uses a fixed-but-extensible schema for the intelligence layer:

**Entity** (Core node):
```python
@dataclass
class Entity:
    id: str                    # Unique identifier (lowercase, dash-separated)
    type: EntityType           # ORG, PERSON, PRODUCT, INITIATIVE, VENUE
    name: str                  # Display name
    metadata: Dict[str, Any]   # Extensible key-value pairs
```

**Signal** (Intelligence about entity):
```python
@dataclass
class Signal:
    id: str                    # Unique signal ID
    type: SignalType           # RFP_DETECTED, etc.
    subtype: SignalSubtype     # AI_PLATFORM_REWRITE, etc.
    confidence: float          # 0.0-1.0
    first_seen: datetime       # When signal was detected
    entity_id: str             # Associated entity
    evidence: List[Evidence]   # Supporting evidence
```

**Evidence** (Proof for signal):
```python
@dataclass
class Evidence:
    id: str                    # Unique evidence ID
    source: str                # URL or source identifier
    content: str               # Evidence content
    confidence: float          # 0.0-1.0
    collected_at: datetime     # Collection timestamp
```

**Signal Types** (Fixed):
- `RFP_DETECTED` - Request for Proposal detected
- `CRM_ANALYTICS` - CRM/analytics capability detected
- `DIGITAL_TRANSFORMATION` - Digital transformation initiative
- `JOB_POSTING` - Relevant job posting detected
- `PRESS_RELEASE` - Relevant press release

**Entity Types** (Fixed):
- `ORG` - Organization (club, league, company)
- `PERSON` - Individual (staff, executive)
- `PRODUCT` - Product or platform
- `INITIATIVE` - Project or program
- `VENUE` - Physical location

### Hypothesis-Driven Discovery

**File**: `backend/hypothesis_driven_discovery.py`

**Purpose**: Deterministic single-hop entity exploration with EIG-based hypothesis prioritization.

**Key Features**:
- **Single-hop-per-iteration**: No multi-hop, no parallel exploration (cost control)
- **EIG-based ranking**: Prioritizes uncertain + valuable hypotheses
- **Depth-aware stopping**: Enforces 2-3 level depth limit
- **Deterministic cost**: Predictable per-iteration cost

**Decision Types** (Internal → External):
- **ACCEPT** → Procurement Signal: Strong evidence (+0.06 delta)
- **WEAK_ACCEPT** → Capability Signal: Capability present (+0.02 delta)
- **REJECT** → No Signal: No evidence (0.00 delta)
- **NO_PROGRESS** → No Signal: No new info (0.00 delta)
- **SATURATED** → Saturated: Category exhausted (0.00 delta)

**Usage**:
```python
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

discovery = HypothesisDrivenDiscovery(
    claude_client=claude,
    brightdata_client=brightdata
)

result = await discovery.run_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    template_id="tier_1_club_centralized_procurement",
    max_iterations=30,
    max_depth=3
)

# Result contains:
# - final_confidence: float (0-1)
# - validated_signals: List[Signal]
# - total_cost: float (API credits)
# - iteration_count: int
```

**Flow**:
1. Initialize hypothesis set from template
2. For each iteration:
   - Re-score all ACTIVE hypotheses by EIG (Expected Information Gain)
   - Select top hypothesis (runtime enforces single-hop)
   - Choose hop type within strategy rails
   - Execute hop (scrape + evaluate)
   - Update hypothesis state and confidence
   - Check stopping conditions
3. Return final entity assessment

**Related Files**:
- `backend/hypothesis_manager.py`: Hypothesis lifecycle management
- `backend/eig_calculator.py`: Expected Information Gain scoring
- `backend/hypothesis_persistence.py`: FalkorDB storage for hypotheses
- `backend/schemas.py`: Entity/Signal/Evidence schema definitions

### Ralph Loop (Signal Validation)

**File**: `backend/ralph_loop.py`

**Purpose**: Batch-enforced signal validation with governance and confidence scoring.

**Rules**:
- Minimum 3 pieces of evidence per signal
- Confidence > 0.7 for signal creation
- Maximum 3 validation passes per entity
- Only validated signals written to Graphiti

**Validation Passes**:
- **Pass 1**: Rule-based filtering (min evidence, source credibility)
- **Pass 2**: Claude validation (cross-check with existing signals)
- **Pass 3**: Final confirmation (confidence scoring, duplicate detection)

**API Endpoint**: `POST /api/validate-exploration` (runs on port 8001)

**Usage**:
```python
from backend.ralph_loop import RalphLoop
from backend.claude_client import ClaudeClient
from backend.graphiti_service import GraphitiService

claude = ClaudeClient()
graphiti = GraphitiService()
await graphiti.initialize()

ralph = RalphLoop(claude, graphiti)
validated_signals = await ralph.validate_signals(raw_signals, entity_id)

for signal in validated_signals:
    print(f"✅ Validated: {signal.id} (confidence: {signal.confidence})")
```

**Governance Features**:
- Category saturation detection (3 REJECTs)
- Confidence saturation detection (<0.01 gain over 10 iterations)
- Fixed confidence math (no drift)
- Duplicate signal detection

**Related Files**:
- `backend/ralph_loop_server.py`: FastAPI server for validation API
- `backend/ralph_loop_governor.py`: Exploration governance logic
- `backend/ralph_loop_cascade.py`: Cascade validation for multiple entities

### Template System

**Purpose**: Automated discovery, enrichment, expansion, and validation of procurement patterns.

**Components**:

**1. Template Discovery** (`backend/template_discovery.py`)
- Discovers recurring patterns across entities
- Identifies high-confidence procurement signals
- Generates template hypotheses

**2. Template Enrichment** (`backend/template_enrichment_agent.py`)
- Enriches templates with additional evidence
- Cross-references across entities
- Validates pattern consistency

**3. Template Expansion** (`backend/template_expansion_agent.py`)
- Expands templates to new entities
- Generalizes patterns across domains
- Maintains template fidelity

**4. Template Validation** (`backend/template_validation.py`)
- Validates templates against real-world data
- Tests template robustness
- Generates validation reports

**5. Template Bootstrap** (`backend/template_bootstrap.py`)
- Bootstraps templates from production data
- Generates initial template set
- Supports cold-start scenarios

**Usage**:
```python
from backend.template_discovery import TemplateDiscovery
from backend.template_enrichment_agent import TemplateEnrichmentAgent
from backend.template_expansion_agent import TemplateExpansionAgent
from backend.template_validation import TemplateValidator

# Discover patterns
discovery = TemplateDiscovery(claude, brightdata)
templates = await discovery.discover_templates(entity_ids=["arsenal", "chelsea"])

# Enrich templates
enricher = TemplateEnrichmentAgent(claude, brightdata)
enriched = await enricher.enrich_templates(templates)

# Expand to new entities
expander = TemplateExpansionAgent(claude, brightdata)
expanded = await expander.expand_templates(enriched, target_entities=["liverpool"])

# Validate
validator = TemplateValidator(claude, brightdata)
report = await validator.validate_templates(expanded)
```

**Template Storage**:
- `data/bootstrapped_templates/`: Production templates
- `backend/bootstrapped_templates/`: Runtime template cache
- `data/runtime_bindings/`: Template-entity bindings

**Runtime Binding** (`backend/template_runtime_binding.py`):
- Binds templates to specific entities
- Tracks binding lifecycle
- Manages binding feedback

**Related Files**:
- `backend/template_loader.py`: Load templates from storage
- `backend/binding_lifecycle_manager.py`: Manage template-entity bindings
- `backend/binding_feedback_processor.py`: Process feedback from bindings

Start backend services:
```bash
# Start FastAPI backend
cd backend && python run_server.py

# Run MCP servers (configured in mcp-config.json)
python backend/falkordb_mcp_server_fastmcp.py
python backend/temporal_mcp_server.py

# Start Ralph Loop validation server
python backend/ralph_loop_server.py
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

## Recent Enhancements (January - February 2026)

### BrightData SDK Optimizations (February 2026)
- **Multi-engine support**: ENGINE_PREFERENCES with engine fallback (Google → Bing/Yandex) per hop type
- **Variable result counts**: NUM_RESULTS_BY_HOP with high-value hops fetching 5 results
- **URL relevance scoring**: _score_url() method with hop-type-specific keyword and path quality scoring
- **Search result caching**: 24-hour LRU cache with 256 entry limit and FIFO eviction
- **Procurement-specific queries**: Enhanced FALLBACK_QUERIES with targeted procurement terms
- **Related files**: `backend/hypothesis_driven_discovery.py`, `backend/test_brightdata_optimizations.py`
- **Expected impact**: 30-50% better URL discovery for procurement hops, 30-50% API cost reduction through caching

### Dossier System Integration (February 2026)
- **Evidence-based starting points**: run_discovery_with_dossier_context() initializes from actual dossier signals
- **Targeted search queries**: Generates procurement-specific search queries based on known signals
- **Feedback loop**: Discovered evidence links back to dossier source for enrichment
- **Related files**: `backend/hypothesis_driven_discovery.py` (lines 1767-1954), `backend/generate_entity_dossier.py`
- **Impact**: 20-30% fewer wasted iterations, 15-25% better URL quality through targeted queries, 30-50% faster convergence with dossier-based priors

### Hypothesis-Driven Discovery System (Latest)
- **EIG-based prioritization**: Expected Information Gain for intelligent hypothesis ranking
- **Single-hop execution**: Deterministic cost control with no multi-hop exploration
- **Depth-aware stopping**: Enforces 2-3 level depth limit
- **Fixed confidence math**: Delta-based scoring (ACCEPT: +0.06, WEAK_ACCEPT: +0.02)
- **Related files**: `backend/hypothesis_driven_discovery.py`, `backend/eig_calculator.py`, `backend/hypothesis_manager.py`

### Ralph Loop Signal Validation
- **3-pass validation**: Rule-based → Claude validation → Final confirmation
- **Minimum evidence**: 3 pieces of evidence per signal
- **Confidence gating**: Only signals >0.7 confidence written to Graphiti
- **Category saturation**: Detects when categories are exhausted (3 REJECTs)
- **Related files**: `backend/ralph_loop.py`, `backend/ralph_loop_server.py`, `backend/ralph_loop_governor.py`

### Template System
- **Template Discovery**: Discovers recurring procurement patterns across entities
- **Template Enrichment**: Cross-references and validates pattern consistency
- **Template Expansion**: Generalizes patterns to new entities/domains
- **Template Validation**: Tests templates against real-world data
- **Related files**: `backend/template_discovery.py`, `backend/template_enrichment_agent.py`, `backend/template_expansion_agent.py`

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

## Related Documentation

The following documents in the repository provide additional context:

**Hypothesis-Driven Discovery**:
- `HYPOTHESIS_DRIVEN_DISCOVERY_FINAL_REPORT.md` - Complete implementation details
- `HYPOTHESIS_DRIVEN_DISCOVERY_QUICKSTART.md` - Quick start guide
- `HYPOTHESIS_DRIVEN_DISCOVERY_SUMMARY.md` - High-level overview

**System Architecture**:
- `SIGNAL-NOISE-ARCHITECTURE.md` - Overall system architecture
- `SYSTEM-IMPROVEMENTS-PLAN.md` - Planned improvements and roadmap
- `IMPLEMENTATION-SUMMARY.md` - Implementation overview

**Validation & Testing**:
- `IMPLEMENTATION-VALIDATION-REPORT.md` - Validation testing results
- `MAX-DEPTH-VALIDATION-COMPARISON.md` - Depth limit validation
- `SIMULATION_RESULTS_SUMMARY.md` - Simulation comparison results

**Production**:
- `PRODUCTION-ENHANCEMENTS-COMPLETE.md` - Production hardening details
- `FINAL-SUMMARY.md` - Project completion summary

**Quick Reference**:
- `QUICK-START-CALIBRATION.md` - Calibration system quick start
- `QUICK-START-RFP-SYSTEM.md` - RFP system quick start
- `HOW-TO-USE-SYSTEM.md` - General system usage guide
