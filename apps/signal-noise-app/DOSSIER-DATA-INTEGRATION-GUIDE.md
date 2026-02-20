# Dossier Data Integration Guide

**Date**: 2026-02-04
**Status**: 📋 Ready for Implementation
**Goal**: Integrate FalkorDB, BrightData SDK, and Hypothesis Manager into Entity Dossier Generation System

---

## Executive Summary

The dossier system currently generates high-quality strategic intelligence using **placeholder data**. This document explains how to integrate three critical data sources using existing `.env` configuration patterns:

1. **FalkorDB** → Entity metadata (founded 1886, Emirates Stadium, etc.)
2. **BrightData SDK** → Live web scraping (recent Arsenal news, official site content)
3. **Hypothesis Manager** → Discovered signals (procurement patterns from Ralph Loop)

---

## Environment Variable Patterns

### Pattern 1: BrightData SDK Client (`brightdata_sdk_client.py`)

**Environment Variables**:
```bash
BRIGHTDATA_API_TOKEN=your-token-here
```

**Loading Pattern** (most robust for `backend/` scripts):
```python
from dotenv import load_dotenv
from pathlib import Path
import os

# Try current directory first
env_loaded = load_dotenv()

# Also try parent directory explicitly (for backend/ scripts)
parent_env = Path(__file__).parent.parent / '.env'
if parent_env.exists():
    load_dotenv(parent_env, override=True)
    logger.info(f"✅ Loaded .env from parent directory: {parent_env}")

# Load token from environment
token = os.getenv('BRIGHTDATA_API_TOKEN')
```

**Why This Pattern**: Scripts in `backend/` directory need to load `.env` from parent project root.

---

### Pattern 2: Claude Client (`claude_client.py`)

**Environment Variables**:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxx
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
```

**Loading Pattern** (simple, assumes caller loads .env):
```python
import os

def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
    self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    self.base_url = base_url or os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
```

**Why This Pattern**: Assumes test scripts or main entry point calls `load_dotenv()` before initialization.

---

### Pattern 3: FalkorDB (`falkordb_mcp_server_fastmcp.py`, `graphiti_service.py`)

**Environment Variables**:
```bash
FALKORDB_URI=rediss://gateway.xxxxx.falkordb.cloud:6379
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password
FALKORDB_DATABASE=sports_intelligence
```

**Loading Pattern** (project root aware):
```python
from pathlib import Path
from dotenv import load_dotenv
import os

# Load from project root or current directory
project_root = Path(__file__).parent.parent
for env_file in [project_root / '.env', Path('.env')]:
    if env_file.exists():
        load_dotenv(env_file)
        break

# Get connection parameters
uri = os.getenv("FALKORDB_URI")
username = os.getenv("FALKORDB_USER", "falkordb")
password = os.getenv("FALKORDB_PASSWORD")
database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

# Connect using native Python client
from falkordb import FalkorDB
db = FalkorDB(host=host, port=port, username=username, password=password, ssl=True)
g = db.select_graph(database)
```

**Why This Pattern**: Centralized configuration from project root `.env`.

---

### Pattern 4: Graphiti Service (most sophisticated)

**Loading Pattern** (multiple fallbacks + manual parsing):
```python
from pathlib import Path
from dotenv import load_dotenv
import os

# Try multiple locations
project_root = Path(__file__).parent.parent
env_files = [
    project_root / '.env.local',      # Highest priority
    project_root / '.env',            # Fallback
    Path('.env.local'),               # Current directory
    Path('.env')                      # Current directory fallback
]

for env_file in env_files:
    if env_file.exists():
        load_dotenv(env_file)
        break

