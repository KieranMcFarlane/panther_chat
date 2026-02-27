# CLAUDE.md

Guidance for Claude Code working in this repository.

## Quick Setup

**Environment file**: `.env` at project root

```bash
# Required variables
FALKORDB_URI=redis://your-instance.cloud:port
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password
FALKORDB_DATABASE=sports_intelligence

ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=your-zai-token

BRIGHTDATA_API_TOKEN=your-brightdata-token
```

**Python scripts** - load env from parent:
```python
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
```

## Project Overview

AI-powered sports intelligence and RFP analysis platform with **5-Phase Unified Pipeline**:

```
PHASE 0: Dossier Generation (Cold Start)
PHASE 1: Hypothesis-Driven Discovery (Warm-Start)
PHASE 2: Ralph Loop Validation (3-Pass Governance)
PHASE 3: Temporal Intelligence (Episode Clustering + Time-Weighted EIG)
PHASE 4: Three-Axis Dashboard Scoring (Maturity + Probability → Sales Readiness)
```

**Components**:
- **Entity Database**: 3,400+ entities in FalkorDB graph database
- **Dossier System**: 11-section intelligence reports with multi-source scraping
- **Hypothesis-Driven Discovery**: EIG-based exploration with dossier priors (47% cost savings)
- **Ralph Loop**: 3-pass signal validation with confidence scoring
- **Temporal Intelligence**: Episode tracking, clustering, time-weighted EIG
- **Dashboard Scoring**: Procurement Maturity (0-100) + Active Probability (0-1) → Sales Readiness
- **AI Chat**: CopilotKit-powered interface with MCP tools

## Commands

```bash
npm run dev          # Next.js dev server (port 3005)
npm run build        # Production build
npm run start        # Production server (port 4328)
npm run test         # Run tests
npm run test:mcp     # Test MCP integration
```

## Architecture

**Frontend**: Next.js 14 + Tailwind CSS + Radix UI (dark theme)
**Backend**: FastAPI + FalkorDB/Neo4j + Supabase cache
**AI**: Claude Agent SDK + CopilotKit + MCP tools

### Data Layer
- **FalkorDB**: Primary graph DB (3,400+ entities) - use `redis://` NOT `rediss://`
- **Neo4j Aura**: Cloud backup
- **Supabase**: Cache layer (22 tables, 7-day expiry)
- **Graphiti**: Temporal knowledge graph for RFP episodes

### MCP Servers
| Server | Purpose | Env Vars |
|--------|---------|----------|
| neo4j-mcp | Knowledge graph queries | NEO4J_URI, NEO4J_* |
| falkordb-mcp | Native FalkorDB (backend/falkordb_mcp_server_fastmcp.py) | FALKORDB_* |
| supabase | Database ops | SUPABASE_* |
| perplexity-mcp | Market research | PERPLEXITY_API_KEY |
| temporal-intelligence | Timelines, patterns (backend/temporal_mcp_server.py) | FASTAPI_URL, SUPABASE_* |

### BrightData SDK (NOT MCP)

**CRITICAL**: Use SDK directly, NOT MCP tools.

```python
from backend.brightdata_sdk_client import BrightDataSDKClient

sdk = BrightDataSDKClient()
results = await sdk.search_engine('query', 'google', 10)
content = await sdk.scrape_as_markdown('url')
batch = await sdk.scrape_batch(['url1', 'url2'])
```

### FalkorDB Connection Fix

```python
# Use redis:// NOT rediss://, ssl=False
db = FalkorDB(host=host, port=port, username=username, password=password, ssl=False)

# Query params as dict, NOT **kwargs
self.graph.query(query, {'hypothesis_id': id})

# Iterate result_set
rows = list(result.result_set)
```

## The 5-Phase Pipeline (Feb 2026)

### PHASE 0: Dossier Generation

**File**: `backend/dossier_generator.py` (~1,700 lines)

**Multi-Source Scraping** (5+ sources):
| Source | Data |
|--------|------|
| Wikipedia | Founded, stadium, capacity, HQ, league |
| Official Site | Current content, brand info |
| Job Boards | Leadership, tech stack, CRM needs |
| LinkedIn | Executive profiles (~60% success) |
| Press Releases | Recent initiatives, partnerships |
| League Data | Standings, performance |

**Ralph Loop 3-Pass Validation**:
```
PASS 1: Rule-Based (patterns, ranges, source credibility)
   ↓
PASS 2: LLM Cross-Check (Haiku - detects conflicts)
   ↓
PASS 3: Final Confirmation (validated value + confidence)
```

