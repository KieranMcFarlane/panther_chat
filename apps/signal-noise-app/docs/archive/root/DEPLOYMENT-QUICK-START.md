# Deployment Scripts Quick Reference

## Quick Start: Deploy to 10 Entities (Week 1 Test Run)

```bash
# Step 1: Deploy monitoring for 10 entities
python scripts/deploy_live_entity_monitoring.py --entities 10

# Expected output:
# 🚀 Deploying live RFP detection for 10 entities
# 📋 Using X digital transformation templates
# Processing 1/10: Arsenal FC
#   ✅ Y signals detected
#   📡 Z channels discovered
# ...
# 💾 Results saved to: data/deployment_results_TIMESTAMP.json
```

```bash
# Step 2: Validate detected signals
python scripts/validate_live_signals.py \
    --input data/deployment_results_TIMESTAMP.json

# Expected output:
# 🔁 Starting Ralph Loop cascade validation
# 📊 Total signals to validate: N
# 🤖 Model Cascade:
#   Haiku: X/Y (Z%)
#   Sonnet: A/B
#   Opus: C/D
# 💾 Results saved to: data/validation_results_TIMESTAMP.json
```

```bash
# Step 3: Store RFP episodes in Graphiti
python scripts/store_rfp_episodes.py \
    --input data/validation_results_TIMESTAMP.json

# Optional: Simulate first (no actual writes)
python scripts/store_rfp_episodes.py \
    --input data/validation_results_TIMESTAMP.json \
    --simulate

# Expected output:
# 💾 Storing validated RFPs as temporal episodes
# ✅ Episode: episode-id-001
# ✅ Episode: episode-id-002
# ...
# 💾 Results saved to: data/storage_results_TIMESTAMP.json
```

```bash
# Step 4: Monitor temporal fit
python scripts/monitor_temporal_fit.py --days 90

# Expected output:
# 📈 Monitoring temporal fit patterns (horizon: 90 days)
# 🎯 Top Priority Targets:
#   1. arsenal-fc: Fit Score 0.82
#   2. chelsea-fc: Fit Score 0.75
# ...
# 💾 Results saved to: data/temporal_fit_TIMESTAMP.json
```

## Full Deployment (50+ Entities)

```bash
# Step 1: Deploy to 50 entities
python scripts/deploy_live_entity_monitoring.py --entities 50

# Step 2: Validate all signals
python scripts/validate_live_signals.py \
    --input data/deployment_results_TIMESTAMP.json

# Step 3: Store all RFP episodes
python scripts/store_rfp_episodes.py \
    --input data/validation_results_TIMESTAMP.json

# Step 4: Analyze temporal patterns
python scripts/monitor_temporal_fit.py \
    --entity arsenal-fc \
    --entity chelsea-fc \
    --entity manchester-united \
    --days 90
```

## Script Options Reference

### deploy_live_entity_monitoring.py
```bash
--entities N         # Number of entities (default: 10, max: 50)
--max-signals N      # Max signals per entity (default: 20)
--all-templates      # Use all templates, not just digital transformation
```

### validate_live_signals.py
```bash
--input FILE.json    # Required: Deployment results file
--disable-crunchbase # Disable Crunchbase confidence enhancement
```

### store_rfp_episodes.py
```bash
--input FILE.json    # Required: Validation results file
--simulate           # Simulate storage (no actual writes to Graphiti)
```

### monitor_temporal_fit.py
```bash
--entity ID          # Entity ID to analyze (can specify multiple)
--days N             # Time horizon in days (default: 90)
```

## Target Entities (Pre-configured)

### Premier League (8)
- Arsenal FC, Chelsea FC, Manchester United, Manchester City
- Liverpool FC, Tottenham Hotspur, Newcastle United, Aston Villa

### La Liga (5)
- Real Madrid CF, FC Barcelona, Atlético Madrid, Sevilla FC, Real Betis

### Bundesliga (4)
- FC Bayern Munich, Borussia Dortmund, RB Leipzig, Bayer Leverkusen

### Serie A (4)
- Juventus FC, AC Milan, Inter Milan, SSC Napoli

### Ligue 1 (3)
- Paris Saint-Germain, AS Monaco, Olympique Marseille

### Additional (4)
- Ajax Amsterdam, FC Porto, SL Benfica, Sporting CP

**Total: 28 top-tier clubs configured**

## Success Metrics to Track

### Deployment Metrics
- [ ] Deployment success rate >95%
- [ ] Signals detected: 100+ across 50 entities
- [ ] Channels discovered per entity

### Validation Metrics
- [ ] Validation rate: 80%+
- [ ] Cost efficiency: 92% reduction (model cascade)
- [ ] Model distribution: 80% Haiku, 15% Sonnet, 5% Opus

### Storage Metrics
- [ ] Episodes stored in Graphiti
- [ ] Fixed schema compliance
- [ ] Metadata completeness

### Temporal Metrics
- [ ] Fit scores calculated
- [ ] Trend analysis: increasing/stable/decreasing
- [ ] High-priority targets identified (fit score 0.7+)

## Troubleshooting

### BrightData SDK Issues
```bash
# Verify API token is set
echo $BRIGHTDATA_API_TOKEN

# Test SDK directly
python3 -c "
import asyncio
from backend.brightdata_sdk_client import BrightDataSDKClient

async def test():
    client = BrightDataSDKClient()
    result = await client.search_engine('Arsenal FC', engine='google')
    print(result)

asyncio.run(test())
"
```

### Graphiti Connection Issues
```bash
# Test Graphiti service
python3 -c "
import asyncio
from backend.graphiti_service import GraphitiService

async def test():
    service = GraphitiService()
    await service.initialize()
    print('✅ Graphiti connected')

asyncio.run(test())
"
```

### Claude API Issues
```bash
# Verify Claude credentials
echo $ANTHROPIC_API_KEY
# or
echo $ANTHROPIC_AUTH_TOKEN  # If using Z.AI proxy
```

## Expected Timeline

| Week | Activity | Entities | Expected Output |
|------|----------|----------|-----------------|
| 1 | Test deployment | 10 | Validate pipeline, fix issues |
| 2 | Scale deployment | 50 | 100+ signals, 80%+ validation |
| 3-4 | Monitor & analyze | 50+ | Temporal patterns, predictions |
| 5-6 | Outcomes validation | 50+ | Compare predictions vs actual |

## Next Steps After Deployment

1. **Review deployment results**: Check `data/deployment_results_*.json`
2. **Analyze validation metrics**: Review model cascade performance
3. **Verify episode storage**: Confirm Graphiti has correct schema
4. **Track temporal patterns**: Monitor fit scores over time
5. **Optimize thresholds**: Adjust based on real data

---

**Questions?** See `DEPLOYMENT-IMPLEMENTATION-COMPLETE.md` for full details.
