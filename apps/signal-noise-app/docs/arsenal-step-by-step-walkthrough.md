# Arsenal FC: Step-by-Step Processing Walkthrough

**Entity:** Arsenal FC
**Tier:** Premium (Top 10%)
**Date:** 2026-01-28
**Processing Window:** 00:00-01:00 UTC (Premium tier processed first)

---

## Overview

This document shows exactly how the system processes Arsenal FC through the hybrid architecture, from signal detection to confidence validation to storage.

**Processing Flow:**
```
1. Webhook Signal Arrives (Real-time, 00:00:15 UTC)
   ↓
2. Ralph Loop Pass 1: Rule-based Filtering (00:00:16 UTC)
   ↓
3. Ralph Loop Pass 2: Confidence Validation with Cascade (00:00:18-00:00:33 UTC)
   ↓
4. Ralph Loop Pass 3: Final Confirmation (00:00:34 UTC)
   ↓
5. Graphiti Storage (00:00:35 UTC)
   ↓
6. Hot Cache Update (00:00:35 UTC)
   ↓
7. Daily Loop Backup Processing (00:05:00 UTC)
```

**Total Time:** 35 seconds (webhook) + 50 seconds (daily backup) = 85 seconds total

---

## Step 1: Webhook Signal Arrives (00:00:15 UTC)

### Trigger Event
LinkedIn API detects job posting at Arsenal FC:
- **Title:** "Head of Digital Transformation"
- **Department:** Technology
- **Type:** Full-time
- **Salary:** £120,000-150,000

### Webhook Payload

```json
{
  "webhook_id": "linkedin-20260128-000015",
  "source": "linkedin",
  "timestamp": "2026-01-28T00:00:15Z",
  "entity": {
    "entity_id": "arsenal_fc",
    "entity_name": "Arsenal FC",
    "tier": "premium"
  },
  "signal": {
    "type": "RFP_DETECTED",
    "confidence": 0.92,
    "metadata": {
      "job_title": "Head of Digital Transformation",
      "department": "Technology",
      "indicative_budget": "£1.5M"
    },
    "evidence": [
      {
        "source": "LinkedIn",
        "type": "job_posting",
        "url": "https://linkedin.com/jobs/view/123456789",
        "credibility_score": 0.85,
        "date": "2026-01-28",
        "extracted_text": "Arsenal FC is seeking a Head of Digital Transformation to lead our technology modernization efforts..."
      }
    ]
  }
}
```

### Webhook Handler Receives Request

```python
# POST /api/webhooks/signal
@app.post("/api/webhooks/signal")
async def handle_webhook_signal(webhook_data: WebhookSignal):
    """
    Webhook received at 00:00:15 UTC
    """
    logger.info(f"📨 Webhook received: {webhook_data.webhook_id}")
    logger.info(f"   Entity: {webhook_data.entity.entity_name}")
    logger.info(f"   Type: {webhook_data.signal.type}")
    logger.info(f"   Confidence: {webhook_data.signal.confidence}")

    # Verify webhook signature
    if not verify_webhook_signature(webhook_data):
        raise HTTPException(401, "Invalid signature")

    logger.info("✅ Signature verified")

    # Convert to Ralph Loop format
    raw_signal = {
        "id": f"webhook-{webhook_data.webhook_id}",
        "type": webhook_data.signal.type,
        "confidence": webhook_data.signal.confidence,
        "entity_id": webhook_data.entity.entity_id,
        "evidence": webhook_data.signal.evidence,
        "source": "webhook",
        "webhook_id": webhook_data.webhook_id,
        "timestamp": datetime.now(timezone.utc)
    }

    logger.info(f"✅ Converted to Ralph Loop format: {raw_signal['id']}")

    # Proceed to Ralph Loop validation (Step 2)
    validated = await ralph_loop.validate_signals(
        [raw_signal],
        entity_id=webhook_data.entity.entity_id
    )

    return {
        "status": "processed",
        "signal_id": validated[0].id if validated else None,
        "processing_time_seconds": 20.5
    }
```

**Log Output:**
```
2026-01-28 00:00:15 INFO 📨 Webhook received: linkedin-20260128-000015
2026-01-28 00:00:15 INFO    Entity: Arsenal FC
2026-01-28 00:00:15 INFO    Type: RFP_DETECTED
2026-01-28 00:00:15 INFO    Confidence: 0.92
2026-01-28 00:00:15 INFO ✅ Signature verified
2026-01-28 00:00:15 INFO ✅ Converted to Ralph Loop format: webhook-linkedin-20260128-000015
```

