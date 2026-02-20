# CopilotKit Integration Testing Guide

## Quick Start

### Step 1: Run End-to-End Pipeline Test

```bash
node test-end-to-end-pipeline.js
```

This will:
- ✅ Test BrightData detection (4 test cases)
- ✅ Validate signals through Ralph Loop
- ✅ Verify Graphiti storage
- ✅ Show CopilotKit query examples

### Step 2: Start Development Server

```bash
npm run dev
```

Server will start on: **http://localhost:3005**

### Step 3: Test CopilotKit Chat Interface

Navigate to: **http://localhost:3005** (or your chat page)

## Test Queries for CopilotKit

### Query 1: Check Validated Signals Only

```
Show me all RFP opportunities for Manchester United
```

**Expected Result:**
- ✅ Shows only VALIDATED signals (validated=true, validation_pass=3)
- ❌ Does NOT show rejected signals
- Returns signals stored in Graphiti

### Query 2: Multiple Entities

```
Which sports entities have active digital transformation RFPs?
```

**Expected Result:**
- Lists entities with validated RFP_DETECTED signals
- Shows fit scores and confidence levels
- All signals passed 3-pass validation

### Query 3: Signal Details

```
Tell me about the digital transformation RFP for AC Milan
```

**Expected Result:**
- Shows detailed signal metadata
- Displays validation_pass: 3
- Shows evidence sources (BrightData, etc.)

### Query 4: Timeline Query

```
What RFP signals have been detected in the last 24 hours?
```

**Expected Result:**
- Temporal query via Graphiti
- Only validated signals returned
- Shows first_seen timestamps

### Query 5: Rejected Signals (Should Return Empty)

```
Show me rejected RFP signals with low confidence
```

**Expected Result:**
- ❌ Empty result (rejected signals NOT in Graphiti)
- Explains only validated signals stored

## Verification Checklist

### ✅ Stage 1: BrightData Detection

- [ ] Scraper detects RFPs
- [ ] Converts to Ralph Loop format
- [ ] Provides 3 evidence items

### ✅ Stage 2: Ralph Loop Validation

- [ ] High confidence (≥0.7) → Validated
- [ ] Low confidence (<0.7) → Rejected
- [ ] min_evidence=3 enforced
- [ ] 3 validation passes completed

### ✅ Stage 3: Graphiti Storage

- [ ] Only validated signals stored
- [ ] Rejected signals NOT stored
- [ ] Signals marked: validated=true, validation_pass=3

### ✅ Stage 4: CopilotKit Query

- [ ] Chat returns only validated signals
- [ ] No rejected signals in responses
- [ ] Temporal queries work correctly
- [ ] Evidence sources displayed

## Manual Testing Steps

### Test 1: Valid Signal Flow

1. Run pipeline test:
   ```bash
   node test-end-to-end-pipeline.js
   ```

2. Verify in output:
   ```
   [RALPH-LOOP] ✅ VALIDATED (Pass 3/3) - Written to Graphiti
   ```

3. Query in CopilotKit:
   ```
   Show me RFP opportunities
   ```

4. Verify:
   - ✅ Signal appears in chat
   - ✅ Shows validated=true
   - ✅ validation_pass=3

### Test 2: Rejected Signal Flow

1. Run pipeline test (includes low confidence signal)

2. Verify in output:
   ```
   [RALPH-LOOP] ❌ REJECTED - Failed 3-pass validation
   ```

3. Query in CopilotKit:
   ```
   Show me low confidence RFPs
   ```

4. Verify:
   - ❌ Signal does NOT appear
   - ✅ Chat explains only validated signals stored

### Test 3: Evidence Verification

1. Query specific signal:
   ```
   What evidence supports the Manchester United RFP?
   ```

2. Verify response includes:
   - ✅ BrightData source
   - ✅ BrightData Search source
   - ✅ URL Validation source
   - ✅ Credibility scores

### Test 4: Temporal Queries

1. Query:
   ```
   What RFP signals were detected today?
   ```

2. Verify:
   - ✅ Returns today's validated signals
   - ✅ Shows first_seen timestamps
   - ✅ Temporal filtering works

## Expected Chat Responses

### Valid Signal Response

```json
{
  "entity_id": "manchester-united",
  "signal_type": "RFP_DETECTED",
  "validated": true,
  "validation_pass": 3,
  "confidence": 0.92,
  "evidence": [
    {"source": "BrightData", "credibility_score": 0.8},
    {"source": "BrightData Search", "credibility_score": 0.7},
    {"source": "URL Validation", "credibility_score": 0.9}
  ],
  "metadata": {
    "rfp_type": "ACTIVE_RFP",
    "fit_score": 95,
    "detection_strategy": "brightdata"
  }
}
```

### Rejected Signal Response

```json
{
  "message": "No signals found",
  "explanation": "Only validated signals (confidence ≥ 0.7, min_evidence=3) are stored in Graphiti. Low confidence signals are rejected during Ralph Loop validation."
}
```

## Troubleshooting

### Issue: No signals appear in CopilotKit

**Check:**
1. Ralph Loop running? `curl http://localhost:8001/health`
2. Signals validated? Check logs for `[RALPH-LOOP-VALIDATED]`
3. Graphiti accessible? `curl http://localhost:8000/health`

### Issue: Rejected signals appearing

**Problem:** Bypassed Ralph Loop validation

**Solution:**
- Ensure scraper uses `ralph-loop-node-client.js`
- Check for direct Supabase writes (should be removed)
- Verify all signals go through `/api/signals/validate`

### Issue: Low confidence signals validated

**Problem:** min_confidence=0.7 not enforced

**Solution:**
- Check Ralph Loop config: `min_confidence=0.7`
- Verify Pass 1 filtering is active
- Check Ralph Loop logs for validation failures

## Performance Metrics

Track these metrics during testing:

| Metric | Target | Actual |
|--------|--------|--------|
| Validation Time | < 3s | ___ |
| Query Response | < 2s | ___ |
| Validation Rate | > 70% | ___ |
| False Positive Rate | < 5% | ___ |

## Next Steps

After testing:

1. ✅ All queries return validated signals only
2. ✅ Rejected signals properly filtered
3. ✅ Temporal queries working
4. ✅ Evidence displayed correctly

Then:
- Deploy to production
- Monitor validation metrics
- Adjust confidence thresholds if needed
- Track user feedback on signal quality

---

**Integration Status:** ✅ Complete
**Iteration 08 Compliance:** ✅ Verified
**Testing Status:** 🧪 Ready to test
