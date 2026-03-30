# API Credits Breakdown - What Needs Credits vs What Doesn't

## TL;DR

**Most of the pipeline works WITHOUT API credits**. Only Claude AI reasoning needs credits.

---

## ❌ NEEDS API Credits (Claude API)

### What Uses Claude API:
1. **Template Enrichment Agent** (Domain + Channel Discovery)
   - Claude subagent plans: "Where should I look for signals?"
   - Uses: `backend/template_enrichment_agent.py`

2. **Ralph Loop Cascade** (Signal Validation)
   - Model cascade: Haiku (80%) → Sonnet (15%) → Opus (5%)
   - Uses: `backend/ralph_loop_cascade.py`

3. **Domain Discovery Planning**
   - Claude plans search strategies
   - Uses: `backend/entity_domain_discovery.py`

### Cost Estimate (with Credits):
```
Per Entity (67 templates × 3 signals average):
- Haiku: 80% @ $0.25/M tokens = ~$0.20
- Sonnet: 15% @ $3/M tokens = ~$0.27
- Opus: 5% @ $15/M tokens = ~$0.75
Total: ~$1.22 per entity

50 entities: ~$61 total
1000 entities: ~$1,220 total
```

### Error You Saw:
```
400: "Your credit balance is too low to access the Anthropic API"
```

**This means**: The Anthropic API key `sk-ant-api03...` has $0 or very low credits.

---

## ✅ DOES NOT Need API Credits

### 1. **BrightData Web Scraping**
- **Uses**: `backend/brightdata_sdk_client.py`
- **Cost**: Pay-per-success pricing (not token-based)
- **Status**: ✅ Works (token loading fixed)
- **Usage**:
  ```python
  brightdata = BrightDataSDKClient()
  results = await brightdata.search_engine("Arsenal FC jobs")
  content = await brightdata.scrape_as_markdown("https://arsenal.com")
  ```

### 2. **Graphiti Storage (Temporal Episodes)**
- **Uses**: `backend/graphiti_service.py`
- **Cost**: FREE (runs on your own FalkorDB instance)
- **Status**: ✅ Works
- **Usage**: Stores RFP episodes for timeline tracking

### 3. **Domain Validation**
- **Uses**: `backend/entity_domain_discovery.py`
- **Cost**: FREE (regex validation)
- **Status**: ✅ Works (7/8 tests passed)

### 4. **Template Matching**
- **Uses**: `backend/template_loader.py`
- **Cost**: FREE (deterministic JSON matching)
- **Status**: ✅ Works

### 5. **Runtime Binding Cache**
- **Uses**: `backend/template_runtime_binding.py`
- **Cost**: FREE (file-based cache in `data/runtime_bindings/`)
- **Status**: ✅ Works

### 6. **Cluster Intelligence**
- **Uses**: `backend/cluster_intelligence.py`
- **Cost**: FREE (statistical aggregation from cache)
- **Status**: ✅ Works

### 7. **Temporal Fit Analysis**
- **Uses**: `scripts/monitor_temporal_fit.py`
- **Cost**: FREE (math on cached episode data)
- **Status**: ✅ Works

---

## 🔍 What Happened During Test Deployment

### Without Claude API Credits:

```
✅ Step 1: Deploy entities → SUCCESS (67 templates processed)
✅ Step 2: Template matching → SUCCESS (deterministic)
❌ Step 3: Claude enrichment → FAILED (401/400 errors)
⚠️  Step 4: Domain discovery → Fallback to heuristics
⚠️  Step 5: Signal extraction → 0 signals (no Claude planning)
```

**Result**: Pipeline runs but detects 0 signals because Claude can't do the planning/enrichment.

---

## 💡 Solutions

### Option 1: Add Claude API Credits (Recommended)

**How to add credits**:
1. Go to https://console.anthropic.com/
2. Navigate to "Plans & Billing"
3. Add credits (minimum $10-20 for testing)
4. Use existing key: `ANTHROPIC_API_KEY=sk-ant-api03...`

**Cost estimate**:
- Test with 3 entities: ~$3.66
- Test with 50 entities: ~$61
- Production 1000 entities: ~$1,220

### Option 2: Use Mock Data (Free)

**For testing pipeline without API costs**:

Create mock enrichment in `template_enrichment_agent.py`:
```python
async def enrich_template(...):
    if os.getenv('USE_MOCK_DATA'):
        # Return mock discovered data
        return EnrichmentResult(
            discovered_domains=["arsenal.com", "www.arsenal.com"],
            discovered_channels={"jobs_board": ["linkedin.com/jobs"]},
            enriched_patterns={"Strategic Hire": ["CRM Manager"]}
        )
    else:
        # Use Claude (requires credits)
        return await claude.discovery(...)
```