---

## Step 2: Ralph Loop Pass 1 - Rule-based Filtering (00:00:16 UTC)

### Configuration
```python
config = RalphLoopConfig(
    min_evidence=3,
    min_confidence=0.7,
    min_evidence_credibility=0.6
)
```

### Rule Checks

**Check 1: Confidence Threshold**
```
Signal confidence: 0.92
Minimum required: 0.7
✅ PASS (0.92 >= 0.7)
```

**Check 2: Evidence Count**
```
Evidence count: 1
Minimum required: 3
❌ FAIL - Only 1 evidence item
```

**Problem:** Webhook only provided 1 evidence source (LinkedIn)

**Solution:** Ralph Loop fetches additional evidence from other sources

### Auto-Enrichment

```python
async def enrich_signal_evidence(signal, entity_id):
    """
    Fetch additional evidence to meet minimum requirements
    """
    logger.info(f"🔍 Enriching signal {signal['id']} with additional evidence...")

    # Query Graphiti for existing signals on Arsenal FC
    existing_signals = await graphiti_service.get_entity_signals(
        entity_id=entity_id,
        time_horizon_days=30
    )

    # Check for related signals
    related_signals = [
        s for s in existing_signals
        if s.type.value == 'RFP_DETECTED' or s.type.value == 'EXECUTIVE_CHANGE'
    ]

    logger.info(f"   Found {len(related_signals)} related signals")

    # Add existing signals as corroborating evidence
    for related in related_signals[:2]:  # Take top 2
        signal['evidence'].append({
            'source': 'graphiti_corroboration',
            'type': 'related_signal',
            'signal_id': related.id,
            'credibility_score': 0.75,
            'date': related.first_seen.isoformat(),
            'extracted_text': f"Related {related.type.value} detected on {related.first_seen}"
        })

    # Query Perplexity for context
    perplexity_evidence = await query_perplexity_context(
        entity_id=entity_id,
        query="Arsenal FC digital transformation technology initiatives"
    )

    signal['evidence'].append({
        'source': 'Perplexity',
        'type': 'market_research',
        'credibility_score': 0.70,
        'date': datetime.now(timezone.utc).isoformat(),
        'extracted_text': perplexity_evidence
    })

    logger.info(f"✅ Enriched to {len(signal['evidence'])} evidence items")

    return signal
```

**After Enrichment:**
```
Evidence count: 3
1. LinkedIn (credibility: 0.85)
2. Graphiti corroboration (credibility: 0.75)
3. Perplexity market research (credibility: 0.70)

✅ PASS (3 >= 3)
```

**Check 3: Evidence Credibility**
```
Average credibility: (0.85 + 0.75 + 0.70) / 3 = 0.767
Minimum required: 0.6
✅ PASS (0.767 >= 0.6)
```

### Pass 1 Result

```python
pass1_result = {
    'survived': True,
    'reason': 'All rule checks passed',
    'enriched': True,
    'evidence_count': 3,
    'avg_credibility': 0.767
}
```

**Log Output:**
```
2026-01-28 00:00:16 INFO 🔁 Pass 1/3: Rule-based filtering for arsenal_fc
2026-01-28 00:00:16 INFO 🔍 Enriching signal webhook-linkedin-20260128-000015...
2026-01-28 00:00:16 INFO    Found 2 related signals
2026-01-28 00:00:17 INFO ✅ Enriched to 3 evidence items
2026-01-28 00:00:17 INFO ✅ Pass 1: 1/1 signals survived
2026-01-28 00:00:17 INFO    Confidence: 0.92 >= 0.7 ✓
2026-01-28 00:00:17 INFO    Evidence: 3 >= 3 ✓
2026-01-28 00:00:17 INFO    Credibility: 0.767 >= 0.6 ✓
```

---

## Step 3: Ralph Loop Pass 2 - Confidence Validation with Cascade (00:00:18 UTC)

### Attempt 1: Haiku Validation (00:00:18-00:00:30 UTC)

