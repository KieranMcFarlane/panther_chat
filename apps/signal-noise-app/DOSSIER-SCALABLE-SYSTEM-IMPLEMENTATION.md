# Phase 0: Scalable Dossier Generation System - Implementation Complete

**Date**: 2026-02-22
**Status**: ✅ Complete

## Summary

Implemented a scalable dossier generation system that supports 3,000+ entities with question-driven prompts, structured data specifications, and batch processing capabilities.

## Created Files

### Backend Python Modules

| File | Purpose | Lines |
|------|---------|-------|
| `backend/dossier_section_prompts.py` | Question-driven prompts for 11 dossier sections | ~1,200 |
| `backend/dossier_data_specs.py` | CSV schema definitions for all input data | ~700 |
| `backend/connections_analyzer.py` | Network analysis for Connections tab | ~750 |
| `backend/batch_dossier_generator.py` | Parallel dossier generation for 3,000+ entities | ~650 |

### CSV Templates

| File | Purpose |
|------|---------|
| `data/dossier_templates/yp_team.csv` | Yellow Panther UK team (static reference) |
| `data/dossier_templates/bridge_contacts.csv` | Tier 2 network contacts |
| `data/dossier_templates/leadership_template.csv` | Target entity personnel format |
| `data/dossier_templates/digital_stack_template.csv` | Technology platform tracking |
| `data/dossier_templates/opportunities_template.csv` | Partnership opportunity tracking |
| `data/dossier_templates/news_template.csv` | Recent news aggregation |
| `data/dossier_templates/target_personnel_template.csv` | LinkedIn URLs for connections |
| `data/dossier_templates/README.md` | Documentation for template usage |

## Dossier Section Breakdown

| Section | Tier | Questions | Data Sources |
|---------|------|-----------|--------------|
| 1. Core Information | BASIC | Official name, founded, venue, website, employees | core_info.csv |
| 2. Digital Transformation | STANDARD | Digital maturity, tech stack, vendors, gaps, opportunities | digital_stack.csv |
| 3. AI Reasoner Assessment | PREMIUM | Overall assessment, YP opportunity, risks, advantages | yp_opportunity.csv |
| 4. Strategic Opportunities | PREMIUM | Immediate, medium, long-term opportunities with budgets | opportunities.csv |
| 5. Key Decision Makers | STANDARD | Names, roles, influence, decision criteria | leadership.csv |
| 6. Connections Analysis | PREMIUM | YP team connections, mutual contacts, bridge paths | yp_team.csv + target_personnel.csv |
| 7. Recent News | BASIC | Relevant news with signal tagging | news.csv |
| 8. Current Performance | BASIC | League position, form, statistics | performance.csv |
| 9. Outreach Strategy | STANDARD | Approach type, channels, personalization, anti-patterns | outreach.csv |
| 10. Risk Assessment | PREMIUM | Implementation risks, competitive landscape | risk_assessment.csv |
| 11. League Context | BASIC | Standing, competitors, positioning | league_context.csv |

## Yellow Panther Team (for Connections Tab)

| Name | Role | LinkedIn | Weight |
|------|------|---------|--------|
| Stuart Cope | Co-Founder & COO | https://uk.linkedin.com/in/stuart-cope-54392b16/ | 1.5 |
| Gunjan Parikh | Founder & CEO | https://uk.linkedin.com/in/gunjan-parikh/ | 1.3 |
| Andrew Rapley | Head of Projects | https://uk.linkedin.com/in/andrew-rapley/ | 1.2 |
| Sarfraz Hussain | Head of Strategy | https://uk.linkedin.com/in/sarfraz-hussain/ | 1.2 |
| Elliott Hillman | Senior Client Partner | https://uk.linkedin.com/in/elliott-hillman/ | 1.2 |

## Usage Examples

### 1. Generate Single Entity Dossier

```bash
cd backend
python -c "
from dossier_generator import UniversalDossierGenerator
from claude_client import ClaudeClient
import asyncio

async def main():
    claude = ClaudeClient()
    generator = UniversalDossierGenerator(claude)
    dossier = await generator.generate_universal_dossier(
        entity_id='arsenal-fc',
        entity_name='Arsenal FC',
        priority_score=99
    )
    print(f'Generated {len(dossier.sections)} sections')

asyncio.run(main())
"
```

