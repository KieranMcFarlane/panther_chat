# Arsenal FC Test - Quick Start Guide

## Overview

This test demonstrates the complete processing workflow for Arsenal FC, including:
- Webhook signal reception
- Ralph Loop 3-pass validation
- Model cascade (Haiku → Sonnet → Opus)
- Confidence adjustment (0.92 → 0.82)
- Graphiti storage
- Cost comparison (Haiku vs Sonnet)

## Running the Test

### Prerequisites

```bash
# No external dependencies required (uses mock services)
cd backend
```

### Execute Test

```bash
# From the backend directory
python test/test_arsenal_processing.py
```

### Expected Output

```
================================================================================
🧪 ARSENAL FC WEBHOOK PROCESSING TEST
================================================================================

2026-01-28 12:00:00 INFO 📨 Step 1: Creating webhook signal
2026-01-28 12:00:00 INFO    Signal ID: webhook-linkedin-20260128-000015
2026-01-28 12:00:00 INFO    Type: RFP_DETECTED
2026-01-28 12:00:00 INFO    Confidence: 0.92
2026-01-28 12:00:00 INFO    Evidence: 1 items

2026-01-28 12:00:00 INFO 🔧 Step 2: Initializing services
2026-01-28 12:00:00 INFO ✅ Mock Graphiti service initialized

2026-01-28 12:00:00 INFO 🔁 Step 3: Running Ralph Loop validation
2026-01-28 12:00:00 INFO 🔁 Starting Ralph Loop for arsenal_fc with 1 signals
2026-01-28 12:00:00 INFO 🔁 Pass 1/3: Rule-based filtering
2026-01-28 12:00:00 INFO 🔍 Enriching signal webhook-linkedin-20260128-000015 (evidence: 1 < 3)
2026-01-28 12:00:00 INFO ✅ Pass 1: 1/1 signals survived

2026-01-28 12:00:00 INFO 🔁 Pass 2/3: Claude validation with cascade
2026-01-28 12:00:00 INFO 🔄 Claude API call #1 (haiku-3.5-20250813)
2026-01-28 12:00:00 INFO    Input tokens: ~350
2026-01-28 12:00:00 INFO    Output tokens: ~150
2026-01-28 12:00:00 INFO    Total tokens: ~500
2026-01-28 12:00:01 INFO ✅ Haiku validation succeeded
2026-01-28 12:00:01 INFO    Confidence adjustment: -0.10
2026-01-28 12:00:01 INFO    Rationale: LinkedIn job posting is credible but single source...
2026-01-28 12:00:01 INFO    Cost: $0.0001
2026-01-28 12:00:01 INFO    Processing time: 0.50s
2026-01-28 12:00:01 INFO ✅ Pass 2: 1/1 signals survived

2026-01-28 12:00:01 INFO 🔁 Pass 3/3: Final confirmation
2026-01-28 12:00:01 INFO ✅ Pass 3: 1/1 signals survived

2026-01-28 12:00:01 INFO 💾 Writing 1 validated signals to Graphiti
2026-01-28 12:00:01 INFO ✅ Signal inserted: webhook-linkedin-20260128-000015
2026-01-28 12:00:01 INFO ✅ Ralph Loop complete: 1/1 signals validated

2026-01-28 12:00:01 INFO 📊 Step 4: Results Summary

--------------------------------------------------------------------------------
RESULTS SUMMARY
--------------------------------------------------------------------------------

✅ Signal Validated Successfully!

   Signal ID: webhook-linkedin-20260128-000015
   Type: RFP_DETECTED
   Original Confidence: 0.92
   Validated Confidence: 0.82
   Confidence Adjustment: -0.10
   Adjustment Rationale: LinkedIn job posting is credible but single source...
   Model Used: haiku-3.5-20250813
   Validation Cost: $0.0001

   Validation Pass: 3/3
   Validated: True
   Entity: arsenal_fc

💰 Cost Comparison:
   Sonnet (baseline): $0.0015
   Haiku (actual): $0.0001
   Savings: $0.0014 (92.5%)

⏱️  Processing Time: 1.25 seconds

📈 Claude API Usage:
   API Calls: 1
   Total Tokens: ~500

2026-01-28 12:00:01 INFO 💾 Step 5: Verifying Graphiti storage

✅ Signals in Graphiti for Arsenal FC: 3
   - arsenal-rfp-20260115: RFP_DETECTED (confidence: 0.78)
   - arsenal-executive-20260110: EXECUTIVE_CHANGE (confidence: 0.85)
   - webhook-linkedin-20260128-000015: RFP_DETECTED (confidence: 0.82)

================================================================================
✅ TEST COMPLETE
================================================================================
```

## Key Results

### ✅ Success Metrics
- **Validation Rate:** 100% (1/1 signals validated)
- **Processing Time:** ~1.25 seconds
- **Cost:** $0.0001 (92.5% savings vs Sonnet)
- **Confidence Adjustment:** 0.92 → 0.82 (-0.10)