# Also manual parsing fallback if dotenv unavailable
with open(env_file) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()
```

**Why This Pattern**: Maximum robustness for production deployment.

---

## Current .env Structure

### Project Root (`/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env`)

Contains all environment variables for the entire project:
```bash
# Claude API Configuration (for Dossier Generation)
ANTHROPIC_API_KEY=sk-ant-api03-[REDACTED]
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# FalkorDB Configuration
FALKORDB_URI=rediss://gateway.xxxxx.falkordb.cloud:6379
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password
FALKORDB_DATABASE=sports_intelligence

# BrightData Configuration
BRIGHTDATA_API_TOKEN=your-token

# Additional services
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
PERPLEXITY_API_KEY=...
```

### Backend Directory (`backend/`)

**No `.env` file** → scripts load from parent project root `.env`.

This is intentional - centralized configuration for all services.

---

## Integration Strategy

### Step 1: Update `dossier_data_collector.py`

**Current State**: Skeleton with TODO placeholders

**Required Changes**:

1. **Add .env loading** (use BrightData SDK pattern for `backend/` scripts)
2. **Implement FalkorDB connection** (use graphiti_service.py pattern)
3. **Implement BrightData SDK integration** (use existing client)
4. **Implement Hypothesis Manager integration** (use existing manager)

### Step 2: Update `dossier_generator.py`

**Current State**: Generates dossiers with placeholder prompts

**Required Changes**:

1. **Import `DossierDataCollector`**
2. **Call `collector.collect_all()` before section generation**
3. **Inject collected data into prompts**
4. **Use real entity metadata in templates**

### Step 3: Update `dossier_templates.py`

**Current State**: Generic prompt templates

**Required Changes**:

1. **Add `{entity_founded}`, `{entity_stadium}`, etc. placeholders**
2. **Add `{recent_news}` placeholder with scraped content**
3. **Add `{hypothesis_signals}` placeholder with discovered signals**
4. **Update prompts to use real data instead of placeholders**

---

## Implementation Plan

### Phase 1: FalkorDB Integration (2 hours)

**File**: `dossier_data_collector.py`

**Tasks**:
1. Add .env loading (lines 1-50)
2. Implement `_connect_falkordb()` method
3. Implement `_get_entity_metadata()` with real Cypher query
4. Test with Arsenal FC to get founded=1886, stadium="Emirates Stadium"

**Query Template**:
```cypher
MATCH (e:Entity {id: $entity_id})
RETURN e.id AS id,
       e.name AS name,
       e.type AS type,
       e.founded AS founded,
       e.stadium AS stadium,
       e.capacity AS capacity,
       e.headquarters AS headquarters,
       e.website AS website,
       e.league AS league,
       e.employees AS employees
```

**Success Criteria**:
- ✅ Connects to FalkorDB using FALKORDB_* env vars
- ✅ Returns Arsenal FC founded=1886, stadium="Emirates Stadium"
- ✅ Handles missing entities gracefully (returns None)

---

### Phase 2: BrightData SDK Integration (2 hours)

**File**: `dossier_data_collector.py`

**Tasks**:
1. Implement `_connect_brightdata()` method
2. Implement `_get_scraped_content()` with:
   - Official site search + scrape
   - Recent news search
   - Press releases search
3. Return structured `ScrapedContent` objects

**Code Template**:
```python
async def _get_scraped_content(self, entity_id: str, entity_name: str):
    scraped = []

    # 1. Search for official website
    search_results = await self.brightdata_client.search_engine(
        query=f'"{entity_name}" official website',
        engine="google",
        num_results=5
    )

    # 2. Scrape official site
    official_url = self._extract_official_site_url(search_results["results"])
    site_content = await self.brightdata_client.scrape_as_markdown(official_url)

    scraped.append(ScrapedContent(
        url=official_url,
        source_type="OFFICIAL_SITE",
        title=f"{entity_name} Official Site",
        markdown_content=site_content.get("content", ""),
        word_count=len(site_content.get("content", "").split())
    ))

    # 3. Search for recent news
    news_results = await self.brightdata_client.search_engine(
        query=f'"{entity_name}" recent news',
        engine="google",
        num_results=5
    )

    for item in news_results.get("results", [])[:3]:
        scraped.append(ScrapedContent(
            url=item.get("url", ""),
            source_type="NEWS_ARTICLE",
            title=item.get("title", ""),
            content=item.get("snippet", "")
        ))

    return scraped
