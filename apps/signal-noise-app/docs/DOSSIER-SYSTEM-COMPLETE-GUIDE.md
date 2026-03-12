# Dossier System Complete Understanding Guide

> **Status**: Production-Ready | **Last Updated**: 2026-02-26 | **Context**: Reference documentation for the complete dossier system

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Dossier System Architecture](#dossier-system-architecture)
3. [The 11 Dossier Sections](#the-11-dossier-sections)
4. [Critical File Paths](#critical-file-paths)
5. [Model Cascade Strategy](#model-cascade-strategy)
6. [Tier System](#tier-system)
7. [What's Working Now](#whats-working-now)
8. [Phase Implementation Status](#phase-implementation-status)
9. [Key Integration Points](#key-integration-points)
10. [Testing Commands](#testing-commands)
11. [Related Documentation](#related-documentation)

---

## System Overview

The Signal Noise App is an AI-powered sports intelligence and RFP analysis platform with **8 major integrated systems**:

| # | System | Purpose | Status |
|---|--------|---------|--------|
| 1 | **Entity Database** | 3,400+ sports entities in FalkorDB | ✅ Active |
| 2 | **Hypothesis-Driven Discovery** | EIG-based exploration with cost control | ✅ Active |
| 3 | **Ralph Loop** | Signal validation with 3-pass governance | ✅ Active |
| 4 | **Template System** | Automated procurement pattern discovery | ✅ Active |
| 5 | **RFP Intelligence** | LinkedIn monitoring with temporal intelligence | ✅ Active |
| 6 | **AI Chat Interface** | CopilotKit-powered with MCP tools | ✅ Active |
| 7 | **Temporal Intelligence** | Timeline tracking and pattern analysis | ✅ Active |
| 8 | **Dossier Generation** | Multi-source intelligence reports (11 sections) | ✅ Active |

---

## Dossier System Architecture

### Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOSSIER DATA COLLECTION PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────────┘

     ENTITY REQUEST
             │
             ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  STEP 1: CHECK FALKORDB (Primary Graph Database)                          │
  │  ─────────────────────────────────────────────────────────────────────  │
  │  • Query: Does entity exist with metadata?                                 │
  │  • If YES: Use existing metadata                                          │
  │  • If NO: Create basic EntityMetadata placeholder                          │
  └───────────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  STEP 2: ENHANCED MULTI-SOURCE SCRAPING                                    │
  │  ─────────────────────────────────────────────────────────────────────  │
  │  Source 1: Wikipedia → founded, stadium, capacity, website, league, hq  │
  │  Source 2: Official Site → current content, brand info                   │
  │  Source 3: Field-Specific → fallback searches for missing data           │
  │  Source 4: League Data → PremierLeague.com, etc.                         │
  │                                                                            │
  │  Extraction Method: Claude (Haiku) parses scraped markdown → JSON fields │
  └───────────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  STEP 3: RALPH LOOP FIELD VALIDATION (3-Pass Governance)                  │
  │  ─────────────────────────────────────────────────────────────────────  │
  │  PASS 1: Rule-Based Filtering                                             │
  │    • Pattern validation (founded = 4 digits, stadium = 2+ chars)         │
  │    • Range validation (founded between 1800-2025)                         │
  │    • Source credibility scoring (Wikipedia=0.9, Official=1.0)           │
  │                                                                            │
  │  PASS 2: LLM Cross-Check (Claude Haiku)                                    │
  │    • Detects conflicts between sources                                    │
  │    • Ranks candidates by confidence                                       │
  │    • Explains reasoning for selection                                     │
  │                                                                            │
  │  PASS 3: Final Confirmation                                               │
  │    • Selects highest-confidence value                                     │
  │    • Returns validated value + confidence score                          │
  └───────────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  STEP 4: METADATA POPULATION                                              │
  │  ─────────────────────────────────────────────────────────────────────  │
  │  • Update EntityMetadata with validated fields:                           │
  │    - founded (1886)                                                        │
  │    - stadium (Emirates Stadium)                                           │
  │    - capacity (60,704)                                                     │
  │    - website (arsenal.com)                                                │
  │    - headquarters (Holloway, London)                                       │
  │    - country (England)                                                     │
  │    - league_or_competition (Premier League)                                │
  └───────────────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  STEP 5: DOSSIER GENERATION                                                │
  │  ─────────────────────────────────────────────────────────────────────  │
  │  • Interpolate prompt with entity_data (includes scraped fields)          │
  │  • Generate dossier with Claude (Haiku/Sonnet/Opus cascade)               │
  │  • Add scraped metadata to dossier["metadata"]                            │
  │  • Return complete dossier with real data                                 │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## The 11 Dossier Sections

| Section | Tier | Model | Data Source | Status |
|---------|------|-------|-------------|--------|
| **1. Core Information** | BASIC | Haiku | Multi-source scraping | ✅ Real data |
| **2. Digital Transformation** | STANDARD | Sonnet | Tech stack detection | ✅ Real + LLM |
| **3. AI Reasoner Assessment** | PREMIUM | Sonnet | Strategic analysis | ✅ LLM analysis |
| **4. Strategic Opportunities** | PREMIUM | Sonnet | Opportunity detection | ✅ Real + LLM |
| **5. Key Decision Makers** | STANDARD | Sonnet | collect_leadership() | ✅ Real names |
| **6. Connections Analysis** | PREMIUM | Opus | Network mapping | ⚠️ Needs YP CSV |
| **7. Recent News** | BASIC | Haiku | News scraping | ✅ Real + LLM |
| **8. Current Performance** | BASIC | Haiku | League table scrape | ✅ Real data |
| **9. Outreach Strategy** | STANDARD | Sonnet | Derived analysis | ✅ LLM-generated |
| **10. Risk Assessment** | PREMIUM | Sonnet | Risk analysis | ✅ LLM-generated |
| **11. League Context** | BASIC | Haiku | League metadata | ✅ Real data |

### Section Details

#### 1. Core Information (BASIC)
- **Questions Answered**: Who is this entity, when were they founded, where are they based?
- **Data Sources**: FalkorDB metadata, Wikipedia, official website
- **Output**: Founded year, stadium, capacity, headquarters, league, country

#### 2. Digital Transformation (STANDARD)
- **Questions Answered**: What's their digital maturity? What technology stack do they use?
- **Data Sources**: Job postings, press releases, official site, LinkedIn
- **Output**: Digital Maturity Score (0-100), technology stack, digital initiatives

#### 3. AI Reasoner Assessment (PREMIUM)
- **Questions Answered**: What strategic insights can we derive from all available data?
- **Data Sources**: All previous sections combined
- **Output**: Strategic assessment, market position, recommendations

#### 4. Strategic Opportunities (PREMIUM)
- **Questions Answered**: What opportunities exist for Yellow Panther services?
- **Data Sources**: Digital maturity analysis, current initiatives, industry trends
- **Output**: Opportunity scoring, positioning strategies, case study matches

#### 5. Key Decision Makers (STANDARD)
- **Questions Answered**: Who are the key people to contact?
- **Data Sources**: `collect_leadership()` method with 5+ sources
- **Output**: Real names with roles, LinkedIn URLs (60% success rate), confidence scores

#### 6. Connections Analysis (PREMIUM)
- **Questions Answered**: What mutual connections do we have?
- **Data Sources**: Yellow Panther team CSV (NEEDS INPUT)
- **Output**: Mutual contacts, bridge contacts, connection strength

#### 7. Recent News (BASIC)
- **Questions Answered**: What's happening with this entity?
- **Data Sources**: News scraping, press releases
- **Output**: Recent developments, announcements, changes

#### 8. Current Performance (BASIC)
- **Questions Answered**: How are they performing?
- **Data Sources**: League tables, standings
- **Output**: Current position, recent form, performance metrics

#### 9. Outreach Strategy (STANDARD)
- **Questions Answered**: How should we approach this entity?
- **Data Sources**: All sections combined
- **Output**: Recommended approach, messaging angles, timing

#### 10. Risk Assessment (PREMIUM)
- **Questions Answered**: What risks should we be aware of?
- **Data Sources**: Financial health, leadership changes, industry context
- **Output**: Risk scoring, mitigation strategies

#### 11. League Context (BASIC)
- **Questions Answered**: What's the broader context?
- **Data Sources**: League metadata, standings
- **Output**: League position, competitive landscape

---

## Critical File Paths

### Core Dossier System

| File | Purpose | Key Lines |
|------|---------|-----------|
| `backend/dossier_generator.py` | Main generator with EntityDossierGenerator, UniversalDossierGenerator | 39-1716 |
| `backend/dossier_data_collector.py` | DossierDataCollector with collect_leadership(), multi-source scraping | 324-3380 |
| `backend/brightdata_sdk_client.py` | BrightData SDK wrapper (fixed) | - |
| `backend/dossier_section_prompts.py` | 11 section prompts (1,200+ lines) | - |
| `backend/dossier_data_specs.py` | CSV schema definitions (700 lines) | 42-530 |
| `backend/batch_dossier_generator.py` | Batch processing for 3,000+ entities | 650 lines |

### Phase Implementations

| File | Purpose | Status |
|------|---------|--------|
| `backend/episode_clustering.py` | Semantic + temporal episode compression | ✅ Complete |
| `backend/eig_calculator.py` | Time-weighted EIG with λ=0.015 decay | ✅ Complete |
| `backend/dashboard_scorer.py` | Three-axis scoring (Procurement Maturity, Active Probability, Sales Readiness) | ✅ Complete |
| `backend/temporal_mcp_server.py` | Temporal intelligence MCP tools | ✅ Complete |

### Frontend Integration

| File | Purpose | Status |
|------|---------|--------|
| `src/app/entity-browser/[entityId]/dossier/page.tsx` | Main dossier page with generation triggers | ✅ Active |
| `src/components/entity-dossier/EntityDossierRouter.tsx` | Routes to Enhanced/Standard views | ✅ Active |
| `src/components/entity-dossier/EnhancedClubDossier.tsx` | Premium 11-section display | ✅ Active |
| `src/components/entity-dossier/types.ts` | Type definitions (EnhancedClubDossier, etc.) | ✅ Active |
| `src/lib/dossier-mapper.ts` | Maps backend formats to frontend types | ✅ Active |
| `src/app/api/dossier/route.ts` | API endpoint (caches in Supabase) | ✅ Active |

---

## Model Cascade Strategy (Cost Optimization)

### Model Distribution

| Model | Usage | Cost/1M Tokens | Sections |
|-------|-------|----------------|----------|
| **Haiku** | 80% | $0.25 | Core Information, Recent News, Current Performance, League Context |
| **Sonnet** | 15% | $3.00 | Digital Maturity, Leadership, AI Reasoner, Opportunities, Outreach, Risk |
| **Opus** | 5% | $15.00 | Strategic Analysis, Connections |

### Cost Savings

| Strategy | Cost per Dossier | Savings |
|----------|-----------------|---------|
| **Sonnet-only** | ~$0.50 | Baseline |
| **Model Cascade** | ~$0.057 | **92% reduction** |
| **BASIC tier (Haiku only)** | ~$0.0004 | 99.9% reduction |

### Model Registry (from `backend/claude_client.py`)

```python
class ModelRegistry:
    MODELS = {
        "haiku": ModelConfig(
            name="haiku",
            model_id="claude-3-5-haiku-20241022",
            max_tokens=8192,
            cost_per_million_tokens=0.25
        ),
        "sonnet": ModelConfig(
            name="sonnet",
            model_id="claude-3-5-sonnet-20241022",
            max_tokens=8192,
            cost_per_million_tokens=3.0
        ),
        "opus": ModelConfig(
            name="opus",
            model_id="claude-3-opus-20240229",
            max_tokens=4096,
            cost_per_million_tokens=15.0
        )
    }
```

---

## Tier System

| Tier | Priority Range | Sections | Time | Cost |
|------|---------------|----------|------|------|
| **BASIC** | 0-20 | 3 (Core, News, Performance, League) | ~5s | ~$0.0004 |
| **STANDARD** | 21-50 | 8 (BASIC + Digital, Leadership, Outreach) | ~15s | ~$0.0095 |
| **PREMIUM** | 51-100 | 11 (STANDARD + AI Reasoner, Opportunities, Risk, Connections) | ~30s | ~$0.057 |

### Tier Selection Logic

```python
def determine_tier(priority_score: int) -> DossierTier:
    if priority_score <= 20:
        return DossierTier.BASIC
    elif priority_score <= 50:
        return DossierTier.STANDARD
    else:
        return DossierTier.PREMIUM
```

---

## What's Working Now

### ✅ FULLY IMPLEMENTED

1. **Multi-source scraping** - Wikipedia, official sites, league databases, job postings, LinkedIn
2. **Ralph Loop 3-pass validation** - Rule filtering → LLM cross-check → Final confirmation
3. **Core entity fields** - founded, stadium, capacity, website, headquarters, country, league
4. **Confidence scoring** - Each validated field has confidence score
5. **Source credibility weighting** - Wikipedia (0.9), Official (1.0)
6. **Model cascade optimization** - Haiku/Sonnet/Opus for cost efficiency
7. **11-section generation** - All sections with contextual prompts
8. **Tier-based scoring** - BASIC/STANDARD/PREMIUM with priority mapping
9. **Batch processing** - Support for 3,000+ entities
10. **LinkedIn profile extraction** - Decision maker URLs with ~60% success rate
11. **Frontend display** - EnhancedClubDossier with tabbed interface
12. **Supabase caching** - 7-day expiry for generated dossiers

### ⚠️ PARTIALLY IMPLEMENTED

1. **Ralph Loop full signal validation** - Field validation works, full 3-pass signal validation needs integration
2. **Connections analysis** - Schema exists, needs Yellow Panther team CSV
3. **Bridge contacts** - Currently placeholder data

---

## Phase Implementation Status

| Phase | Name | Status | Tests |
|-------|------|--------|-------|
| Phase 0 | Scalable Dossier Generation | ✅ Complete | - |
| Phase 2 | Episode Clustering | ✅ Complete | 6/6 passing |
| Phase 3 | Time-Weighted EIG | ✅ Complete | 5/5 passing |
| Phase 4 | Three-Axis Dashboard Scoring | ✅ Complete | 6/6 passing |

---

## Key Integration Points

### FalkorDB

- **Purpose**: Primary graph database for entity metadata
- **File**: `backend/hypothesis_persistence_native.py`
- **Status**: Working with native Python client
- **Connection**: Uses `redis://` protocol (NOT `rediss://`)

### BrightData SDK

- **Purpose**: Web scraping for multi-source intelligence
- **File**: `backend/brightdata_sdk_client.py`
- **Status**: Fixed and optimized (NOT MCP, direct SDK)
- **Methods**: `search_engine()`, `scrape_as_markdown()`, `scrape_batch()`

### Claude Agent SDK

- **Purpose**: AI generation with model cascade
- **File**: `backend/claude_client.py`
- **Status**: Working with Haiku→Sonnet→Opus cascade
- **Base URL**: `https://api.z.ai/api/anthropic` (Z.AI proxy)

### Supabase

- **Purpose**: Cache layer for generated dossiers
- **Table**: `entity_dossiers` (7-day expiry)
- **Status**: Working

---

## Testing Commands

### Test Leadership Collection

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -c "
import asyncio
from backend.dossier_data_collector import DossierDataCollector

async def test():
    collector = DossierDataCollector()
    result = await collector.collect_leadership(
        entity_id='coventry-city-fc',
        entity_name='Coventry City FC'
    )
    for dm in result['decision_makers']:
        print(f\"{dm['name']}: {dm['role']} - {dm.get('linkedin_url', 'No LinkedIn')}\")

asyncio.run(test())
"
```

### Generate Full Dossier

```bash
python3 -c "
import asyncio
from backend.dossier_generator import EntityDossierGenerator
from backend.claude_client import ClaudeClient

async def test():
    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)
    dossier = await generator.generate_dossier(
        entity_id='arsenal-fc',
        entity_name='Arsenal FC'
    )
    print(f\"Generated {len(dossier.sections)} sections\")

asyncio.run(test())
"
```

---

## Related Documentation

### Main Documentation

| File | Purpose |
|------|---------|
| `docs/DOSSIER-SYSTEM-IDENTIFICATION.md` | Real vs test system identification |
| `DOSSIER-SCALABLE-SYSTEM-IMPLEMENTATION.md` | Scalable implementation guide |
| `DOSSIER-SYSTEM-QUICK-REF.md` | Quick reference |
| `ENTITY-DOSSIER-SYSTEM-COMPLETE.md` | Complete system overview |
| `ENHANCED-DOSSIER-ARCHITECTURE-EXPLAINED.md` | Architecture details |
| `DOSSIER-DATA-INTEGRATION-GUIDE.md` | Data integration |

### Phase Documentation

| File | Purpose |
|------|---------|
| `HYPOTHESIS_DRIVEN_DISCOVERY_FINAL_REPORT.md` | Complete implementation details |
| `HYPOTHESIS_DRIVEN_DISCOVERY_QUICKSTART.md` | Quick start guide |
| `SIGNAL-NOISE-ARCHITECTURE.md` | Overall system architecture |
| `IMPLEMENTATION-VALIDATION-REPORT.md` | Validation testing results |

---

## Quick Verification Checklist

Before running dossier generation at scale:

- [ ] Using `backend/dossier_generator.py` (not a custom test script)
- [ ] Using `DossierDataCollector` class for data collection
- [ ] Expected file size: 10-50KB per entity (not 400KB+)
- [ ] Real decision maker names expected (e.g., "Billy Hogan", not "CEO")
- [ ] Multiple sources in output: job_postings, linkedin, press_releases, official_site
- [ ] Confidence scores >80% for high-quality data
- [ ] Environment variables set: BRIGHTDATA_API_TOKEN, ANTHROPIC_AUTH_TOKEN
- [ ] Running from project root (not from backend/ subdirectory)

---

## Environment Requirements

```bash
# BrightData SDK (REQUIRED)
BRIGHTDATA_API_TOKEN=your-token-here

# Claude AI (REQUIRED)
ANTHROPIC_AUTH_TOKEN=your-zai-token
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# FalkorDB (for graph persistence)
FALKORDB_URI=redis://your-instance
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password
FALKORDB_DATABASE=sports_intelligence

# Supabase (cache layer)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Critical Note**: If you add/update environment variables, **restart the Python backend** to pick up changes.

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Time per entity (BASIC) | ~5 seconds |
| Time per entity (STANDARD) | ~15 seconds |
| Time per entity (PREMIUM) | ~30 seconds |
| Data sources | 5+ (job_postings, linkedin, press_releases, official_site, wikipedia) |
| Claude calls per entity | 3-5 (model cascade for cost optimization) |
| Output size | 10-50KB per entity |
| Decision makers found | 5-15 per entity (varies by organization size) |
| Cost per BASIC dossier | ~$0.0004 |
| Cost per STANDARD dossier | ~$0.0095 |
| Cost per PREMIUM dossier | ~$0.057 |

---

## Summary

The dossier system is **production-ready** with:
- ✅ Real data collection from 5+ sources
- ✅ 11-section generation with LLM analysis
- ✅ Cost-optimized model cascade (92% savings vs Sonnet-only)
- ✅ Tier-based processing (BASIC/STANDARD/PREMIUM)
- ✅ Batch processing for 3,000+ entities
- ✅ Frontend integration with enhanced view
- ✅ Supabase caching layer
- ✅ LinkedIn profile extraction for decision makers

### Missing pieces (minor):
- Yellow Panther team CSV for connections analysis
- Full Ralph Loop signal validation integration
- Backend FastAPI endpoint in main.py (quick add)

---

**Document Metadata**
- **Created**: 2026-02-26
- **Purpose**: Complete reference for the dossier system
- **Context**: Post-implementation documentation for reference
