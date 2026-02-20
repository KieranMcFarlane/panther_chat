# Universal Dossier Generator - Quick Start Guide

## Overview

The `UniversalDossierGenerator` extends `EntityDossierGenerator` to support universal, scalable dossier generation across 3,000+ sports entities with tiered prompts and hypothesis extraction.

## What's New

### New Class: `UniversalDossierGenerator`

Located in: `backend/dossier_generator.py` (lines 653-1519, ~866 lines of new code)

**Extends**: `EntityDossierGenerator`

**Purpose**: Generate universal dossiers with tiered prompts, model cascade optimization, and automatic hypothesis/signal extraction.

## Key Features

### 1. Tiered Prompt Selection

```python
def _select_prompt_by_tier(self, tier: str) -> str
```

**Tiers**:
- **BASIC** (priority ≤ 20): 3 sections, ~5s, ~$0.0004
- **STANDARD** (priority 21-50): 7 sections, ~15s, ~$0.0095
- **PREMIUM** (priority 51-100): 11 sections, ~30s, ~$0.057

**Usage**:
```python
generator = UniversalDossierGenerator(claude_client)
prompt = generator._select_prompt_by_tier("PREMIUM")
```

### 2. Prompt Interpolation

```python
def _interpolate_prompt(self, prompt: str, entity_data: dict) -> str
```

**Replaces placeholders**:
- `{name}` → Entity name
- `{type}` → Entity type (CLUB, LEAGUE, etc.)
- `{industry}` → Sport or industry
- `{currentData}` → JSON entity data

**Example**:
```python
entity_data = {
    "entity_name": "Arsenal FC",
    "entity_type": "CLUB",
    "sport": "Football",
    "country": "England"
}

interpolated = generator._interpolate_prompt(template, entity_data)
```

### 3. Model Cascade Generation

```python
async def _generate_with_model_cascade(
    self,
    prompt: str,
    entity_name: str,
    tier: str
) -> dict
```

**Strategy** (cost-optimized):
- **Haiku (80%)**: Fast, cheap generation for most entities
- **Sonnet (15%)**: Balanced quality for complex cases
- **Opus (5%)**: Deep analysis for premium entities

**Fallback chain**: Haiku → Sonnet → Opus → Minimal dossier

### 4. Hypothesis Extraction

```python
def _extract_hypotheses(self, dossier: dict) -> List[dict]
```

**Extracts from**:
- Executive summary insights marked `hypothesis_ready: true`
- Primary and secondary hypotheses from `recommended_approach`
- High-probability procurement opportunities (>50% RFP probability)

**Returns**:
```python
[
    {
        "statement": "Testable assertion",
        "signal_type": "[PROCUREMENT]",
        "confidence": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "source": "data source",
        "entity_id": "entity-id",
        "type": "INSIGHT|PRIMARY|SECONDARY|OPPORTUNITY"
    }
]
```

### 5. Signal Extraction

```python
def _extract_signals(self, dossier: dict) -> List[dict]
```

**Signal Types**:
- **[PROCUREMENT]**: Buying signals, RFP likelihood
- **[CAPABILITY]**: Tech gaps, digital maturity
- **[TIMING]**: Contract windows, strategic cycles
- **[CONTACT]**: Decision makers, influence mapping

**Returns**:
```python
[
    {
        "type": "[PROCUREMENT]",
        "insight": "Specific observation",
        "confidence": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "entity_id": "entity-id",
        "section": "executive_summary|procurement|timing|leadership|digital_infrastructure"
    }
]
```

### 6. Universal Dossier Generation

```python
async def generate_universal_dossier(
    self,
    entity_id: str,
    entity_name: str,
    entity_type: str = "CLUB",
    priority_score: int = 50,
    entity_data: Optional[Dict[str, Any]] = None
) -> dict
```

**Complete workflow**:
1. Determines tier from priority score
2. Collects entity data (if not provided)
3. Selects appropriate prompt template
4. Interpolates prompt with entity data
5. Generates dossier using model cascade
6. Extracts hypotheses and signals
7. Returns complete dossier with metadata

