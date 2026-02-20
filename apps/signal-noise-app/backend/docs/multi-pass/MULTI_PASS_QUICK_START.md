# Multi-Layered RFP Discovery System - Quick Start Guide

## 5-Minute Setup

### 1. Verify Dependencies

```bash
# Check that backend services are available
cd backend

# Verify FalkorDB connection
python -c "from falkordb_client import FalkorDBClient; print('✅ FalkorDB OK')"

# Verify BrightData
python -c "from brightdata_sdk_client import BrightDataSDKClient; print('✅ BrightData OK')"

# Verify Claude client
python -c "from claude_client import ClaudeClient; print('✅ Claude OK')"
```

### 2. Run Integration Test

```bash
cd backend
python test_multi_pass_integration.py
```

Expected output: Multi-layered discovery test with all phases passing.

## Usage Examples

### Example 1: Quick Discovery (No Dossier)

```python
from backend.multi_pass_ralph_loop import MultiPassRalphCoordinator

coordinator = MultiPassRalphCoordinator()
result = await coordinator.run_multi_pass_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    yp_template_id="yellow_panther_agency",
    max_passes=2  # Quick 2-pass discovery
)

# Results
print(f"Confidence: {result.final_confidence:.2f}")
print(f"Signals: {result.total_signals_detected}")
print(f"Cost: ${result.total_cost:.2f}")
```

### Example 2: Full Multi-Pass with Dossier

```python
from backend.dossier_generator import EntityDossierGenerator
from backend.claude_client import ClaudeClient
from backend.multi_pass_ralph_loop import MultiPassRalphCoordinator

# Step 1: Generate dossier
claude = ClaudeClient()
dossier_gen = EntityDossierGenerator(claude)
dossier = await dossier_gen.generate_dossier(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    priority_score=50  # STANDARD tier (7 sections)
)

# Step 2: Run multi-pass discovery
coordinator = MultiPassRalphCoordinator()
result = await coordinator.run_multi_pass_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    yp_template_id="yellow_panther_agency",
    max_passes=4,
    dossier=dossier  # ← Use dossier to inform hypotheses
)

# Step 3: Analyze results
for signal in result.pass_results[-1].validated_signals:
    if signal.confidence > 0.7:
        print(f"🎯 {signal.category}: {signal.confidence:.2f}")
        print(f"   YP Service: {signal.metadata.get('yp_service')}")
```

### Example 3: Dossier-Informed Hypotheses Only

```python
from backend.dossier_generator import EntityDossierGenerator
from backend.dossier_hypothesis_generator import DossierHypothesisGenerator
from backend.claude_client import ClaudeClient

# Generate dossier
claude = ClaudeClient()
dossier_gen = EntityDossierGenerator(claude)
dossier = await dossier_gen.generate_dossier(
    entity_id="chelsea-fc",
    entity_name="Chelsea FC",
    priority_score=50
)

# Generate hypotheses
hyp_gen = DossierHypothesisGenerator()
hypotheses = await hyp_gen.generate_hypotheses_from_dossier(
    dossier=dossier,
    entity_id="chelsea-fc"
)

# View hypotheses
for hyp in hypotheses:
    print(f"📊 {hyp.hypothesis_id}")
    print(f"   {hyp.statement}")
    print(f"   Confidence: {hyp.confidence:.2f}")
    print(f"   YP Service: {hyp.metadata.get('yp_capability')}")
    print()
```

## Configuration

### Minimum Environment Variables

```bash
# FalkorDB (required for graph queries)
FALKORDB_URI=bolt://localhost:7687
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password

# Claude API (required for AI)
ANTHROPIC_API_KEY=your-claude-key

# BrightData (required for web scraping)
BRIGHTDATA_API_TOKEN=your-brightdata-token

# Supabase (optional, for cache)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-key
```

### Dossier Tier Selection

```python
# BASIC (3 sections, ~5 seconds, $0.0004)
priority_score=20

# STANDARD (7 sections, ~15 seconds, $0.0095) ← Recommended
priority_score=50

# PREMIUM (11 sections, ~30 seconds, $0.057)
priority_score=80
```

## Output Interpretation

### MultiPassResult Fields

| Field | Meaning | Example |
|-------|---------|---------|
| `final_confidence` | Overall procurement readiness | 0.75 = CONFIDENT band |
| `total_signals_detected` | Total RFP opportunities found | 12 |
| `high_confidence_signals` | Signals with confidence > 0.7 | 8 |
| `unique_categories` | Different technology categories | 5 |
| `total_cost` | API costs for all passes | $2.50 |
| `duration_seconds` | Time to complete | 180.5 |