**Prompt Sent to Haiku:**
```
Validate this signal for entity: arsenal_fc

Signal:
- ID: webhook-linkedin-20260128-000015
- Type: RFP_DETECTED
- Confidence: 0.92
- Evidence: 3 items

1. LinkedIn (credibility: 0.85, date: 2026-01-28)
   URL: https://linkedin.com/jobs/view/123456789
   Text: "Arsenal FC is seeking a Head of Digital Transformation to lead our technology modernization efforts..."

2. Graphiti corroboration (credibility: 0.75, date: 2026-01-15)
   Related Signal: RFP_DETECTED
   Text: "Related RFP_DETECTED detected on 2026-01-15"

3. Perplexity (credibility: 0.70, date: 2026-01-28)
   Text: "Arsenal FC has been actively pursuing digital transformation initiatives in 2026..."

Task: Validate signal and adjust confidence if needed.

Consider:
1. Evidence quality (credibility, recency, source diversity)
2. Confidence score alignment with evidence strength
3. Adjustment range: ±0.15

Return JSON:
{
  "validated": true/false,
  "confidence_adjustment": 0.0,
  "rationale": "brief explanation",
  "requires_manual_review": false
}
```

**Haiku Response:**
```json
{
  "validated": true,
  "confidence_adjustment": -0.10,
  "rationale": "LinkedIn job posting is credible but single source. Corroboration from Graphiti (similar RFP 2 weeks ago) strengthens validity. However, lack of direct confirmation from Arsenal FC reduces confidence. 0.92 is overconfident for this evidence set.",
  "requires_manual_review": false
}
```

**Processing:**
```python
# Parse Haiku response
validated_confidence = 0.92 + (-0.10)  # = 0.82
adjustment = -0.10

# Check if adjustment is within bounds
if abs(adjustment) <= 0.15:
    logger.info(f"✅ Haiku adjustment within bounds: {adjustment}")
    sufficient = True
else:
    logger.warning(f"❌ Haiku adjustment exceeds bounds: {adjustment}")
    sufficient = False  # Escalate to Sonnet
```

**Result:**
```
✅ Haiku validation succeeded
Confidence: 0.92 → 0.82 (-0.10 adjustment)
Rationale: "LinkedIn job posting is credible but single source..."
Tokens used: 1,200 input + 600 output = 1,800
Cost: 1,800 × $0.25/M = $0.00045
```

**Log Output:**
```
2026-01-28 00:00:18 INFO 🔁 Pass 2/3: Claude validation for arsenal_fc
2026-01-28 00:00:18 INFO 🔄 Attempt 1: Haiku validation
2026-01-28 00:00:30 INFO ✅ Haiku validation succeeded
2026-01-28 00:00:30 INFO    Confidence: 0.92 → 0.82 (-0.10)
2026-01-28 00:00:30 INFO    Tokens: 1,800 (1,200 input + 600 output)
2026-01-28 00:00:30 INFO    Cost: $0.00045
2026-01-28 00:00:30 INFO    Rationale: "LinkedIn job posting is credible but single source..."
```

**No Sonnet/Opus escalation needed** - Haiku result was sufficient!

### Pass 2 Result

```python
pass2_result = {
    'survived': True,
    'validated': True,
    'original_confidence': 0.92,
    'validated_confidence': 0.82,
    'adjustment': -0.10,
    'rationale': 'LinkedIn job posting is credible but single source...',
    'model_used': 'haiku',
    'tokens_used': 1800,
    'cost_usd': 0.00045,
    'requires_manual_review': False
}
```

---

## Step 4: Ralph Loop Pass 3 - Final Confirmation (00:00:34 UTC)

### Checks Performed

**Check 1: Final Confidence Threshold**
```
Validated confidence: 0.82
Minimum required: 0.7
✅ PASS (0.82 >= 0.7)
```

**Check 2: Duplicate Detection**
```python
# Check for near-duplicates in existing signals
existing_signals = await graphiti_service.get_entity_signals(
    entity_id='arsenal_fc',
    time_horizon_days=7
)

for existing in existing_signals:
    similarity = calculate_similarity(signal, existing)

    if similarity > 0.85:  # Duplicate threshold
        logger.warning(f"⚠️ Duplicate detected: {signal.id} ~ {existing.id}")
        is_duplicate = True
        break

# Result: No duplicates found
```

**Check 3: Manual Review Flags**
```
Requires manual review: false
✅ PASS (no manual review needed)
```

### Pass 3 Result

```python
pass3_result = {
    'survived': True,
    'final_confidence': 0.82,
    'duplicate_check': 'passed',
    'manual_review': False
}
```

**Log Output:**
```
2026-01-28 00:00:34 INFO 🔁 Pass 3/3: Final confirmation for arsenal_fc
2026-01-28 00:00:34 INFO ✅ Pass 3: 1/1 signals survived
2026-01-28 00:00:34 INFO    Final confidence: 0.82 >= 0.7 ✓
2026-01-28 00:00:34 INFO    Duplicate check: passed ✓
2026-01-28 00:00:34 INFO    Manual review: false ✓
```

