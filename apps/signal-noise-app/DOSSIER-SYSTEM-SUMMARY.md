# Dossier System Summary

> **Quick reference** for the Signal Noise App's dossier system. For complete details, see [`docs/DOSSIER-SYSTEM-COMPLETE-GUIDE.md`](docs/DOSSIER-SYSTEM-COMPLETE-GUIDE.md).

---

## Quick Overview

The dossier system generates **11-section intelligence reports** on sports entities using:
- **5+ data sources**: Wikipedia, official sites, job postings, LinkedIn, press releases
- **3-pass validation**: Rule filtering → LLM cross-check → Final confirmation
- **Model cascade**: Haiku (80%), Sonnet (15%), Opus (5%) for 92% cost savings
- **Tier system**: BASIC (3 sections), STANDARD (8 sections), PREMIUM (11 sections)

---

## The 11 Sections

| # | Section | Tier | Model | Status |
|---|---------|------|-------|--------|
| 1 | Core Information | BASIC | Haiku | ✅ Real data |
| 2 | Digital Transformation | STANDARD | Sonnet | ✅ Real + LLM |
| 3 | AI Reasoner Assessment | PREMIUM | Sonnet | ✅ LLM analysis |
| 4 | Strategic Opportunities | PREMIUM | Sonnet | ✅ Real + LLM |
| 5 | Key Decision Makers | STANDARD | Sonnet | ✅ Real names |
| 6 | Connections Analysis | PREMIUM | Opus | ⚠️ Needs YP CSV |
| 7 | Recent News | BASIC | Haiku | ✅ Real + LLM |
| 8 | Current Performance | BASIC | Haiku | ✅ Real data |
| 9 | Outreach Strategy | STANDARD | Sonnet | ✅ LLM-generated |
| 10 | Risk Assessment | PREMIUM | Sonnet | ✅ LLM-generated |
| 11 | League Context | BASIC | Haiku | ✅ Real data |

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/dossier_generator.py` | Main generator |
| `backend/dossier_data_collector.py` | Data collection with `collect_leadership()` |
| `backend/brightdata_sdk_client.py` | Web scraping SDK |
| `backend/dossier_section_prompts.py` | 11 section prompts |
| `backend/claude_client.py` | Model cascade (Haiku→Sonnet→Opus) |
| `src/components/entity-dossier/EnhancedClubDossier.tsx` | Frontend display |

---

## Quick Test Commands

```bash
# Test leadership collection
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python3 -c "
import asyncio
from backend.dossier_data_collector import DossierDataCollector

async def test():
    collector = DossierDataCollector()
    result = await collector.collect_leadership('coventry-city-fc', 'Coventry City FC')
    for dm in result['decision_makers']:
        print(f\"{dm['name']}: {dm['role']} - {dm.get('linkedin_url', 'No LinkedIn')}\")
asyncio.run(test())
"
```

---

## Tier Costs

| Tier | Sections | Time | Cost |
|------|----------|------|------|
| BASIC | 3 | ~5s | ~$0.0004 |
| STANDARD | 8 | ~15s | ~$0.0095 |
| PREMIUM | 11 | ~30s | ~$0.057 |

**Cost savings**: 92% vs Sonnet-only

---

## What's Working

✅ Multi-source scraping (5+ sources)
✅ Ralph Loop 3-pass validation
✅ Core entity fields (founded, stadium, capacity, etc.)
✅ Confidence scoring per field
✅ Model cascade optimization
✅ 11-section generation
✅ Tier-based scoring
✅ Batch processing (3,000+ entities)
✅ LinkedIn profile extraction (~60% success)
✅ Frontend display with tabbed interface
✅ Supabase caching (7-day expiry)

---

## Missing (Minor)

⚠️ Yellow Panther team CSV for connections analysis
⚠️ Full Ralph Loop signal validation integration

---

## Documentation

- **Complete Guide**: [`docs/DOSSIER-SYSTEM-COMPLETE-GUIDE.md`](docs/DOSSIER-SYSTEM-COMPLETE-GUIDE.md)
- **Real vs Test**: [`docs/DOSSIER-SYSTEM-IDENTIFICATION.md`](docs/DOSSIER-SYSTEM-IDENTIFICATION.md)
- **Quick Reference**: [`DOSSIER-SYSTEM-QUICK-REF.md`](DOSSIER-SYSTEM-QUICK-REF.md)