```

**Success Criteria**:
- ✅ Scrapes arsenal.com official site
- ✅ Finds 3-5 recent Arsenal news articles
- ✅ Returns structured ScrapedContent objects

---

### Phase 3: Hypothesis Manager Integration (1 hour)

**File**: `dossier_data_collector.py`

**Tasks**:
1. Implement `_connect_hypothesis_manager()` method
2. Implement `_get_hypothesis_signals()` using existing manager
3. Return high-confidence signals (confidence >= 0.30)

**Code Template**:
```python
async def _get_hypothesis_signals(self, entity_id: str, entity_name: str):
    try:
        hypotheses = await self.hypothesis_manager.get_hypotheses(entity_id)

        signals = []
        for h in hypotheses:
            if h.confidence >= 0.30 or h.status == "ACTIVE":
                signals.append(HypothesisSignal(
                    hypothesis_id=h.hypothesis_id,
                    category=h.category,
                    statement=h.statement,
                    confidence=h.confidence,
                    status=h.status,
                    evidence_count=h.iterations_accepted + h.iterations_weak_accept,
                    discovered_at=h.last_updated
                ))

        signals.sort(key=lambda s: s.confidence, reverse=True)
        return signals

    except Exception as e:
        logger.error(f"❌ Hypothesis Manager query failed: {e}")
        return []
```

**Success Criteria**:
- ✅ Returns Arsenal FC hypotheses from HypothesisManager
- ✅ Shows confidence scores and categories
- ✅ Sorted by confidence (highest first)

---

### Phase 4: Update Dossier Generator (2 hours)

**File**: `dossier_generator.py`

**Tasks**:
1. Import `DossierDataCollector`
2. Initialize collector in `__init__`
3. Call `collector.collect_all()` before section generation
4. Inject collected data into prompts

**Code Template**:
```python
async def generate_dossier(self, entity_id: str, entity_name: str, priority_score: int = 50):
    """Generate complete dossier based on priority tier"""

    # Collect data from all sources
    collector = DossierDataCollector()
    entity_data = await collector.collect_all(entity_id, entity_name)

    # Extract metadata for prompts
    entity_metadata = entity_data.get("entity_metadata", {})
    entity_founded = entity_metadata.get("founded", "Unknown")
    entity_stadium = entity_metadata.get("stadium", "Unknown")

    # Generate sections with real data
    for section_id in sections_to_generate:
        prompt = self._build_prompt_with_data(
            section_id=section_id,
            entity_name=entity_name,
            entity_founded=entity_founded,
            entity_stadium=entity_stadium,
            recent_news=entity_data.get("recent_news", []),
            hypothesis_signals=entity_data.get("hypothesis_signals", [])
        )

        section = await self._generate_section(section_id, prompt)
        dossier.sections.append(section)
```

**Success Criteria**:
- ✅ Prompts include real Arsenal FC data
- ✅ Generated sections use entity-specific information
- ✅ No more "[year if available]" placeholders

---

### Phase 5: Update Prompt Templates (1 hour)

**File**: `dossier_templates.py`

**Tasks**:
1. Add placeholders for entity metadata
2. Add placeholders for scraped content
3. Add placeholders for hypothesis signals
4. Update prompts to use real data

**Template Example**:
```python
HAiku_TEMPLATES = {
    "core_info_template": """
Extract core information about {entity_name}:

Known Information:
- Founded: {entity_founded}
- Stadium: {entity_stadium}
- Website: {entity_website}
- League: {entity_league}

Based on this information, provide a structured summary of the entity's core details.

Return JSON with fields: founded, stadium, employees, website, league
"""
}
```

**Success Criteria**:
- ✅ Templates use real data placeholders
- ✅ No more generic "TechFlow Inc." examples
- ✅ Generated content is entity-specific

---

## Testing Strategy

### Test 1: FalkorDB Integration
```bash
cd backend
python -c "
from dossier_data_collector import DossierDataCollector
import asyncio

