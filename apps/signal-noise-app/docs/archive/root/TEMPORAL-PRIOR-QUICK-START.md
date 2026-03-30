# Temporal Prior System - Quick Start Guide

## Overview

The TemporalPriorService analyzes historical RFP episodes to learn when entities are likely to issue RFPs, then adjusts Ralph Loop validation thresholds based on these patterns.

**Key Feature**: Temporal multipliers (0.75 - 1.40) boost or reduce confidence based on:
- **Seasonality**: Is this entity active in the current quarter?
- **Recurrence**: Are we due for another RFP based on historical intervals?
- **Momentum**: Has this entity been active recently?

---

## Quick Start

### 1. Test the System

```bash
# Run all tests
./scripts/test-temporal-priors.sh

# Expected output:
# ✅ All tests passed!
```

### 2. Run Database Migration

```bash
# Option A: Run SQL migration via Supabase dashboard
# Go to: https://app.supabase.com/project/YOUR-PROJECT/sql
# Paste contents of: backend/migrations/001_add_signal_category_to_episodes.sql

# Option B: Run Python migration script
python3 scripts/migrate_add_signal_category.py

# Expected output:
# ✅ Migrated: 150 episodes
# ✅ All episodes now have signal_category!
```

### 3. Compute Initial Priors

```bash
# Compute priors for the first time
python3 -c "
import asyncio
import sys
sys.path.insert(0, 'backend')

from backend.temporal.temporal_prior_service import compute_temporal_priors

result = asyncio.run(compute_temporal_priors())
print(f'Computed {result[\"total_priors\"]} priors')
"

# Expected output:
# ✅ Computed 150 temporal priors
#    - Entity priors: 120
#    - Aggregate priors: 30
```

### 4. Set Up Nightly Computation

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2 AM daily):
0 2 * * * /path/to/signal-noise-app/scripts/compute-temporal-priors.sh >> /var/log/temporal-priors.log 2>&1

# Save and exit
```

---

## Usage Examples

### Example 1: Get Temporal Multiplier

```python
from backend.temporal.temporal_prior_service import get_temporal_multiplier
from backend.temporal.models import SignalCategory

# Get multiplier for Arsenal + CRM
multiplier = get_temporal_multiplier("arsenal", SignalCategory.CRM)

print(f"Multiplier: {multiplier:.2f}")
# Output: Multiplier: 1.25

# Interpretation:
# 1.25 = 25% boost (Arsenal is active in CRM category)
```

### Example 2: Ralph Loop Integration (Automatic)

The Ralph Loop server automatically uses temporal priors:

```python
# Incoming signal
signal = {
    'id': 'rfp_001',
    'entity_id': 'arsenal',
    'type': 'RFP_DETECTED',
    'confidence': 0.72,
    'evidence': [...],
    'category': 'Digital Infrastructure'
}

# Pass 1: Threshold adjusted
# Original threshold: 0.70
# Temporal multiplier: 1.25
# Adjusted threshold: 0.70 / 1.25 = 0.56
# Result: Signal passes (0.72 > 0.56) ✅

# Pass 3: Final confidence adjusted
# Pass 2 confidence: 0.72
# Temporal multiplier: 1.25
# Final confidence: 0.72 * 1.25 = 0.90
# Result: Signal validated ✅
```

### Example 3: Inspect Prior Data

```python
import asyncio
from backend.temporal.temporal_prior_service import TemporalPriorService
from backend.temporal.models import SignalCategory

async def inspect_prior():
    service = TemporalPriorService()

    # Get prior for specific entity + category
    prior = await service.get_prior_for_entity('arsenal', SignalCategory.CRM)

    if prior:
        print(f"Entity: {prior.entity_id}")
        print(f"Category: {prior.signal_category.value}")
        print(f"Seasonality: {prior.seasonality}")
        print(f"Recurrence: {prior.recurrence_mean} ± {prior.recurrence_std} days")
        print(f"Momentum (30d): {prior.momentum_30d} events")
        print(f"Sample size: {prior.sample_size} episodes")
        print(f"Last seen: {prior.last_seen}")

asyncio.run(inspect_prior())