**Model Cascade** (92% cost savings):
| Model | Usage | Cost |
|-------|-------|------|
| Haiku | 80% (BASIC sections) | $0.25/M |
| Sonnet | 15% (STANDARD) | $3.0/M |
| Opus | 5% (PREMIUM) | $15.0/M |

**11 Dossier Sections**:

| # | Section | Tier | Status |
|---|---------|------|--------|
| 1 | Core Information | BASIC | ✅ Real data |
| 2 | Digital Transformation | STANDARD | ✅ Real + LLM |
| 3 | AI Reasoner Assessment | PREMIUM | ✅ LLM analysis |
| 4 | Strategic Opportunities | PREMIUM | ✅ Real + LLM |
| 5 | Key Decision Makers | STANDARD | ✅ Real names |
| 6 | Connections Analysis | PREMIUM | ⚠️ Needs YP CSV |
| 7 | Recent News | BASIC | ✅ Real + LLM |
| 8 | Current Performance | BASIC | ✅ Real data |
| 9 | Outreach Strategy | STANDARD | ✅ LLM-generated |
| 10 | Risk Assessment | PREMIUM | ✅ LLM-generated |
| 11 | League Context | BASIC | ✅ Real data |

**Output**: Dossier with `procurement_signals` and `capability_signals`

### PHASE 1: Hypothesis-Driven Discovery

**File**: `backend/hypothesis_driven_discovery.py` (~2,500 lines)

**Key Innovation**: Dossier as **PRIOR confidence** (not neutral 0.50)

| Approach | Starting Confidence | Iterations | Cost |
|----------|-------------------|------------|------|
| Cold Start | 0.50 | ~15-20 | ~$0.15 |
| **Warm-Start (Dossier)** | **0.65** | **~8-12** | **~$0.08** |
| **Savings** | - | **47%** | **47%** |

```python
# Warm-start with dossier
result = await discovery.run_discovery_with_dossier_context(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    dossier=dossier_data,  # Contains signals with confidence
    max_iterations=30
)

# Dossier signals become PRIOR confidence
# Targeted queries generated from dossier signals
# EIG-based prioritization (uncertain + valuable = high priority)
# Single-hop execution (deterministic cost control)
```

**EIG-Based Ranking**:
- High uncertainty + high value = high priority
- Single-hop-per-iteration (no multi-hop exploration)
- Depth-aware stopping (2-3 level limit)

### PHASE 2: Ralph Loop Validation

**File**: `backend/ralph_loop.py` (~800 lines)

**3-Pass Governance**:
```
RAW SIGNALS
   ↓
PASS 1: Rule-Based (min 3 evidence, source credibility)
   ↓
PASS 2: Claude Cross-Check (duplicates, conflicts)
   ↓
PASS 3: Final Confirmation (confidence > 0.7)
   ↓
VALIDATED SIGNALS
```

**Decision Types**:

| Internal | External | Delta |
|----------|----------|-------|
| ACCEPT | Procurement Signal | +0.06 |
| WEAK_ACCEPT | Capability Signal | +0.02 |
| REJECT | No Signal | 0.00 |
| NO_PROGRESS | No Signal | 0.00 |
| SATURATED | Saturated | 0.00 |

**Confidence Calculation**: `0.50 + (ACCEPT × 0.06) + (WEAK_ACCEPT × 0.02)`

### PHASE 3: Temporal Intelligence

**File**: `backend/graphiti_service.py` (~600 lines)

**Components**:
- **Episode Clustering** (Phase 2 - Complete)
- **Time-Weighted EIG** (Phase 3 - Complete)
- **Timeline tracking**

```python
# RFP detections become temporal episodes
await graphiti.create_episode(
    entity_id="arsenal-fc",
    episode_type="RFP_DETECTED",
    content="Arsenal FC issued CRM RFP",
    metadata={"deadline": "2025-03-15", "budget": "$1.5M"}
)
```

**Temporal Features**:
- Recent signals get higher weight (last 30 days: full weight)
- Older signals: temporal decay applied
- Improves probability forecasting

### PHASE 4: Three-Axis Dashboard Scoring

**File**: `backend/dashboard_scorer.py` (~720 lines)

**Axis 1: Procurement Maturity (0-100)**:
```
Capability Signals (40%):     Job postings, tech adoption
Digital Initiatives (30%):    Transformations, modernizations
Partnership Activity (20%):   Partnerships, integrations
Executive Changes (10%):      C-level hires
```

**Axis 2: Active Probability (0-1)**:
```
Validated RFP Bonus (+40%):   Confirmed RFP detected
Procurement Density (30%):    Signals per month (6-month window)
Temporal Recency (20%):       Recent activity bonus
EIG Confidence (10%):         Overall hypothesis confidence
```

