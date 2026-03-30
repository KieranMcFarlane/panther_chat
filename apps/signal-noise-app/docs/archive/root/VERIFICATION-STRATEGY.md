# Signal Noise - Production Verification Strategy

**Production-grade testing approach aligned with iteration_02, iteration_08, and temporal intelligence design.**

---

## Executive Summary

This document defines the **canonical verification strategy** for Signal Noise, addressing 6 critical gaps identified in the initial draft to ensure production readiness.

### The 6 Issues Fixed

1. ✅ **SMS removed** from expected output (not implemented)
2. ✅ **Alerts are async side-effects** (don't block `/validate`)
3. ✅ **iteration_02 invariant enforced**: Claude sees only verified evidence
4. ✅ **Temporal prior backoff chain** tested (entity → cluster → global)
5. ✅ **Temporal accuracy metrics** defined (window hit rate, MAE, calibration)
6. ✅ **Yellow Panther scoring clarified**: doesn't affect validation truth

---

## Part 1: Critical Invariants

### 1.1 iteration_02 Core Contract

**INVARIANT**: Claude reasons over VERIFIED evidence summaries, NOT raw scrape text.

**What this means**:
- ✅ Pass 1.5 evidence verification runs BEFORE Pass 2 Claude validation
- ✅ Claude input contains verification summary, not raw HTML/OCR
- ✅ Claude sees: "67% verified (2/3), 1 URL failed, actual credibility: 0.72"
- ❌ Claude NEVER sees: Raw HTML dumps, full OCR text, unverified URLs

**Test enforcement**:
```python
# backend/tests/test_iteration_02_invariant.py

def test_claude_input_contains_only_verified_summaries():
    """
    Verify Claude never sees raw scrape text.
    """
    candidate = create_test_candidate(
        evidence=[
            EvidenceItem(
                source="LinkedIn",
                url="https://linkedin.com/jobs/arsenal-crm",
                extracted_text="Full scrape text here...",
                verified=True,
                credibility_score=0.85
            ),
            EvidenceItem(
                source="Fake Site",
                url="https://fake-site.com/job",
                extracted_text="Fake text here...",
                verified=False,  # URL not accessible
                credibility_score=0.50
            )
        ]
    )

    # Run Pass 1.5: Evidence verification
    verifier = EvidenceVerifier()
    verification_summary = await verifier.verify_evidence(candidate.evidence)

    # Build Claude input (Pass 2)
    claude_input = build_claude_prompt(candidate, verification_summary)

    # ASSERT: Claude input contains verification summary, NOT raw text
    assert "verification_rate" in claude_input
    assert "67% verified" in claude_input or "50% verified" in claude_input
    assert "actual_credibility" in claude_input

    # ASSERT: Claude input does NOT contain raw scrape text
    assert "Full scrape text here..." not in claude_input
    assert "Fake text here..." not in claude_input

    # ASSERT: Claude input does NOT contain unverified URLs
    assert "https://fake-site.com/job" not in claude_input
```

### 1.2 Temporal Multiplier Bounds

**INVARIANT**: Temporal multipliers always clamped to [0.75, 1.40].

**Test enforcement**:
```python
# backend/tests/test_temporal_bounds.py

def test_temporal_multiplier_clamped():
    """
    Verify temporal multipliers never exceed [0.75, 1.40].
    """
    service = TemporalPriorService()

    # Test extreme seasonality (would exceed 1.40)
    multiplier = await service.compute_multiplier(
        entity_id="arsenal",
        signal_category="CRM",
        seasonality=0.95,  # 95% in Q1 (extreme)
        recurrence_score=1.0,  # Perfect timing
        momentum_score=1.0  # High momentum
    )

    # ASSERT: Clamped to 1.40
    assert multiplier <= 1.40
    assert multiplier >= 0.75
```

### 1.3 iteration_08 Authoritative Source

**INVARIANT**: Graphiti is authoritative - NO fallbacks to other databases.

**Test enforcement**:
```python
# backend/tests/test_iteration_08_invariant.py

def test_graphiti_authoritative_no_fallbacks():
    """
    Verify Graphiti service raises error instead of falling back.
    """
    service = GraphitiService(use_supabase=False, use_falkordb=False)

    with pytest.raises(Exception) as exc_info:
        await service.get_entity_timeline("arsenal")

    # ASSERT: Error message is clear about NO FALLBACKS
    assert "Graphiti service unreachable" in str(exc_info.value)
    assert "NO FALLBACK" in str(exc_info.value)
```

### 1.4 Yellow Panther Scoring Separation

**INVARIANT**: YP scoring does NOT affect validation truth - only routing.

**What this means**:
- ✅ Low fit scores (e.g., 15/100 for CRM) still store validated signals
- ✅ YP scoring only affects alert routing (TIER_1-TIER_4)
- ✅ All validated signals stored in Graphiti for learning

**Test enforcement**:
```python
# backend/tests/test_yp_scoring_separation.py

def test_yp_scoring_does_not_affect_validation():
    """
    Verify YP fit score doesn't change validation outcome.
    """
    candidate = create_test_candidate(
        entity_id="arsenal",
        category="CRM",  # Not a YP strength
        raw_confidence=0.88,  # High confidence
        evidence=[create_verified_evidence()]
    )

    # Run Ralph Loop
    workflow = RFPDiscoveryWorkflow()
    validated = await workflow._run_ralph_loop(candidate)

    # ASSERT: Signal validated despite low YP fit
    assert validated.validated == True
    assert validated.confidence >= 0.85

    # ASSERT: YP fit score is low (CRM not a strength)
    assert validated.yellow_panther_fit_score < 30

    # ASSERT: Priority is TIER_4 (dashboard only)
    assert validated.yellow_panther_priority == "TIER_4"

    # ASSERT: Still stored in Graphiti
    assert validated.graphiti_episode_id is not None
```

---

## Part 2: Alert System Verification

### 2.1 Async Side-Effects (Critical Fix)

**Issue**: E2E test assumed alerts run synchronously inside `/validate` endpoint.

**Fix**: Alerts must be async side-effects - don't block validation API.

**Canonical behavior**:
```
1. POST /validate → returns validation result immediately
2. Alert queue → background processing (Celery/RQ/asyncio)
3. Delivery logs → tracked in alert_logs table
4. Tests → verify alert_plan, then check logs separately
```

**Implementation**:
```python
# backend/alerts/alert_manager.py

class AlertManager:
    def __init__(self):
        self.alert_queue = asyncio.Queue()
        self.audit_logger = AuditLogger()

    async def send_alert_async(self, opportunity: Dict, tier: str):
        """
        Non-blocking alert delivery.
        Queues alert for background processing.
        """
        alert_task = {
            "opportunity": opportunity,
            "tier": tier,
            "timestamp": datetime.now().isoformat(),
            "tracking_id": f"alert_{uuid4().hex[:8]}"
        }

        # Queue for background processing (non-blocking)
        await self.alert_queue.put(alert_task)

        return alert_task["tracking_id"]

    async def process_alert_queue(self):
        """
        Background task - runs continuously.
        Processes alerts from queue asynchronously.
        """
        while True:
            alert = await self.alert_queue.get()

            try:
                # Deliver alert
                channels = self._get_channels_for_tier(alert["tier"])
                delivery_results = []

                for channel in channels:
                    result = await self._deliver_via_channel(alert, channel)
                    delivery_results.append(result)

                # Log delivery
                await self.audit_logger.log_alert_delivered(
                    tracking_id=alert["tracking_id"],
                    channels=channels,
                    results=delivery_results
                )

            except Exception as e:
                logger.error(f"Alert delivery failed: {e}")
                await self._retry_alert(alert)

    async def _deliver_via_channel(self, alert: Dict, channel: str) -> Dict:
        """Deliver alert via specific channel."""
        if channel == "email":
            return await self.email_client.send(alert)
        elif channel == "webhook":
            return await self.webhook_client.send(alert)
        elif channel == "slack":
            return await self.slack_client.send(alert)
        else:
            return {"status": "unknown_channel", "channel": channel}
```

**API Response** (returns immediately):
```json
{
  "validated": true,
  "confidence_raw": 0.78,
  "confidence_final": 1.00,
  "temporal": {
    "multiplier": 1.40,
    "backoff_level": "entity_category"
  },
  "yellow_panther": {
    "fit_score": 85,
    "priority": "TIER_1"
  },
  "alert_plan": ["email", "webhook", "slack"],
  "alerts_sent": [],
  "alert_tracking_id": "alert_a1b2c3d4"
}
```

**Note**: `alerts_sent` is empty because delivery happens async. Client polls `/api/alerts/{tracking_id}` for delivery status.

### 2.2 Alert Delivery Tracking

**Polling endpoint**:
```http
GET /api/alerts/{tracking_id}

Response:
{
  "tracking_id": "alert_a1b2c3d4",
  "status": "delivered",
  "channels": [
    {"channel": "email", "status": "sent", "timestamp": "2025-01-31T10:05:00Z"},
    {"channel": "webhook", "status": "delivered", "timestamp": "2025-01-31T10:05:01Z"},
    {"channel": "slack", "status": "posted", "timestamp": "2025-01-31T10:05:02Z"}
  ]
}
```

### 2.3 Test: Alert Plan Verification

**Unit test** (verifies plan, not delivery):
```python
# backend/tests/test_alert_manager.py

async def test_tier_1_alert_plan():
    """
    Verify TIER_1 triggers all configured channels.
    """
    opportunity = create_test_opportunity(
        fit_score=95,
        confidence_final=0.92,
        temporal_multiplier=1.35
    )

    manager = AlertManager()
    plan = manager.build_plan(opportunity)

    # ASSERT: Correct tier
    assert plan.tier == "TIER_1"

    # ASSERT: All channels planned
    assert plan.channels == {"email", "webhook", "slack"}

    # ASSERT: Queued for async delivery
    tracking_id = await manager.send_alert_async(opportunity, tier="TIER_1")
    assert tracking_id is not None
    assert tracking_id.startswith("alert_")
```

**Integration test** (verifies delivery logged):
```python
async def test_alert_delivery_logged():
    """
    Verify alert delivery logged in Supabase.
    """
    opportunity = create_test_opportunity(fit_score=95)
    tracking_id = await alert_manager.send_alert_async(opportunity, tier="TIER_1")

    # Wait for background processing
    await asyncio.sleep(2)

    # Check logs
    rows = await supabase.table("alert_logs").select("*").eq("tracking_id", tracking_id)

    # ASSERT: Delivery logged
    assert len(rows.data) >= 1
    assert rows.data[0]["status"] in ["sent", "delivered", "posted"]
```

---

## Part 3: Temporal Prior Verification

### 3.1 Backoff Chain Tests

**Critical**: Temporal priors must use correct backoff level.

**Test cases**:
```python
# backend/tests/test_temporal_backoff_chain.py

def test_backoff_entity_category():
    """
    entity_category prior exists → used (highest priority).
    """
    adj = svc.get_multiplier("arsenal", "CRM", ts=now)

    # ASSERT: entity_category level
    assert adj.backoff_level == "entity_category"
    assert adj.multiplier > 1.0  # Should have historical data

def test_backoff_cluster():
    """
    No entity_category prior → cluster used.
    """
    # Entity with no CRM history
    adj = svc.get_multiplier("unknown_team", "CRM", ts=now)

    # ASSERT: Cluster or global level
    assert adj.backoff_level in ["cluster_category", "global"]
    assert adj.multiplier >= 0.75

def test_backoff_global():
    """
    No entity or cluster prior → global used.
    """
    # Completely new entity
    adj = svc.get_multiplier("brand_new_team", "NEW_CATEGORY", ts=now)

    # ASSERT: Global fallback
    assert adj.backoff_level == "global"
    assert adj.multiplier == 1.0  # Neutral

def test_backoff_neutral():
    """
    No priors at all → neutral (1.0).
    """
    # Empty temporal priors database
    with mock.patch.object(svc, 'load_priors', return_value={}):
        adj = svc.get_multiplier("any_entity", "any_category", ts=now)

        # ASSERT: Neutral fallback
        assert adj.multiplier == 1.0
        assert adj.backoff_level == "neutral"
```

### 3.2 Temporal Accuracy Metrics (Fix #5)

**Issue**: "Temporal predictions accurate (±10%)" was undefined.

**Fix**: Use measurable metrics.

#### Metric 1: Seasonal Window Hit Rate

**Definition**: % of validated signals that occur inside top predicted seasonal bins.

**Example**:
```python
# For Arsenal CRM:
# Prediction: Q1 = 80% (highest)
# Actual RFPs: 4 out of 5 occurred in Q1
# Hit rate = 4/5 = 80%

def test_seasonal_window_hit_rate():
    """
    Verify seasonal predictions match actual RFP timing.
    """
    entity_id = "arsenal"
    category = "CRM"

    # Get prediction
    prior = temporal_svc.get_temporal_prior(entity_id, category)
    predicted_quarter = max(prior["seasonality"], key=prior["seasonality"].get)  # "Q1"

    # Get actual RFPs
    actual_rf_ps = graphiti_svc.get_entity_timeline(entity_id, category)

    # Count RFPs in predicted quarter
    rf_ps_in_predicted_quarter = [
        rfp for rfp in actual_rf_ps
        if quarter_from_date(rfp["timestamp"]) == predicted_quarter
    ]

    hit_rate = len(rf_ps_in_predicted_quarter) / len(actual_rf_ps)

    # ASSERT: Hit rate should be > 60% for good predictions
    assert hit_rate > 0.60
```

#### Metric 2: Recurrence Mean Absolute Error (MAE)

**Definition**: Average error in days between predicted and actual recurrence intervals.

**Example**:
```python
def test_recurrence_mae():
    """
    Verify recurrence predictions are accurate.
    """
    entity_id = "arsenal"
    category = "CRM"

    # Get prediction
    prior = temporal_svc.get_temporal_prior(entity_id, category)
    expected_mean_days = prior["recurrence"]["mean_days"]  # e.g., 365

    # Get actual intervals
    actual_rf_ps = graphiti_svc.get_entity_timeline(entity_id, category)
    actual_intervals = [
        days_between(rf_ps[i]["timestamp"], rf_ps[i+1]["timestamp"])
        for i in range(len(actual_rf_ps) - 1)
    ]

    # Calculate MAE
    mae = mean([abs(interval - expected_mean_days) for interval in actual_intervals])

    # ASSERT: MAE should be < 45 days for good predictions
    assert mae < 45
```

#### Metric 3: Temporal Score Calibration

**Definition**: Higher temporal score buckets should have higher validation rates.

**Example**:
```python
def test_temporal_score_calibration():
    """
    Verify temporal scores are calibrated (higher score = higher validation rate).
    """
    # Get all signal candidates with temporal scores
    candidates = get_all_candidates_with_temporal_scores()

    # Bucket by temporal score
    buckets = {
        "high": [c for c in candidates if c["temporal_score"] >= 0.70],
        "low": [c for c in candidates if c["temporal_score"] <= 0.40]
    }

    # Calculate validation rate per bucket
    high_validation_rate = sum(1 for c in buckets["high"] if c["validated"]) / len(buckets["high"])
    low_validation_rate = sum(1 for c in buckets["low"] if c["validated"]) / len(buckets["low"])

    # ASSERT: High bucket should validate at higher rate than low bucket
    assert high_validation_rate > low_validation_rate
```

---

## Part 4: Integration Tests

### 4.1 Pipeline Integration Test

```bash
# scripts/test_pipeline_integration.py

python scripts/test_pipeline_integration.py \
  --entity arsenal \
  --category CRM \
  --expect validated=true \
  --expect alerts_planned=false  # Low YP fit score
```

**Expected output**:
```json
{
  "entity_id": "arsenal",
  "category": "CRM",
  "validated": true,
  "confidence_raw": 0.78,
  "confidence_final": 1.00,
  "temporal": {
    "temporal_score": 0.91,
    "multiplier": 1.40,
    "backoff_level": "entity_category"
  },
  "yellow_panther": {
    "fit_score": 15,
    "priority": "TIER_4"
  },
  "alert_plan": [],  # TIER_4 → no alerts
  "stored": {
    "graphiti_episode_id": "ep_arsenal_crm_001"
  }
}
```

### 4.2 E2E API Test

```bash
curl -X POST http://localhost:8001/api/signals/validate \
  -H "Content-Type: application/json" \
  -d @test_signal.json
```

**Response format** (with async alerts):
```json
{
  "validated": true,
  "confidence_raw": 0.78,
  "confidence_final": 1.00,
  "temporal": {
    "multiplier": 1.40,
    "backoff_level": "entity_category"
  },
  "yellow_panther": {
    "fit_score": 15,
    "priority": "TIER_4"
  },
  "alert_plan": [],
  "alerts_sent": [],
  "alert_tracking_id": "alert_a1b2c3d4",
  "stored": {
    "graphiti_episode_id": "ep_001"
  }
}
```

**Note**: `alerts_sent` is empty - check delivery via polling endpoint.

---

## Part 5: Unit Tests by Component

### 5.1 Evidence Verifier (Pass 1.5)

```bash
pytest backend/tests/test_evidence_verifier.py -v
```

**Test cases**:
- ✅ Rejects inaccessible URLs (404, timeout)
- ✅ Penalizes unverified credibility by -0.30
- ✅ Boosts verified credibility by +0.05
- ✅ Checks content matching (claimed vs actual)

### 5.2 Ralph Loop Pass 1 (Rule Filter)

```bash
pytest backend/tests/test_ralph_loop_pass_1.py -v
```

**Test cases**:
- ✅ Min evidence: 3 items required
- ✅ Min confidence: 0.70 (adjusted by temporal multiplier)
- ✅ Temporal threshold adjustment: 0.70 / multiplier
- ✅ Rejects if evidence count < 3
- ✅ Rejects if confidence < adjusted_threshold

### 5.3 Ralph Loop Pass 2 (Claude Validation)

```bash
pytest backend/tests/test_ralph_loop_pass_2_claude.py -v
```

**Test cases**:
- ✅ Claude sees only verified evidence summaries
- ✅ Claude input contains verification rate
- ✅ Claude input does NOT contain raw scrape text
- ✅ Confidence adjustment range: ±0.15
- ✅ Model cascade: Haiku (80%), Sonnet (15%), Opus (5%)

### 5.4 Temporal Prior Service

```bash
pytest backend/tests/test_temporal_prior_service.py -v
```

**Test cases**:
- ✅ Multiplier always clamped to [0.75, 1.40]
- ✅ Backoff chain: entity → cluster → global → neutral
- ✅ Seasonality computed correctly (Q1-Q4 distribution)
- ✅ Recurrence computed correctly (mean, std, z-score)
- ✅ Momentum computed correctly (30/90-day counts)

### 5.5 Yellow Panther Scorer

```bash
pytest backend/tests/test_yellow_panther_scorer.py -v
```

**Test cases**:
- ✅ Service match scoring (0-40 points)
- ✅ Budget alignment (0-25 points)
- ✅ Timeline fit (0-15 points)
- ✅ Entity size (0-10 points)
- ✅ Geographic fit (0-10 points)
- ✅ Total fit score: 0-100
- ✅ Priority tier assignment: TIER_1 (≥90), TIER_2 (≥70), TIER_3 (≥50), TIER_4 (<50)
- ✅ Does NOT affect validation truth (invariant test)

### 5.6 Alert Manager

```bash
pytest backend/tests/test_alert_manager.py -v
```

**Test cases**:
- ✅ TIER_1 triggers all channels (email, webhook, slack)
- ✅ TIER_2 triggers email + webhook + slack (1 hour delay)
- ✅ TIER_3 triggers daily digest email
- ✅ TIER_4 triggers weekly summary only
- ✅ Alerts queued async (don't block validation)
- ✅ Delivery logged in alert_logs table
- ✅ Retry on failure (3 attempts with exponential backoff)

### 5.7 Audit Logger

```bash
pytest backend/tests/test_audit_logger.py -v
```

**Test cases**:
- ✅ Signal detection logged
- ✅ Ralph Loop passes logged (1, 1.5, 2, 3)
- ✅ Alert delivery logged
- ✅ Entity interactions logged
- ✅ All logs stored in Supabase

---

## Part 6: Golden Signal Fixture

### 6.1 Fixture Dataset

Create `backend/tests/fixtures/golden_signals.jsonl`:

```jsonl
{"id": "golden_001", "entity": "arsenal", "category": "CRM", "validated": true, "confidence": 0.92, "yp_fit": 15, "outcome": "win"}
{"id": "golden_002", "entity": "chelsea", "category": "TICKETING", "validated": true, "confidence": 0.88, "yp_fit": 85, "outcome": "win"}
{"id": "golden_003", "entity": "mancity", "category": "ANALYTICS", "validated": false, "confidence": 0.45, "yp_fit": 0, "outcome": "loss"}
{"id": "golden_004", "entity": "liverpool", "category": "CRM", "validated": true, "confidence": 0.78, "yp_fit": 25, "outcome": "false_positive"}
{"id": "golden_005", "entity": "tottenham", "category": "MOBILE_APPS", "validated": true, "confidence": 0.95, "yp_fit": 92, "outcome": "win"}
{"id": "golden_006", "entity": "leicester", "category": "CONTENT", "validated": true, "confidence": 0.82, "yp_fit": 70, "outcome": "win"}
{"id": "golden_007", "entity": "westham", "category": "CRM", "validated": false, "confidence": 0.55, "yp_fit": 10, "outcome": "loss"}
{"id": "golden_008", "entity": "everton", "category": "ANALYTICS", "validated": true, "confidence": 0.89, "yp_fit": 65, "outcome": "win"}
{"id": "golden_009", "entity": "newcastle", "category": "TICKETING", "validated": false, "confidence": 0.62, "yp_fit": 0, "outcome": "false_positive"}
{"id": "golden_010", "entity": "villa", "category": "MARKETING", "validated": true, "confidence": 0.91, "yp_fit": 78, "outcome": "win"}
```

### 6.2 Regression Evaluation Script

```python
# scripts/regression_eval.py

import json
from backend.rfc_discovery_schema import discover_rfps_for_entity

async def evaluate_regression(fixture_path: str):
    """
    Evaluate system against golden fixture dataset.
    """
    with open(fixture_path) as f:
        golden_signals = [json.loads(line) for line in f]

    results = {
        "correct_validations": 0,
        "incorrect_validations": 0,
        "win_rate": 0,
        "false_positive_rate": 0
    }

    for signal in golden_signals:
        # Run discovery
        result = await discover_rfps_for_entity(
            entity_name=signal["entity"],
            entity_id=signal["entity"],
            categories=[signal["category"]]
        )

        # Check validation correctness
        validated = any(s.confidence >= 0.70 for s in result["validated_signals"])

        if validated == signal["validated"]:
            results["correct_validations"] += 1
        else:
            results["incorrect_validations"] += 1

    # Calculate metrics
    total = len(golden_signals)
    results["accuracy"] = results["correct_validations"] / total
    results["win_rate"] = sum(1 for s in golden_signals if s["outcome"] == "win") / total
    results["false_positive_rate"] = sum(1 for s in golden_signals if s["outcome"] == "false_positive") / total

    return results

if __name__ == "__main__":
    results = asyncio.run(evaluate_regression("backend/tests/fixtures/golden_signals.jsonl"))
    print(json.dumps(results, indent=2))
```

**Run evaluation**:
```bash
python scripts/regression_eval.py --fixture backend/tests/fixtures/golden_signals.jsonl
```

**Output**:
```json
{
  "correct_validations": 9,
  "incorrect_validations": 1,
  "accuracy": 0.90,
  "win_rate": 0.60,
  "false_positive_rate": 0.20
}
```

---

## Part 7: Success Criteria (Final)

### Functional

- ✅ Evidence verification rejects fake URLs at ≥99%
- ✅ Claude never sees raw scrape text (only verified summaries) - **iteration_02 invariant**
- ✅ Temporal priors computed nightly + present for ≥90% of entities
- ✅ Alerts route correctly by tier and fit score
- ✅ Graphiti episodes stored for every validated signal - **iteration_08 invariant**
- ✅ YP scoring does not affect validation truth (only routing)

### Performance

- ✅ Pass 1 + 1.5 < 500ms typical
- ✅ Full Ralph Loop < 10s per signal
- ✅ Alerts delivered < 30s for Tier 1 (async side-effects)
- ✅ Priors computation < 5 minutes / 3.4k entities

### Temporal Intelligence Quality

- ✅ Seasonal window hit-rate > 60% for high-confidence categories
- ✅ Recurrence MAE < 45 days for categories with enough history
- ✅ Temporal score bucket calibration:
  - bucket ≥0.70 validates at higher rate than ≤0.40

### Business

- ✅ False positives < 30%
- ✅ Weekly high-fit opportunities ≥ 8
- ✅ Tier 1 response time < 1 hour
- ✅ Win rate improvement tracked via outcomes table

---

## Appendix: Complete Test Suite

### Run All Tests

```bash
# Unit tests (fast, CI every commit)
pytest backend/tests/ -v -m "not integration and not e2e"

# Integration tests (nightly CI)
pytest backend/tests/ -v -m "integration"

# E2E tests (manual)
pytest backend/tests/ -v -m "e2e"

# Regression evaluation (golden fixture)
python scripts/regression_eval.py --fixture backend/tests/fixtures/golden_signals.jsonl
```

### Test Coverage

```bash
# Generate coverage report
pytest backend/tests/ --cov=backend --cov-report=html

# Open report
open htmlcov/index.html
```

**Target coverage**: ≥80% for critical modules:
- `ralph_loop.py`
- `evidence_verifier.py`
- `temporal_prior_service.py`
- `yellow_panther_scorer.py`
- `alert_manager.py`

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-31
**Status**: Production-Ready (all 6 issues addressed)