async def test():
    collector = DossierDataCollector()
    metadata = await collector._get_entity_metadata('arsenal-fc')
    print(f'Arsenal FC Founded: {metadata.get(\"founded\")}')
    print(f'Stadium: {metadata.get(\"stadium\")}')

asyncio.run(test())
"
```

**Expected Output**:
```
Arsenal FC Founded: 1886
Stadium: Emirates Stadium
```

---

### Test 2: BrightData Integration
```bash
cd backend
python -c "
from dossier_data_collector import DossierDataCollector
import asyncio

async def test():
    collector = DossierDataCollector()
    scraped = await collector._get_scraped_content('arsenal-fc', 'Arsenal FC')
    print(f'Scraped {len(scraped)} items')
    for item in scraped[:3]:
        print(f'  - {item.source_type}: {item.title[:60]}...')

asyncio.run(test())
"
```

**Expected Output**:
```
Scraped 4 items
  - OFFICIAL_SITE: Arsenal FC - Official Website...
  - NEWS_ARTICLE: Arsenal sign new midfielder...
  - NEWS_ARTICLE: Arsenal announce stadium expansion...
```

---

### Test 3: Full Dossier with Real Data
```bash
cd backend
python test_arsenal_dossier_with_real_data.py
```

**Expected Output**:
```
# Arsenal FC - Entity Dossier

## Basic Information
- Founded: 1886
- Stadium: Emirates Stadium
- Website: https://www.arsenal.com
- League: Premier League

## Recent News
- Arsenal sign new striker (Transfer News, 2 days ago)
- Emirates Stadium expansion approved (Club Announcement, 1 week ago)

## Hypothesis Signals
- [Digital Infrastructure] 0.72 confidence: Entity preparing CRM procurement
- [Leadership Changes] 0.65 confidence: New CTO appointment signals digital transformation
```

---

## Success Criteria

- [ ] FalkorDB integration working (entity metadata retrieved)
- [ ] BrightData SDK integration working (official site scraped, news found)
- [ ] Hypothesis Manager integration working (signals retrieved with confidence)
- [ ] Dossier generator uses real data (no more placeholders)
- [ ] Prompts include entity-specific information
- [ ] Generated dossiers are actually useful (not generic)

---

## Next Steps

1. **Implement FalkorDB integration** (2 hours)
2. **Implement BrightData integration** (2 hours)
3. **Implement Hypothesis Manager integration** (1 hour)
4. **Update dossier generator to use collected data** (2 hours)
5. **Update prompt templates** (1 hour)
6. **Test end-to-end with Arsenal FC** (1 hour)

**Total Estimated Time**: 9 hours

**Priority**: HIGH - This transforms the dossier system from "proof of concept" to "production-ready intelligence platform."

---

## Files to Modify

1. **`backend/dossier_data_collector.py`** - Implement TODO methods
2. **`backend/dossier_generator.py`** - Use collected data in prompts
3. **`backend/dossier_templates.py`** - Add data placeholders to templates
4. **`backend/test_arsenal_with_real_data.py`** (NEW) - Integration test

---

## Related Documentation

- **`BATCH-PROCESSING-TEST-RESULTS.md`** - Current system status (80% success with placeholders)
- **`DOSSIER-TEST-RESULTS.md`** - Initial test results
- **`ENTITY-DOSSIER-SYSTEM-COMPLETE.md`** - System architecture documentation

---

**Status**: Ready for implementation
**Next Step**: Begin Phase 1 (FalkorDB integration)
