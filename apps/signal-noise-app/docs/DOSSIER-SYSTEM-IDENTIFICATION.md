# Dossier System Identification Guide

## Overview

This document explains how to identify the **real production dossier system** versus test/placeholder implementations, and documents how we discovered the difference during February 2026 testing.

---

## The Discovery Story (February 2026)

### The Problem

While testing dossier generation for scaling to 3000+ entities, we discovered that test scripts were creating **placeholder dossiers** with critical issues:
- Generic names like "Chairperson", "CTO", "Head Coach" instead of real people
- Massive file sizes (429KB+) due to full Wikipedia dumps
- N/A values throughout the dossier UI
- Single-source data (Wikipedia only)

### How We Found the Real System

1. **User Observation**: "wait, dossier was better than this, search the dossier generation to see if we have the best one"

2. **File Search**: Searched the codebase and found two systems:
   - Test scripts in `/tmp/` and custom batch scripts
   - **Real system**: `backend/dossier_generator.py` + `backend/dossier_data_collector.py`

3. **Verification**: Tested the real system's `collect_leadership()` method and confirmed:
   - **18 real decision makers** found across 3 entities
   - Actual names: "Billy Hogan CEO", "Jenny Beacham CFO", "Tom Glick President"
   - Only ~16K chars per entity (not 500K Wikipedia dumps)
   - Multiple sources: job_postings, linkedin, press_releases, official_site

### The BrightData SDK Fix

During testing, we also fixed a critical bug in `backend/brightdata_sdk_client.py`:

```python
# BEFORE (crashed when result.data was None)
html_content = result.data if hasattr(result, 'data') else ""
soup = BeautifulSoup(html_content, 'html.parser')  # Crash!

# AFTER (fixed)
html_content = (result.data if hasattr(result, 'data') and result.data is not None else "")
if not html_content:
    return {"status": "error", "error": "No content returned"}
soup = BeautifulSoup(html_content, 'html.parser')
```

This fix was applied at lines 157, 230, and 317 in `brightdata_sdk_client.py`.

---

## How to Identify the Real System

### File Locations

| System | File Path | Purpose |
|--------|-----------|---------|
| **REAL System** | `backend/dossier_generator.py` | Main entry point with `EntityDossierGenerator` and `UniversalDossierGenerator` |
| **REAL System** | `backend/dossier_data_collector.py` | Has `collect_leadership()` method for real decision maker names |
| **REAL System** | `backend/brightdata_sdk_client.py` | Official BrightData SDK wrapper (fixed) |
| Test Scripts | `/tmp/test_*.py` | Placeholder generators (DO NOT USE) |
| Test Scripts | Custom batch scripts | Not production-ready |

### Key Characteristics

#### Real Production System

| Characteristic | Evidence |
|----------------|----------|
| **Class Names** | `EntityDossierGenerator`, `UniversalDossierGenerator`, `DossierDataCollector` |
| **Method Signature** | `async def collect_leadership(self, entity_id: str, entity_name: str) -> Dict[str, Any]` |
| **Data Size** | ~16K chars per entity (focused, no Wikipedia dumps) |
| **Decision Makers** | Real names with roles: "Billy Hogan: Chief Executive Officer" |
| **Confidence Scores** | 80-100% for each person found |
| **Sources Used** | `['job_postings', 'linkedin', 'press_releases', 'official_site']` |
| **Fresh Signals** | Count of recent hiring/appointment activity |
| **Model Cascade** | Haiku (80%), Sonnet (15%), Opus (5%) for cost optimization |

#### Test/Placeholder System (RED FLAGS)