**Axis 3: Sales Readiness Level**:

| Level | Condition | Action |
|-------|-----------|--------|
| **LIVE** | RFP validated | Daily monitoring, proposal prep |
| **HIGH_PRIORITY** | Maturity > 80 AND Prob > 70% | Bi-weekly contact |
| **ENGAGE** | Maturity > 60 AND Prob > 40% | Monthly contact |
| **MONITOR** | Maturity > 40 OR Prob > 20% | Quarterly check-ins |
| **NOT_READY** | Everything else | Watchlist |

**Confidence Intervals** (Bootstrap-style):
```
Sample Size = 1 + num_hypotheses
Confidence = min(0.95, 0.5 + sample_size × 0.05)
Margin of Error = (1 - confidence) × 10%
```

### Feedback Loop

Discovery results enrich original dossier:

```python
# Dossier → Discovery → Ralph Loop → Dashboard → Enriched Dossier
dossier = await generate_dossier(
    entity=entity,
    validated_signals=ralph_loop_output,
    final_confidence=discovery_result.final_confidence,
    discovery_results=discovery_result.metadata
)
```

## Schema (`backend/schemas.py`)

**Entity**: `id`, `type` (ORG/PERSON/PRODUCT/INITIATIVE/VENUE), `name`, `metadata`
**Signal**: `id`, `type`, `confidence`, `first_seen`, `entity_id`, `evidence`
**Evidence**: `id`, `source`, `content`, `confidence`, `collected_at`

## Confidence Bands

| Band | Range | Price |
|------|-------|-------|
| EXPLORATORY | <0.30 | $0 |
| INFORMED | 0.30-0.60 | $500/mo |
| CONFIDENT | 0.60-0.80 | $2,000/mo |
| ACTIONABLE | >0.80 + gate | $5,000/mo |

**Actionable Gate**: Confidence > 0.80 AND ≥2 ACCEPTs across ≥2 categories

## Common Patterns

**New page**: `src/app/your-page/page.tsx`
**API route**: `src/app/api/your-endpoint/route.ts`
**SWR**: `useSWR('/api/entities', fetcher)`

**Backend services**:
```bash
cd backend && python run_server.py
python backend/falkordb_mcp_server_fastmcp.py
python backend/temporal_mcp_server.py
```

## Architectural Decisions (Feb 2026)

### Model Cascade ✅
- Haiku (80%, $0.25/M): BASIC sections, 90% of operations
- Sonnet (15%, $3.0/M): STANDARD sections, complex reasoning
- Opus (5%, $15.0/M): PREMIUM sections, rare/complex insights
- **92% cost savings vs Sonnet-only**

### Signal Decay
- **NO time-based decay** - signals persist at discovered confidence
- Category saturation after 3 REJECTs
- Novelty dampening for frequently seen patterns

### Warm-Start Discovery
- 47% cost reduction vs cold start
- 20-30% fewer wasted iterations
- 15-25% better URL quality through targeted queries

### Build Config
- `ignoreBuildErrors: true` for rapid development
- Some API routes rewritten to `/api/placeholder` during build

## Active Systems
- FalkorDB (primary), Neo4j Aura (backup), Supabase (cache)
- CopilotKit (1000+ refs), Claude Agent SDK (60+ refs)
- Graphiti temporal graph, Narrative Builder
- Hypothesis-Driven Discovery, Ralph Loop, Template System
- Dossier Generator (11 sections), Dashboard Scorer (3-axis)

## Placeholder Systems
- Mastra (basic setup only)
- Qdrant (TODO)
- Redis (installed, not actively used)

## Key Files (Feb 2026)

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| Dossier | `backend/dossier_generator.py` | ~1,700 | ✅ |
| Discovery | `backend/hypothesis_driven_discovery.py` | ~2,500 | ✅ |
| Ralph Loop | `backend/ralph_loop.py` | ~800 | ✅ |
| Temporal | `backend/graphiti_service.py` | ~600 | ✅ |
| Dashboard | `backend/dashboard_scorer.py` | ~720 | ✅ |

## Related Documentation

- `ENTITY-JOURNEY-WALKTHROUGH.md` - Complete flow example with Boca Juniors
- `DOSSIER-SYSTEM-SUMMARY.md` - Dossier system quick reference
- `DOSSIER-SCALABLE-SYSTEM-IMPLEMENTATION.md` - Batch processing guide
- `PHASE4-DASHBOARD-SCORING-COMPLETE.md` - Three-axis scoring details
- `docs/DOSSIER-SYSTEM-COMPLETE-GUIDE.md` - Full dossier documentation