**Returns**:
```python
{
    "metadata": {
        "entity_id": "arsenal-fc",
        "generated_at": "2025-02-09T...",
        "tier": "PREMIUM",
        "priority_score": 99,
        "hypothesis_count": 5,
        "signal_count": 12
    },
    "executive_summary": { ... },
    "digital_infrastructure": { ... },
    "procurement_signals": { ... },
    "leadership_analysis": { ... },
    "timing_analysis": { ... },
    "risk_assessment": { ... },
    "recommended_approach": { ... },
    "next_steps": { ... },
    "extracted_hypotheses": [ ... ],
    "extracted_signals": [ ... ],
    "generation_time_seconds": 25.3
}
```

## Usage Examples

### Basic Usage

```python
import asyncio
from backend.dossier_generator import UniversalDossierGenerator
from backend.claude_client import ClaudeClient

async def main():
    # Initialize
    claude = ClaudeClient()
    generator = UniversalDossierGenerator(claude)

    # Generate dossier
    dossier = await generator.generate_universal_dossier(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=99  # PREMIUM tier
    )

    # Access results
    print(f"Generated {dossier['metadata']['tier']} dossier")
    print(f"Hypotheses: {len(dossier['extracted_hypotheses'])}")
    print(f"Signals: {len(dossier['extracted_signals'])}")

    # Filter procurement signals
    procurement_signals = [
        s for s in dossier['extracted_signals']
        if s['type'] == '[PROCUREMENT]'
    ]

    # Get high-confidence hypotheses
    high_conf = [
        h for h in dossier['extracted_hypotheses']
        if h['confidence'] > 70
    ]

    return dossier

result = asyncio.run(main())
```

### Batch Processing

```python
async def generate_batch(entity_ids):
    """Generate dossiers for multiple entities"""
    claude = ClaudeClient()
    generator = UniversalDossierGenerator(claude)

    # Process in parallel (limit concurrency)
    semaphore = asyncio.Semaphore(5)

    async def generate_one(entity_id):
        async with semaphore:
            return await generator.generate_universal_dossier(
                entity_id=entity_id,
                entity_name=entity_id.replace("-", " ").title(),
                priority_score=50
            )

    tasks = [generate_one(eid) for eid in entity_ids]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return results

# Usage
entities = ["arsenal-fc", "chelsea-fc", "liverpool-fc"]
dossiers = asyncio.run(generate_batch(entities))
```

## Validation Rules

The universal prompts enforce:

### 1. Entity-Specific Content
- ❌ DO NOT copy example content literally
- ✅ Generate entity-specific analysis
- ✅ Use "unknown" or "not available" when data is missing
- ✅ Reference actual observations from entity data

### 2. Confidence Scoring
- ✅ All assertions must have confidence scores (0-100)
- ✅ Base confidence on data availability and recency
- ✅ Distinguish between "observed" vs "inferred" insights
- ✅ Flag assumptions requiring validation

### 3. Signal Tagging
- ✅ [PROCUREMENT]: Active buying signals, RFP likelihood
- ✅ [CAPABILITY]: Tech gaps, digital maturity
- ✅ [TIMING]: Contract windows, strategic cycles
- ✅ [CONTACT]: Decision makers, influence mapping

### 4. Hypothesis Generation
- ✅ 3-5 testable hypotheses per dossier
- ✅ Specific, measurable, actionable
- ✅ Include validation strategies
- ✅ Link to specific signal types

## Testing

Run the test suite:

```bash
python test_universal_dossier_generator.py
```

**Tests verify**:
1. ✅ Tier-based prompt selection
2. ✅ Prompt interpolation with entity data
3. ✅ Hypothesis extraction with confidence scores
4. ✅ Signal extraction with correct tags
5. ✅ Model cascade strategy
6. ✅ Proper inheritance from EntityDossierGenerator

## Integration with Existing System

### Frontend Integration

The universal prompts are already defined in:
- `src/components/entity-dossier/universal-club-prompts.ts`