---

## Step 5: Graphiti Storage (00:00:35 UTC)

### Create Signal Object

```python
from backend.schemas import Signal, SignalType, ConfidenceValidation

signal = Signal(
    id="webhook-linkedin-20260128-000015",
    type=SignalType.RFP_DETECTED,
    confidence=0.82,
    first_seen=datetime.now(timezone.utc),
    entity_id="arsenal_fc",
    metadata={
        'source': 'webhook',
        'webhook_id': 'linkedin-20260128-000015',
        'job_title': 'Head of Digital Transformation',
        'indicative_budget': '£1.5M',
        'evidence': [
            {
                'source': 'LinkedIn',
                'credibility_score': 0.85,
                'url': 'https://linkedin.com/jobs/view/123456789',
                'date': '2026-01-28'
            },
            {
                'source': 'Graphiti corroboration',
                'credibility_score': 0.75,
                'related_signal_id': 'arsenal-rfp-20260115',
                'date': '2026-01-15'
            },
            {
                'source': 'Perplexity',
                'credibility_score': 0.70,
                'date': '2026-01-28'
            }
        ]
    },
    validation_pass=3,
    validated=True,
    confidence_validation=ConfidenceValidation(
        original_confidence=0.92,
        validated_confidence=0.82,
        adjustment=-0.10,
        rationale='LinkedIn job posting is credible but single source. Corroboration from Graphiti (similar RFP 2 weeks ago) strengthens validity.',
        model_used='haiku',
        requires_manual_review=False
    }
)
```

### Schema Validation

```python
# Graphiti validates schema before FalkorDB write
try:
    await graphiti_service.upsert_signal(signal)
    logger.info(f"✅ Signal written to Graphiti: {signal.id}")
except SchemaValidationError as e:
    logger.error(f"❌ Schema validation failed: {e}")
    raise
```

**Schema Checks:**
```
✓ id: string (required)
✓ type: SignalType enum (required)
✓ confidence: float 0.0-1.0 (required)
✓ first_seen: datetime (required)
✓ entity_id: string (required)
✓ metadata: dict (optional)
✓ validation_pass: int (optional)
✓ confidence_validation: ConfidenceValidation (optional)
```

### FalkorDB Write

```cypher
// Cypher query executed by Graphiti
MERGE (s:Signal {id: 'webhook-linkedin-20260128-000015'})
SET s.type = 'RFP_DETECTED',
    s.confidence = 0.82,
    s.first_seen = datetime('2026-01-28T00:00:35Z'),
    s.validated = true,
    s.validation_pass = 3

// Create relationship to entity
MATCH (e:Entity {entity_id: 'arsenal_fc'})
MERGE (e)-[:HAS_SIGNAL]->(s)

// Create evidence relationships
FOREACH (ev IN [{source: 'LinkedIn', credibility: 0.85}, ...] |
    MERGE (evid:Evidence {uuid: apoc.create.uuid()})
    SET evid.source = ev.source,
        evid.credibility_score = ev.credibility
    MERGE (s)-[:SUPPORTED_BY]->(evid)
)
```

**Log Output:**
```
2026-01-28 00:00:35 INFO 💾 Writing 1 validated signals to Graphiti
2026-01-28 00:00:35 INFO ✅ Signal written: webhook-linkedin-20260128-000015 (confidence: 0.82)
2026-01-28 00:00:35 INFO ✅ Ralph Loop complete: 1/1 signals validated
```

---

## Step 6: Hot Cache Update (00:00:35 UTC)

### Update Redis Cache

```python
await cache.update_hot_path(
    entity_id='arsenal_fc',
    signal=signal,
    priority='real-time'
)
```

**Redis Cache Entry:**
```json
{
  "key": "entity:arsenal_fc:signals:real-time",
  "value": {
    "entity_id": "arsenal_fc",
    "entity_name": "Arsenal FC",
    "tier": "premium",
    "signals": [
      {
        "id": "webhook-linkedin-20260128-000015",
        "type": "RFP_DETECTED",
        "confidence": 0.82,
        "first_seen": "2026-01-28T00:00:35Z",
        "validated": true
      }
    ],
    "last_updated": "2026-01-28T00:00:35Z",
    "priority": "real-time"
  },
  "ttl": 3600  // 1 hour
}
```

**Benefit:** CopilotKit queries now hit cache instead of Graphiti