# Output:
# Entity: arsenal
# Category: CRM
# Seasonality: {'Q1': 0.5, 'Q2': 0.2, 'Q3': 0.2, 'Q4': 0.1}
# Recurrence: 30 ± 5 days
# Momentum (30d): 2 events
# Sample size: 10 episodes
# Last seen: 2026-01-25 10:30:00
```

---

## Understanding Multipliers

### Multiplier Ranges

| Range | Meaning | Example |
|-------|---------|---------|
| **1.20 - 1.40** | High likelihood | Entity active in this category, recent momentum, good timing |
| **1.00 - 1.20** | Moderate boost | Some positive indicators |
| **0.90 - 1.00** | Neutral | No strong indicators either way |
| **0.75 - 0.90** | Low likelihood | Entity inactive, bad timing, no recent history |

### What Affects Multipliers

**Seasonality** (0.90 - 1.10):
- If current quarter has 50% historical activity → 1.10x boost
- If current quarter has 5% historical activity → 0.90x reduction

**Recurrence** (0.95 - 1.10):
- If we're 0 std from expected next occurrence → 1.10x boost
- If we're 3+ std from expected → 0.95x reduction

**Momentum** (0.95 - 1.20):
- Each event in last 30 days adds +0.05x
- Capped at 1.20x (with 4+ recent events)

**Combined Example**:
```
Seasonality: 1.10 (high Q1 activity)
Recurrence: 1.05 (close to expected)
Momentum: 1.15 (3 recent events)
─────────────────────────────────
Total: 1.10 * 1.05 * 1.15 = 1.33x boost
```

---

## Category Mapping

The system maps templates to 14 canonical categories:

| Canonical Category | Template Keywords |
|-------------------|-------------------|
| **CRM** | salesforce, hubspot, crm, dynamics, pipedrive |
| **TICKETING** | zendesk, freshdesk, ticket, help desk, servicenow |
| **DATA_PLATFORM** | snowflake, databricks, data warehouse, bigquery |
| **COMMERCE** | shopify, magento, ecommerce, stripe |
| **MARKETING** | marketing automation, mailchimp, marketo |
| **CONTENT** | cms, wordpress, drupal, contentful |
| **ANALYTICS** | tableau, looker, power bi, business intelligence |
| **COMMUNICATION** | email, messaging, slack, zoom, teams |
| **COLLABORATION** | sharepoint, confluence, notion, asana, jira |
| **OPERATIONS** | erp, sap, oracle, workday |
| **HR** | hr, recruiting, payroll, bamboohr |
| **FINANCE** | finance, accounting, procurement, coupa |
| **INFRASTRUCTURE** | cloud, aws, azure, kubernetes, devops |
| **SECURITY** | security, sso, okta, compliance, firewall |

---

## Troubleshooting

### Problem: Multipliers always 1.0

**Cause**: No priors computed yet

**Solution**:
```bash
# Run nightly computation
./scripts/compute-temporal-priors.sh
```

### Problem: "signal_category column not found"

**Cause**: Database migration not run

**Solution**:
```bash
# Run migration via Supabase dashboard
# Or run Python script
python3 scripts/migrate_add_signal_category.py
```

### Problem: Wrong category assigned

**Cause**: Template keyword not in mapping

**Solution**:
1. Edit `backend/temporal/category_mapper.py`
2. Add keyword to `TEMPLATE_KEYWORD_MAPPING`
3. Re-run nightly computation

---

## Monitoring

### Check Priors File

```bash
# Check if priors file exists
ls -la data/temporal_priors.json

# View priors count
python3 -c "
import json
with open('data/temporal_priors.json') as f:
    priors = json.load(f)
    print(f'Total priors: {len(priors)}')
"
```

### Check Cron Job

```bash
# View cron jobs
crontab -l

# Check cron logs
tail -f /var/log/temporal-priors.log
```

### Check Ralph Loop Integration

```bash
# View Ralph Loop logs
tail -f logs/ralph-loop-server.log | grep "Temporal adjustment"

# Expected output:
# 📊 Temporal adjustment: 1.25x (backoff: entity, threshold: 0.70 → 0.56)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  NIGHTLY: Compute Priors               │
│  - Load episodes from Graphiti         │
│  - Group by entity + category          │
│  - Compute seasonality/recurrence      │
│  - Save to data/temporal_priors.json   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  RUNTIME: Get Multiplier               │
│  - Load priors from file               │
│  - Apply backoff chain                 │
│  - Return 0.75 - 1.40 multiplier       │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  RALPH LOOP: Adjust Validation         │
│  Pass 1: Adjust threshold              │
│  Pass 3: Adjust final confidence       │
└─────────────────────────────────────────┘
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `backend/temporal/temporal_prior_service.py` | Main service |
| `backend/temporal/category_mapper.py` | Template → Category mapping |
| `backend/temporal/seasonal_analyzer.py` | Seasonality computation |
| `backend/temporal/recurrence_analyzer.py` | Interval analysis |
| `backend/temporal/momentum_tracker.py` | Momentum tracking |
| `backend/temporal/models.py` | Pydantic models |
| `backend/ralph_loop_server.py` | Ralph Loop integration |
| `data/temporal_priors.json` | Computed priors (nightly) |
| `scripts/compute-temporal-priors.sh` | Nightly cron job |
| `scripts/test-temporal-priors.sh` | Test script |

---

## Next Steps

1. ✅ Run database migration
2. ✅ Compute initial priors
3. ✅ Set up nightly cron job
4. ✅ Monitor Ralph Loop logs for temporal adjustments
5. ✅ Tune weights if needed (after 1-2 weeks of data)

---

**Questions?** See `TEMPORAL-PRIOR-IMPLEMENTATION-COMPLETE.md` for full details.
