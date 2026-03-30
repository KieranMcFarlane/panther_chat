# Enhanced Dossier System - Quick Start Guide

## Overview

The enhanced dossier system provides three major improvements:

1. **Real-Time Multi-Source Intelligence** - Scrapes official websites, job postings, press releases, and LinkedIn
2. **Contextual Score Explanations** - Every score includes meaning, why, benchmark, and action
3. **Outreach Strategy with Conversation Trees** - Structured conversation flows for sales teams

## Quick Start

### 1. Test the Enhanced System

Run the test script:
```bash
python test_enhanced_dossier.py
```

Expected output:
```
✅ PASS: Multi-Source Collection
✅ PASS: Score Context Template
✅ PASS: Outreach Strategy Template
✅ PASS: Dossier Generator Sections
```

### 2. Generate an Enhanced Dossier

```python
import asyncio
from backend.dossier_generator import UniversalDossierGenerator
from backend.claude_client import ClaudeClient

async def generate_dossier():
    generator = UniversalDossierGenerator(ClaudeClient())

    dossier = await generator.generate_universal_dossier(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        priority_score=70  # STANDARD tier (includes outreach strategy)
    )

    # Check sections
    sections = [s.id for s in dossier.sections]
    print("Sections:", sections)

    # Access outreach strategy
    if 'outreach_strategy' in sections:
        strategy = next(s for s in dossier.sections if s.id == 'outreach_strategy')
        print("Conversation Trees:", len(strategy.content.get('conversation_trees', [])))

asyncio.run(generate_dossier())
```

### 3. Use Frontend Components

#### Display Score with Context

```tsx
import { ScoreWithContext } from '@/components/entity-dossier/ScoreWithContext';

<ScoreWithContext
  label="Digital Maturity"
  score={72}
  meaning="This entity has advanced digital capabilities with integrated systems"
  why="Recent CRM platform announcement, active social media, job postings"
  benchmark="Above industry average (most clubs: 55-65)"
  action="Position Yellow Panther as strategic partner for optimization"
/>
```

#### Display Conversation Trees

```tsx
import { ConversationTreesViewer } from '@/components/entity-dossier/ConversationTreeViewer';

<ConversationTreesViewer
  trees={conversationTrees}
  onSendMessage={(message, channel) => {
    console.log(`Sending ${channel}: ${message}`);
  }}
/>
```

## API Endpoints

### Backend: Outreach Intelligence

```bash
curl -X POST http://localhost:8002/api/dossier-outreach-intelligence \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "arsenal-fc",
    "entity_name": "Arsenal FC",
    "signals": [],
    "hypotheses": []
  }'
```

Response:
```json
{
  "entity_id": "arsenal-fc",
  "entity_name": "Arsenal FC",
  "approach_type": "cold",
  "mutual_connections": [],
  "conversation_starters": [...],
  "current_providers": [...],
  "recommended_approach": {
    "primary_channel": "email",
    "messaging_angle": "...",
    "timing": "Tuesday-Thursday, mid-morning"
  },
  "confidence": 30,
  "confidence_explanation": "Limited contextual information...",
  "metadata": {
    "generated_at": "2025-01-01T00:00:00Z",
    "data_sources": ["BrightData SDK", "LinkedIn Profiler"],
    "freshness": "real-time"
  }
}
```

### Frontend: Outreach Intelligence

```bash
curl -X POST http://localhost:3005/api/outreach-intelligence \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "arsenal-fc",
    "entity_name": "Arsenal FC",
    "signals": [],
    "hypotheses": []
  }'
```

## Dossier Tiers

| Tier | Priority Score | Sections | Includes Outreach? |
|------|--------------|----------|-------------------|
| BASIC | 0-20 | 3 sections | No |
| STANDARD | 21-50 | 7 sections | Yes |
| PREMIUM | 51-100 | 11 sections | Yes |

## Cost Impact

- **Per Dossier**: +$0.01-0.03 additional BrightData SDK cost
- **Sources Scraped**: Official site, job postings, press releases, LinkedIn
- **Time Impact**: +10-15 seconds per dossier

## File Structure

### Backend
```
backend/
├── dossier_data_collector.py          # Enhanced with multi-source collection
├── dossier_generator.py               # Enhanced with outreach_strategy section
├── universal_club_prompts.py          # Enhanced with score context template
├── linkedin_profiler.py               # Enhanced with provider extraction
└── dossier_outreach_api.py            # NEW: Outreach intelligence endpoint
```

### Frontend
```
src/components/entity-dossier/
├── ScoreWithContext.tsx               # NEW: Score display with context
├── ConversationTreeViewer.tsx         # NEW: Conversation tree visualization
├── OutreachStrategyPanel.tsx          # Updated to use real data
└── StrategyReasoning.tsx              # Existing component

src/app/api/
└── outreach-intelligence/route.ts     # Updated to call real backend
```

## Verification Checklist

- [ ] Multi-source collection works (official site, jobs, press, LinkedIn)
- [ ] Score explanations include meaning, why, benchmark, action
- [ ] Outreach strategy section appears in STANDARD/PREMIUM dossiers
- [ ] Conversation trees display with clickable branches
- [ ] Real-time data freshness indicator visible
- [ ] Anti-pattern warnings appear for sales mistakes

## Troubleshooting

### Issue: BrightData SDK not available

**Solution**: Check `BRIGHTDATA_API_TOKEN` environment variable is set

```bash
echo $BRIGHTDATA_API_TOKEN
```

### Issue: Outreach strategy section missing

**Solution**: Ensure priority score > 20 (STANDARD or PREMIUM tier)

```python
priority_score = 70  # Includes outreach_strategy
```

### Issue: Conversation trees not displaying

**Solution**: Check that `conversation_trees` array is populated in dossier

```python
strategy = next(s for s in dossier.sections if s.id == 'outreach_strategy')
trees = strategy.content.get('conversation_trees', [])
print(f"Trees: {len(trees)}")
```

## Next Steps

1. Test with 5 real entities
2. Validate score explanations
3. Review conversation trees with sales team
4. Full rollout to all STANDARD/PREMIUM dossiers

## Support

For issues or questions:
- Check `ENHANCED-DOSSIER-IMPLEMENTATION-SUMMARY.md` for detailed implementation
- Run `test_enhanced_dossier.py` for automated testing
- Review git commits for detailed changes