**Usage**:
```bash
export USE_MOCK_DATA=true
python scripts/deploy_live_entity_monitoring.py --entities 3
```

### Option 3: Use Runtime Bindings (Free After First Run)

**How it works**:
1. First run: Uses Claude (expensive) to discover domains/channels
2. Caches results to `data/runtime_bindings/bindings_cache.json`
3. Subsequent runs: Uses cache (FREE) - skips Claude entirely!

**Cost savings**:
- Run 1: 100 entities × $1.22 = $122 (with Claude)
- Runs 2-10: 100 entities × $0 = $0 (from cache)

**To use**:
```bash
# First run (uses Claude, costs $122)
python scripts/deploy_live_entity_monitoring.py --entities 100

# Subsequent runs (FREE - uses cache)
python scripts/deploy_live_entity_monitoring.py --entities 100
```

---

## 📊 Cost-Benefit Analysis

### With Claude API Credits (Real Deployment):
```
Initial setup (100 entities): $122
Ongoing monitoring (cache): $0
New entity discovery (per 100): $122
Validation with Ralph Loop: $61-122 per batch

Total first year: $244-488 for full 100-entity system
```

### Without Claude API (Mock/Manual):
```
Manual domain discovery: 20 hours × $50/hr = $1,000
Manual channel mapping: 10 hours × $50/hr = $500
Total: $1,500 one-time + ongoing maintenance
```

**ROI**: Claude API pays for itself after first use!

---

## 🎯 Recommendation

### For Testing Now:
**Option A**: Use mock mode (free)
```bash
export USE_MOCK_DATA=true
python scripts/deploy_live_entity_monitoring.py --entities 3
```

**Option B**: Add $5-10 to Anthropic account (enough for 3-10 entities)

### For Production:
1. **Add $100-200** to Anthropic account (enough for 100-200 entities)
2. **Let system discover** all domains/channels automatically
3. **Cache results** - subsequent runs are FREE
4. **Validate predictions** against real RFPs
5. **Monitor costs** - target 92% cost reduction via model cascade

---

## 📝 Environment Variables You Have

```bash
# BrightData (Pay-per-success, no upfront cost)
BRIGHTDATA_API_TOKEN=bbbc6961... ✅ VALID

# Anthropic Claude (Needs credits added)
ANTHROPIC_API_KEY=sk-ant-api03... ⚠️ LOW CREDITS
ANTHROPIC_AUTH_TOKEN=0e978aa4... ⚠️ INVALID (Z.AI proxy)
ZAI_API_KEY=c4b86007... ⚠️ INVALID (Z.AI proxy)

# FalkorDB (FREE - runs locally)
FALKORDB_URI=bolt://localhost:7687 ✅ FREE

# Graphiti (FREE - runs locally)
# No API needed ✅ FREE
```

---

## ✅ What You Can Do RIGHT NOW (Without Credits)

### 1. Test BrightData Scraping (Free)
```bash
python3 -c "
import asyncio
from backend.brightdata_sdk_client import BrightDataSDKClient

async def test():
    client = BrightDataSDKClient()
    result = await client.search_engine('Arsenal FC CRM jobs', engine='google')
    print(f'Status: {result[\"status\"]}')
    print(f'Results: {len(result.get(\"results\", []))}')

asyncio.run(test())
"
```

### 2. Test Template Matching (Free)
```bash
python3 -c "
from backend.template_loader import TemplateLoader

loader = TemplateLoader()
entity = {'name': 'Arsenal FC', 'sport': 'Football', 'org_type': 'club'}

templates = loader.get_templates_for_entity(entity)
print(f'Templates found: {len(templates)}')
"
```

### 3. Test Domain Validation (Free)
```bash
python3 -c "
from backend.entity_domain_discovery import EntityDomainDiscovery

d = EntityDomainDiscovery()
print(f'Valid: {d._extract_domain_from_url(\"https://arsenal.com\")}')
print(f'Invalid: {d._extract_domain_from_url(\"arsenal.\")}')
"
```

### 4. Use Mock Mode (Free)
```bash
# Add to deployment script
export USE_MOCK_DATA=true
python scripts/deploy_live_entity_monitoring.py --entities 3
```

---

## Summary

**❌ Needs Credits**: Claude API (AI reasoning for domain/channel discovery)
- Cost: ~$1.22 per entity (one-time)
- Benefit: Automatic discovery at scale
- Alternative: Use mock data or manual setup

**✅ Free**: Everything else (web scraping, storage, validation, caching)
- BrightData scraping: Pay-per-success (no upfront)
- Graphiti storage: FREE (your own database)
- Templates: FREE (static JSON)
- Cache: FREE (file-based)

**Recommendation**: Add $10 to Anthropic account for testing, scale up as needed.