The Python implementation mirrors the TypeScript prompts exactly for consistency.

### Backend Integration

Universal dossiers integrate with:
- **DossierDataCollector**: Entity data collection from FalkorDB + BrightData
- **ClaudeClient**: Model cascade (Haiku/Sonnet/Opus)
- **Hypothesis-Driven Discovery**: Feed extracted hypotheses into discovery system
- **Ralph Loop**: Validate extracted signals with 3-pass governance

### Database Storage

Generated dossiers can be stored in:
- **FalkorDB**: As entity properties with relationships
- **Supabase**: Cache layer for quick retrieval
- **Graphiti**: Temporal episodes for RFP tracking

## Cost Optimization

### Per-Entity Costs

| Tier  | Sections | Time  | Cost    | Batch (100 entities) |
|-------|----------|-------|---------|---------------------|
| BASIC | 3        | ~5s   | $0.0004 | $0.04               |
| STANDARD | 7     | ~15s  | $0.0095 | $0.95               |
| PREMIUM | 11      | ~30s  | $0.057  | $5.70               |

### Estimated Batch Costs (3,000 entities)

Assuming priority distribution:
- 60% BASIC (1,800 entities) @ $0.0004 = $0.72
- 30% STANDARD (900 entities) @ $0.0095 = $8.55
- 10% PREMIUM (300 entities) @ $0.057 = $17.10

**Total**: ~$26.37 for 3,000 entities

### Model Cascade Savings

Without cascade (all Opus): ~$150 for 3,000 entities
With cascade (80% Haiku, 15% Sonnet, 5% Opus): ~$26.37

**Savings**: ~83% cost reduction

## Performance

### Generation Times

- BASIC: ~5 seconds per entity
- STANDARD: ~15 seconds per entity
- PREMIUM: ~30 seconds per entity

### Parallel Processing

```python
# Process 10 entities concurrently
CONCURRENT_LIMIT = 10

# Estimated time for 3,000 entities
# = (3000 / 10) * average_time_per_entity
# = 300 * 15s (weighted average)
# = 4,500s ≈ 1.25 hours
```

## Troubleshooting

### Issue: Dossier generation fails

**Solution**: Model cascade automatically falls back to Sonnet → Opus → Minimal dossier. Check logs for specific errors.

### Issue: No hypotheses extracted

**Solution**: Ensure prompt includes `hypothesis_ready: true` in insights or high-probability opportunities (>50%).

### Issue: Missing signal tags

**Solution**: Verify prompt includes `[PROCUREMENT]`, `[CAPABILITY]`, `[TIMING]`, or `[CONTACT]` tags in insights.

### Issue: Arsenal-specific content in other entities

**Solution**: Prompts explicitly forbid copying example content. Check prompt interpolation is working correctly.

## Files Changed

### Modified
- `backend/dossier_generator.py` (+866 lines)
  - Added `UniversalDossierGenerator` class
  - Added tiered prompt templates
  - Added model cascade generation
  - Added hypothesis/signal extraction

### Created
- `test_universal_dossier_generator.py` (test suite)
- `UNIVERSAL-DOSSIER-GENERATOR-QUICK-START.md` (this file)

## Next Steps

1. **Integrate with RFP Detection**: Feed extracted hypotheses into hypothesis-driven discovery
2. **Add Monitoring**: Track generation metrics (time, cost, success rate)
3. **Optimize Prompts**: A/B test prompt variations for better signal detection
4. **Scale Up**: Process 3,000 entities in batches
5. **Build Dashboard**: Visualize hypotheses and signals across entity portfolio

## Support

For issues or questions:
- Check test suite: `python test_universal_dossier_generator.py`
- Review logs for generation errors
- Verify environment variables (ANTHROPIC_API_KEY, FalkorDB connection)

---

**Status**: ✅ Production Ready
**Test Coverage**: ✅ All Tests Passing
**Documentation**: ✅ Complete
**Ready for**: 3,000+ Entity Scale