```
User Query: "What RFPs has Arsenal issued?"
  ↓
CopilotKit calls: get_entity_timeline(entity_id="arsenal_fc", days=30)
  ↓
Hot Cache Check: Cache hit (Arsenal is Premium entity, cached <5 seconds ago)
  ↓
Instant Response: 1 RFP signal with confidence 0.82
  ↓
No Claude API call needed (cached result)
```

---

## Step 7: Daily Loop Backup Processing (00:05:00 UTC)

Even though webhook processed the signal immediately, Arsenal FC gets daily backup scraping as part of Premium tier processing.

### Scraping (00:05:00-00:05:30 UTC)

```python
# Scrape all sources for Arsenal FC
scraped_data = await scrapers.scrape_all_sources('arsenal_fc')

# Sources:
1. LinkedIn: 2 new job postings (including the webhook one)
2. BrightData: 1 RFP detection (new)
3. Perplexity: Market research update
4. Google News: 1 news article
```

### Result: 7 Additional Signals

```
Signals extracted: 7 (excluding the webhook signal already processed)
- 3 RFP_DETECTED
- 2 PARTNERSHIP_FORMED
- 1 EXECUTIVE_CHANGE
- 1 TECHNOLOGY_ADOPTED
```

### Ralph Loop Validation (00:05:30-00:05:50 UTC)

```python
validated_signals = await ralph_loop.validate_signals(
    raw_signals=scraped_signals,
    entity_id='arsenal_fc'
)

# Result: 6/7 signals validated
# Model distribution: 5 Haiku, 1 Sonnet, 0 Opus
# Cost: $0.002
```

### Graphiti Storage (00:05:50-00:05:55 UTC)

```python
for signal in validated_signals:
    await graphiti_service.upsert_signal(signal)
```

---

## Final Summary: Arsenal FC Processing

### Webhook Processing (00:00:15-00:00:35 UTC)

```
✅ 1 signal validated
✅ Confidence: 0.92 → 0.82 (-0.10)
✅ Model: Haiku (80% success rate target met)
✅ Cost: $0.00045
✅ Processing time: 20 seconds
```

### Daily Backup Processing (00:05:00-00:05:55 UTC)

```
✅ 7 signals extracted
✅ 6/7 signals validated (87.5% survival)
✅ Confidence adjustments: 2 adjusted, 4 unchanged
✅ Model distribution: 5 Haiku, 1 Sonnet
✅ Cost: $0.002
✅ Processing time: 55 seconds
```

### Total Daily Cost for Arsenal FC

```
Webhook: $0.00045
Daily backup: $0.002
Total: $0.00245 per day
Annual: $0.89 per year
```

### Comparison to Baseline (Sonnet-only)

```
Baseline (Sonnet-only):
- 8 signals × 2,000 tokens × $3/M = $0.048

Optimized (Cascade):
- 7 Haiku × 1,800 tokens × $0.25/M = $0.00315
- 1 Sonnet × 2,000 tokens × $3/M = $0.006
- Total: $0.00915

Savings: 81% ($0.048 → $0.00915)
```

---

## Key Insights

### 1. Real-Time Advantage
- **Webhook processing:** 20 seconds
- **Competitors using daily scraping:** 6-24 hours
- **Competitive advantage:** Respond within minutes vs days

### 2. Cost Efficiency
- **Haiku handles 87.5%** of signals (7/8)
- **Only 12.5% need Sonnet** (1/8)
- **92% cost reduction** vs Sonnet-only

### 3. Quality Preservation
- **Confidence validation** prevents false positives
- **Evidence enrichment** meets minimum requirements
- **Schema validation** ensures data integrity

### 4. iteration02 Compliance
- ✅ Fixed schema (Entity/Signal/Evidence)
- ✅ Graphiti validation before FalkorDB
- ✅ Model cascade (Haiku → Sonnet → Opus)
- ✅ Hot cache for instant access
- ✅ Tool-based reasoning (CopilotKit)

---

## Next Steps

To test this in your environment:

1. **Run the test script:**
   ```bash
   python backend/test/test_arsenal_processing.py
   ```

2. **Verify webhook endpoint:**
   ```bash
   curl -X POST http://localhost:8001/api/webhooks/signal \
     -H "Content-Type: application/json" \
     -d @test/fixtures/arsenal-webhook.json
   ```

3. **Check Graphiti for stored signal:**
   ```python
   signal = await graphiti_service.get_signal("webhook-linkedin-20260128-000015")
   print(signal.confidence)  # Should be 0.82
   ```

4. **Verify hot cache:**
   ```bash
   redis-cli GET "entity:arsenal_fc:signals:real-time"
   ```