| Red Flag | Why It's Bad |
|----------|--------------|
| **File size >100KB** | Indicates full Wikipedia dump (429KB+ seen) |
| **Generic names** | "Chairperson", "CTO", "Head Coach" are placeholders |
| **Single source** | Wikipedia-only data lacks verification |
| **N/A values in UI** | Missing real data |
| **Low confidence scores** | <50% indicates lack of real evidence |
| **Files in /tmp/** | Temporary test location, not production |

---

## Quick Verification Checklist

Before running dossier generation at scale:

- [ ] Using `backend/dossier_generator.py` (not a custom test script)
- [ ] Using `DossierDataCollector` class for data collection
- [ ] Expected file size: 10-50KB per entity (not 400KB+)
- [ ] Real decision maker names expected (e.g., "Billy Hogan", not "CEO")
- [ ] Multiple sources in output: job_postings, linkedin, press_releases, official_site
- [ ] Confidence scores >80% for high-quality data

---

## Example Output Comparison

### Real System Output (Liverpool FC)

```json
{
  "decision_makers": [
    {"name": "Billy Hogan", "role": "Chief Executive Officer", "confidence": 100},
    {"name": "Jenny Beacham", "role": "Chief Financial Officer", "confidence": 100},
    {"name": "Jonathan Bamber", "role": "Chief Legal and External Affairs Officer", "confidence": 100}
  ],
  "sources_used": ["job_postings", "linkedin", "press_releases", "official_site"],
  "fresh_signals_count": 7,
  "raw_data_size": 18409
}
```

### Test/Placeholder Output (BAD)

```json
{
  "decision_makers": [
    {"name": "Chairperson", "role": "Board", "confidence": 50},
    {"name": "CTO", "role": "Technology", "confidence": 40}
  ],
  "sources_used": ["wikipedia"],
  "fresh_signals_count": 0,
  "raw_data_size": 429000  // Wikipedia dump!
}
```

---

## How to Use the Real System

### Basic Usage

```python
from backend.dossier_data_collector import DossierDataCollector

async def collect_entity_leadership(entity_id: str, entity_name: str):
    collector = DossierDataCollector()
    await collector._connect_brightdata()

    leadership = await collector.collect_leadership(entity_id, entity_name)

    print(f"Found {len(leadership['decision_makers'])} decision makers")
    for dm in leadership['decision_makers']:
        print(f"  • {dm['name']}: {dm['role']} (confidence: {dm['confidence']})")

    return leadership
```

### Full Dossier Generation

```python
from backend.dossier_generator import EntityDossierGenerator

async def generate_entity_dossier(entity_id: str, entity_name: str):
    generator = EntityDossierGenerator()
    dossier = await generator.generate_entity_dossier(entity_id, entity_name)

    # Returns complete dossier with:
    # - 11 sections (Leadership, Technology, Procurement, etc.)
    # - Real decision maker names
    # - No Wikipedia dumps
    # - Tier-based scoring (BASIC, STANDARD, PREMIUM)

    return dossier
```

---

## Environment Requirements

The real system requires these environment variables in `.env`:

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
```

**Critical Note**: If you add/update environment variables, **restart the Python backend** to pick up changes.

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Time per entity | 30-60 seconds |
| Data sources | 5+ (job_postings, linkedin, press_releases, official_site, wikipedia) |
| Claude calls | 3-5 per entity (model cascade for cost optimization) |
| Output size | 10-50KB per entity |
| Decision makers found | 5-15 per entity (varies by organization size) |

---

## Common Pitfalls to Avoid

1. **Using test scripts**: Any script in `/tmp/` or custom batch scripts that don't import `dossier_generator.py`

2. **Not checking content**: HTTP 200 doesn't mean real data—verify actual dossier content has real names

3. **Missing environment variables**: Backend must be restarted after `.env` changes

4. **Wikipedia dumps**: Files >100KB indicate the scraper stored full Wikipedia content instead of extracting

5. **Single-source reliance**: Real system cross-references multiple sources for verification

---

## LinkedIn Profile Extraction (February 2026)

### Feature Overview

The dossier system now automatically includes LinkedIn profile URLs for decision makers. This was added to enhance outreach capabilities by providing direct links to individual profiles.

### Implementation

**File**: `backend/dossier_data_collector.py`

**Method**: `_search_linkedin_profiles()` (lines ~2350+)

The method:
1. Takes each decision maker's name + entity name
2. Searches Google with: `"{name}" "{entity_name}" site:linkedin.com/in`
3. Extracts the first valid `linkedin.com/in/` URL
4. Adds `linkedin_url` field to decision maker object

### Usage

Run from project root:

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
        print(f\"{dm['name']}: {dm.get('linkedin_url', 'No LinkedIn')}\")

asyncio.run(test())
"
```

### Test Results (Coventry City FC)

| Decision Maker | Role | LinkedIn Profile |
|----------------|------|------------------|
| David Boddy | CEO | ✅ https://uk.linkedin.com/in/dave-boddy-698968a9 |
| John Taylor | COO | ✅ https://uk.linkedin.com/in/john-taylor-024b022a |
| Michael Stanford | Commercial Director | ✅ https://uk.linkedin.com/in/michael-stanford-1b98a029 |

**Success Rate**: ~60% (3-5 profiles found)

### Frontend Display

**File**: `src/components/entity-dossier/ClubDossier.tsx` (line ~794)

```tsx
{person.linkedin_url && (
  <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
     className="text-xs text-gray-500 hover:text-blue-600">
    View LinkedIn →
  </a>
)}
```

The Leadership tab displays clickable "View LinkedIn →" links next to each decision maker with a profile.

### Important: Running from Correct Directory

**❌ WRONG** (from `backend/`):
```bash
cd backend
python3 test_script.py  # ImportError: No module named 'backend'
```

**✅ CORRECT** (from project root):
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 your_script.py
```

The import `from backend.brightdata_sdk_client import BrightDataSDKClient` requires the script to run from project root where `backend/` is a subdirectory.

---

## Related Files

- `backend/dossier_generator.py` - Main generator with EntityDossierGenerator
- `backend/dossier_data_collector.py` - DossierDataCollector with collect_leadership()
- `backend/brightdata_sdk_client.py` - SDK wrapper (fixed None handling)
- `backend/claude_client.py` - Model cascade (Haiku → Sonnet → Opus)
- `docs/DOSSIER-SCALABLE-SYSTEM-IMPLEMENTATION.md` - Scalable implementation guide
- `DOSSIER-SCALABLE-SYSTEM-IMPLEMENTATION.md` - Root-level implementation doc

---

## Document Metadata

- **Created**: 2025-02-25
- **Context**: February 2026 dossier system testing and optimization
- **Purpose**: Prevent future confusion between real and test dossier systems
- **Related Issue**: Discovered during scaling tests for 3000+ entity generation