### 2. Analyze Connections (with YP team data)

```bash
cd backend
python connections_analyzer.py \
    --entity-id arsenal-fc \
    --entity-name "Arsenal FC" \
    --target-csv data/dossier_templates/target_personnel_template.csv \
    --output connections_arsenal.json
```

### 3. Batch Generate Dossiers

```bash
cd backend
python batch_dossier_generator.py \
    --entity-ids arsenal-fc,chelsea-fc,liverpool-fc \
    --tier PREMIUM \
    --max-concurrent 3
```

### 4. Batch from FalkorDB (all entities)

```bash
cd backend
python batch_dossier_generator.py \
    --tier AUTO \
    --max-concurrent 5 \
    --stale-days 7
```

### 5. Batch from CSV List

```bash
cd backend
python batch_dossier_generator.py \
    --input entity_list.csv \
    --tier STANDARD \
    --output-dir data/dossiers
```

## Key Features Implemented

### 1. Question-Driven Prompts
- Each of 11 sections defined by specific questions to answer
- Prompts require entity-specific data (avoiding generic templates)
- Signal tagging: [PROCUREMENT], [CAPABILITY], [TIMING], [CONTACT]
- Confidence scoring with meaning, why, benchmark, action

### 2. Structured Data Specifications
- CSV schemas for all input data types
- BrightData query templates for web scraping
- Data freshness requirements (7-365 days)
- Tier assignments (BASIC/STANDARD/PREMIUM)

### 3. Connections Analysis
- Per-YP-member connection analysis
- Mutual connection detection
- Tier 2 bridge path analysis
- Recommended introduction strategy

### 4. Batch Processing
- Parallel dossier generation (configurable concurrency)
- Incremental updates (skip fresh dossiers)
- Progress tracking and cost estimation
- Error handling and retry logic

## Data Collection Queries (by Section)

| Section | BrightData Queries |
|---------|-------------------|
| Core Info | `{entity} official website`, `{entity} founded history` |
| Digital | `{entity} technology stack CRM`, `{entity} website platform` |
| Leadership | `{entity} Commercial Director name`, `{entity} CEO` |
| News | `{entity} news 2025`, `{entity} press release technology` |
| Performance | `{entity} Premier League table 2025` |
| Opportunities | `{entity} digital transformation projects` |
| Connections | `Stuart Cope connections to {entity}`, `{yp_member} {target_person} LinkedIn` |

## Cost Estimates

| Tier | Sections | Time | Cost per Entity |
|------|----------|------|------------------|
| BASIC | 3-4 | ~5s | $0.0004 |
| STANDARD | 7-8 | ~15s | $0.0095 |
| PREMIUM | 11 | ~30s | $0.057 |

**Batch estimate for 3,000 entities**: ~$26 total, ~14.5 hours (with 10 concurrent)

## Next Steps

1. **Populate CSV templates** with actual entity data
2. **Test single entity dossier** with all input data provided
3. **Run batch generation** for pilot set (10-50 entities)
4. **Validate output quality** - ensure entity-specific content
5. **Scale to full 3,000+ entities**

## Integration Points

- **FalkorDB**: Entity metadata source
- **BrightData SDK**: Web scraping for real-time data
- **Claude Agent SDK**: AI generation with model cascade
- **Entity Page UI**: Display dossiers with tab navigation

## Files Created

```
backend/
├── dossier_section_prompts.py      (NEW - 11 section prompts)
├── dossier_data_specs.py            (NEW - 12 data specs)
├── connections_analyzer.py           (NEW - network analysis)
└── batch_dossier_generator.py        (NEW - batch processing)

data/dossier_templates/
├── yp_team.csv                       (NEW - YP team static)
├── bridge_contacts.csv               (NEW - Tier 2 network)
├── leadership_template.csv           (NEW - personnel format)
├── digital_stack_template.csv        (NEW - tech format)
├── opportunities_template.csv        (NEW - opportunities format)
├── news_template.csv                 (NEW - news format)
├── target_personnel_template.csv     (NEW - connections format)
└── README.md                          (NEW - documentation)
```