### Confidence Bands

| Band | Range | Meaning | Action |
|------|-------|---------|--------|
| EXPLORATORY | < 0.30 | Research phase | Monitor |
| INFORMED | 0.30 - 0.60 | Monitoring | Watchlist |
| CONFIDENT | 0.60 - 0.80 | Sales engaged | Qualify lead |
| ACTIONABLE | > 0.80 | Immediate outreach | Prioritize |

## Troubleshooting

### Issue: Low Confidence Scores

**Symptom**: All hypotheses < 0.50

**Solutions**:
1. Increase dossier tier (STANDARD → PREMIUM)
2. Check entity has sufficient digital presence
3. Verify BrightData scraping works (check website access)
4. Run more passes (max_passes: 2 → 4)

### Issue: No Signals Detected

**Symptom**: `total_signals_detected = 0`

**Solutions**:
1. Check FalkorDB has entity data
2. Verify entity has official website/careers page
3. Increase max_iterations in strategy
4. Try different entity (test with known digital entity)

### Issue: High Cost

**Symptom**: `total_cost > $10`

**Solutions**:
1. Reduce max_passes (4 → 2)
2. Use BASIC dossier tier instead of PREMIUM
3. Reduce max_iterations per pass
4. Cache temporal patterns (re-use across entities)

## Best Practices

### 1. Start with STANDARD Dossier

```python
# Good balance of depth and cost
dossier = await dossier_gen.generate_dossier(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    priority_score=50  # STANDARD
)
```

### 2. Use 2-3 Passes for Initial Testing

```python
# Quick test: 2 passes
result = await coordinator.run_multi_pass_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    max_passes=2
)

# Full discovery: 3-4 passes
result = await coordinator.run_multi_pass_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    max_passes=4
)
```

### 3. Focus on High-Confidence Signals

```python
# Only signals > 0.7 are actionable
high_conf = [
    s for s in result.pass_results[-1].validated_signals
    if s.confidence > 0.7
]

for signal in high_conf:
    print(f"🎯 {signal.category}: {signal.confidence:.2f}")
```

### 4. Check YP Service Matching

```python
# Verify signals match YP capabilities
for signal in result.pass_results[-1].validated_signals:
    yp_service = signal.metadata.get('yp_service')
    if yp_service:
        print(f"✅ {signal.category} → {yp_service}")
    else:
        print(f"⚠️ {signal.category} → No YP match (outsourced?)")
```

## Performance Tips

### Cache Temporal Patterns

```python
# Reuse context manager across entities
context_manager = MultiPassContext()

for entity_id in ["arsenal", "chelsea", "liverpool"]:
    strategy = await context_manager.get_pass_strategy(
        entity_id=entity_id,
        entity_name=entity_id.title(),
        pass_number=1,
        previous_results=[]
    )
    # Temporal patterns cached after first call
```

### Batch Processing

```python
# Process multiple entities sequentially
entities = [
    ("arsenal-fc", "Arsenal FC"),
    ("chelsea-fc", "Chelsea FC"),
    ("liverpool-fc", "Liverpool FC")
]

coordinator = MultiPassRalphCoordinator()

for entity_id, entity_name in entities:
    result = await coordinator.run_multi_pass_discovery(
        entity_id=entity_id,
        entity_name=entity_name,
        max_passes=2  # Quick discovery for batch
    )

    # Store result
    print(f"{entity_name}: {result.final_confidence:.2f}")
```

## Advanced: Custom Strategies

```python
from backend.multi_pass_context import MultiPassContext, PassStrategy, HopType

# Create custom strategy
custom_strategy = PassStrategy(
    pass_number=1,
    focus_areas=["AI & Automation", "Data Analytics"],
    hop_types=[HopType.TECH_BLOG, HopType.NEWS_COVERAGE],
    max_iterations=25,
    depth_limit=5,
    description="Custom AI-focused discovery"
)

# Use custom strategy
context_manager = MultiPassContext()
context_manager.pass_history[1] = PassResult(
    pass_number=1,
    timestamp=datetime.now(),
    strategy=custom_strategy,
    validated_signals=[]
)
```

## Next Steps

1. **Test with 2-3 known entities** (Arsenal, Chelsea, Fulham)
2. **Validate against known RFPs** (check historical accuracy)
3. **Calibrate confidence thresholds** (adjust bands if needed)
4. **Production deployment** (see MULTI_PASS_README.md)

## Support

For issues or questions:
1. Check `MULTI_PASS_README.md` for detailed documentation
2. Review `test_multi_pass_integration.py` for examples
3. Examine logs for detailed pass-by-pass output