### 🎯 Model Cascade Performance
- **Haiku Success Rate:** 100% (1/1 signals validated with Haiku)
- **No Escalation Needed:** Haiku was sufficient, no Sonnet/Opus required
- **Cost Efficiency:** 92.5% cheaper than Sonnet-only approach

### 📊 Ralph Loop 3-Pass Validation
```
Pass 1 (Rule-based):   1/1 survived (enriched from 1 to 3 evidence items)
Pass 2 (Claude):       1/1 survived (Haiku validation, -0.10 adjustment)
Pass 3 (Final):        1/1 survived (final confirmation)
```

## What Happens Step-by-Step

### 1. Webhook Signal Arrives (0s)
```
📨 LinkedIn webhook: Arsenal FC RFP detected
   - Job: Head of Digital Transformation
   - Confidence: 0.92
   - Evidence: 1 item (LinkedIn only)
```

### 2. Ralph Loop Pass 1 - Rule Filtering (0.5s)
```
✅ Confidence: 0.92 >= 0.7 ✓
❌ Evidence: 1 < 3 (FAIL)
🔍 Auto-enrichment: +2 evidence items (Graphiti corroboration + Perplexity)
✅ Evidence: 3 >= 3 ✓ (after enrichment)
✅ Credibility: 0.767 >= 0.6 ✓
```

### 3. Ralph Loop Pass 2 - Claude Validation (0.5s)
```
🔄 Haiku validation attempt:
   Input: ~350 tokens
   Output: ~150 tokens
   Cost: $0.0001

✅ Validated: Yes
✅ Confidence adjustment: -0.10 (0.92 → 0.82)
✅ Rationale: "LinkedIn job posting is credible but single source..."
✅ Model: Haiku (no Sonnet escalation needed)
```

### 4. Ralph Loop Pass 3 - Final Confirmation (0.25s)
```
✅ Final confidence: 0.82 >= 0.7
✅ No duplicates found
✅ No manual review required
```

### 5. Graphiti Storage (0.25s)
```
💾 Signal written to FalkorDB
   - ID: webhook-linkedin-20260128-000015
   - Type: RFP_DETECTED
   - Confidence: 0.82
   - Validated: True
   - Pass: 3/3
```

## Understanding the Confidence Adjustment

### Why 0.92 → 0.82?

**Original: 0.92 (Overconfident)**
- LinkedIn scraper assigned high confidence
- Only 1 source (limited perspective)

**Haiku Analysis:**
```
Evidence Quality Assessment:
✓ LinkedIn is credible (0.85)
✓ Corroboration from similar RFP 2 weeks ago
✗ Only single primary source
✗ No direct confirmation from Arsenal FC

Conclusion: 0.92 is too high for evidence quality
Adjustment: -0.10 (within ±0.15 bounds)
Final: 0.82 (more realistic)
```

### Cost Comparison

| Approach | Tokens | Cost/1M | Total Cost |
|----------|--------|--------|------------|
| **Sonnet (baseline)** | 500 | $3.00 | $0.0015 |
| **Haiku (actual)** | 500 | $0.25 | $0.0001 |
| **Savings** | - | - | **92.5%** |

**Annual Savings (Arsenal FC only):**
- Sonnet: $0.0015 × 365 = $0.55/year
- Haiku: $0.0001 × 365 = $0.04/year
- **Savings: $0.51/year (92.5%)**

**Annual Savings (All 3,400 entities):**
- Sonnet: $0.0015 × 8 signals × 3,400 entities × 365 = $14,916/year
- Haiku: $0.0001 × 8 signals × 3,400 entities × 365 = $994/year
- **Savings: $13,922/year (93%)**

## Troubleshooting

### Issue: Import Errors

```bash
# Ensure you're in the backend directory
cd backend

# Run the test from there
python test/test_arsenal_processing.py
```

### Issue: Module Not Found

```bash
# Add project root to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python test/test_arsenal_processing.py
```

### Issue: Mock Services Not Working

The test uses built-in mock services, so no external dependencies are required. If you see errors about missing services, ensure you're running the test from the `backend` directory.

## Next Steps

After running this test:

1. **Review the logs:** Understand each validation pass
2. **Check cost savings:** Compare Haiku vs Sonnet costs
3. **Read the full walkthrough:** See `docs/arsenal-step-by-step-walkthrough.md`
4. **Test with real services:** Replace mocks with actual Claude/Graphiti clients

## Related Documentation

- **Step-by-Step Walkthrough:** `docs/arsenal-step-by-step-walkthrough.md`
- **Production Architecture:** `docs/production-hybrid-architecture.md`
- **Daily Cron Workflow:** `docs/production-daily-cron-workflow.md`
- **Implementation Guide:** `docs/daily-cron-implementation-guide.md`

## Questions?

Refer to the main implementation document:
`docs/confidence-validation-implementation-complete.md`
