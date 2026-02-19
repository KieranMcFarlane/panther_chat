# Temporal Sports Procurement Prediction Engine - MVP Design

**Date**: 2026-02-19
**Status**: Design Approved
**Implementation Start**: TBD
**Target Completion**: Week 1

---

## Executive Summary

Transform the Ralph Loop from a binary gatekeeper (pass/fail) into a classification engine that captures and uses ALL signals for predictive intelligence. The MVP focuses on signal classification and hypothesis-level state aggregation, leaving episode clustering and temporal decay for post-MVP phases.

**Problem**: Current system rejects early signals (capability indicators, job postings) because Ralph Loop requires 3 evidence pieces and 0.7 confidence - thresholds appropriate for sales outreach but too strict for predictive intelligence.

**Solution**: Multi-tier signal classification that stores CAPABILITY signals (currently discarded) and aggregates them into hypothesis-level prediction states.

---

## Scope

### IN (MVP)
- Signal Classification: `CAPABILITY`, `PROCUREMENT_INDICATOR`, `VALIDATED_RFP`
- Tier-specific validation rules (lower thresholds for weaker signals)
- Hypothesis-level state recalculation (`maturity_score`, `activity_score`)
- Signal → Hypothesis mapping (not signal-level state)
- Storage of ALL CAPABILITY signals (currently discarded)
- FalkorDB persistence of `HypothesisState` nodes
- REST API for accessing prediction scores
- Basic frontend display component

### OUT (Post-MVP)
- Episode clustering (Phase 2)
- Semantic embedding-based grouping
- Temporal decay weighting in EIG
- Velocity/acceleration metrics
- Three-axis dashboard scoring
- Watchlist engine

---

## Architecture

### Signal Classification Flow

```
Raw Signal
    ↓
Ralph Pass 1: Rule-based filter (existing)
    ↓
Ralph Pass 2: Claude validation (existing)
    ↓
Ralph Pass 3: Final confirmation (existing)
    ↓
NEW: classify_signal()
    ├─ WEAK_ACCEPT → CAPABILITY
    ├─ ACCEPT + <0.75 → PROCUREMENT_INDICATOR
    └─ ACCEPT + ≥0.75 → VALIDATED_RFP
    ↓
Tier Rules Check
    ├─ CAPABILITY: min_evidence=1, min_confidence=0.45
    ├─ PROCUREMENT_INDICATOR: min_evidence=2, min_confidence=0.60
    └─ VALIDATED_RFP: min_evidence=3, min_confidence=0.70
    ↓
Storage
    ├─ CAPABILITY → capability_signals[] (new)
    ├─ INDICATOR/RFP → validated_signals[] (existing)
    └─ All → recalculate_hypothesis_state()
```

### Hypothesis-Centric State Design

**Critical Decision**: State lives at hypothesis level, NOT signal level.

```
Signal → Hypothesis Mapping:
├── CAPABILITY signals → increase hypothesis.maturity_score
├── PROCUREMENT_INDICATOR → increase hypothesis.activity_score
└── VALIDATED_RFP → set hypothesis.state = LIVE
```

This prevents signal-level state chaos. All signals contribute to hypothesis-level scores.

---

## Data Model

### New Enums (schemas.py)

```python
class SignalClass(str, Enum):
    """Signal classification for predictive intelligence"""
    CAPABILITY = "CAPABILITY"
    PROCUREMENT_INDICATOR = "PROCUREMENT_INDICATOR"
    VALIDATED_RFP = "VALIDATED_RFP"
```

### New Dataclass (schemas.py)

```python
@dataclass
class HypothesisState:
    """Aggregated state at hypothesis level"""
    entity_id: str
    category: str
    maturity_score: float = 0.0     # From CAPABILITY signals
    activity_score: float = 0.0     # From PROCUREMENT_INDICATOR
    state: str = "MONITOR"           # MONITOR/WARM/ENGAGE/LIVE
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
```

### FalkorDB Schema

```cypher
(:Entity {id: "arsenal_fc"})-[:HAS_STATE]->(
  :HypothesisState {
    state_id: "arsenal_fc_crm_upgrade_state",
    entity_id: "arsenal_fc",
    category: "CRM_UPGRADE",
    maturity_score: 0.72,
    activity_score: 0.61,
    state: "WARM",
    last_updated: timestamp()
  }
)
```

---

## Component Specifications

### 1. Signal Classification

**File**: `backend/ralph_loop.py`

**Function**: `classify_signal(decision, confidence, source_domain) -> SignalClass`

```python
def classify_signal(
    decision: RalphDecisionType,
    confidence: float,
    source_domain: Optional[str] = None
) -> SignalClass:
    if decision == RalphDecisionType.WEAK_ACCEPT:
        return SignalClass.CAPABILITY

    if decision == RalphDecisionType.ACCEPT:
        if confidence >= 0.75:
            return SignalClass.VALIDATED_RFP

        if source_domain and any(tender in source_domain for tender in [
            'tender', 'bidnet', 'rfp.', 'procurement', 'contract'
        ]):
            return SignalClass.VALIDATED_RFP

        return SignalClass.PROCUREMENT_INDICATOR

    return None
```

### 2. Tier Validation Rules

**File**: `backend/ralph_loop.py`

```python
TIER_RULES = {
    SignalClass.CAPABILITY: TierValidationRules(
        min_evidence=1,
        min_confidence=0.45,
        storage_mode="immediate"
    ),
    SignalClass.PROCUREMENT_INDICATOR: TierValidationRules(
        min_evidence=2,
        min_confidence=0.60,
        storage_mode="clustered"
    ),
    SignalClass.VALIDATED_RFP: TierValidationRules(
        min_evidence=3,
        min_confidence=0.70,
        storage_mode="validated"
    ),
}
```

### 3. Hypothesis State Recalculation

**File**: `backend/ralph_loop.py`

**Function**: `recalculate_hypothesis_state(entity_id, category, graphiti_service) -> HypothesisState`

**Scoring Logic**:
- Each `CAPABILITY` signal → `maturity_score += 0.15`
- Each `PROCUREMENT_INDICATOR` → `activity_score += 0.25`
- Each `VALIDATED_RFP` → `state = LIVE`

**State Transitions**:
- `LIVE`: `validated_rfp_count >= 1`
- `ENGAGE`: `activity_score >= 0.6`
- `WARM`: `activity_score >= 0.4` OR `maturity_score >= 0.5`
- `MONITOR`: default

### 4. Persistence Layer

**File**: `backend/hypothesis_persistence_native.py`

**Methods**:
- `save_hypothesis_state(hypothesis_state)` - MERGE to FalkorDB
- `get_hypothesis_state(entity_id, category)` - Retrieve single state
- `get_all_hypothesis_states(entity_id)` - Retrieve all states for entity

### 5. API Layer

**Backend**: `backend/scoring_routes.py`
- `GET /api/scoring/{entity_id}` - Get all hypothesis states
- `GET /api/scoring/{entity_id}/category/{category}` - Get specific category
- `POST /api/scoring/{entity_id}/recalculate` - Force recalculation

**Frontend**: `src/app/api/scoring/route.ts`
- Proxy to backend FastAPI service

### 6. Frontend Component

**File**: `src/components/entity-dossier/ScoreCard.tsx`

Display component showing:
- Category name
- Maturity score (0-100%)
- Activity score (0-100%)
- State badge (MONITOR/WARM/ENGAGE/LIVE)

---

## Testing Strategy

### Unit Tests

**File**: `backend/tests/test_signal_classification.py`

- `test_classify_weak_accept()` → CAPABILITY
- `test_classify_accept_low_confidence()` → PROCUREMENT_INDICATOR
- `test_classify_accept_high_confidence()` → VALIDATED_RFP
- `test_classify_tender_domain()` → VALIDATED_RFP

### Integration Tests

**File**: `backend/tests/test_mvp_integration.py`

- `test_end_to_end_classification()` - Full flow from raw signals to hypothesis state
- `test_capability_signal_storage()` - Verify CAPABILITY signals are persisted
- `test_hypothesis_state_recalculation()` - Verify scoring aggregation

### Validation Test

Run 10-iteration discovery on Arsenal FC:
- Expect: CAPABILITY signals captured (previously discarded)
- Expect: Hypothesis states calculated per category
- Expect: At least 1 category in WARM or higher state

---

## Implementation Schedule

| Day | Task | Files | Status |
|-----|------|-------|--------|
| 1 | Add enums to schemas.py | `schemas.py` | Pending |
| 2 | Implement classify_signal() | `ralph_loop.py` | Pending |
| 3 | Implement recalculate_hypothesis_state() | `ralph_loop.py` | Pending |
| 4 | Add persistence methods | `hypothesis_persistence_native.py` | Pending |
| 5 | Integrate into validate_signals() | `ralph_loop.py` | Pending |
| 6 | Add FastAPI routes | `scoring_routes.py`, `main.py` | Pending |
| 7 | Add Next.js API and component | `src/app/api/scoring/route.ts`, `ScoreCard.tsx` | Pending |

---

## Success Metrics

- **Signal Capture Rate**: 80%+ (all CAPABILITY signals stored)
- **Category Coverage**: At least 3 hypothesis states per entity after 10 iterations
- **State Distribution**: At least 1 category in WARM or higher after meaningful discovery
- **API Response Time**: < 500ms for /api/scoring/{entity_id}

---

## Post-MVP Roadmap

### Phase 2: Episode Clustering
- Semantic + temporal episode compression
- Embedding generation for clustering
- 45-day window + 0.78 similarity threshold

### Phase 3: Time-Weighted EIG
- Exponential decay: e^(-λ × age_in_days)
- λ = 0.015 (30-day-old signal ≈ 64% weight)

### Phase 4: Three-Axis Dashboard Scoring
- Procurement Maturity Score (0-100)
- Active Procurement Probability (6-month)
- Sales Readiness Level

---

## Design Decisions

### Decision 1: Hypothesis-Centric State
Signals update hypothesis state, not the other way around. This prevents signal-level state chaos and enables backtesting.

### Decision 2: Separate capability_signals Array
CAPABILITY signals returned separately from validated_signals to maintain backward compatibility.

### Decision 3: Explicit HypothesisState Node
Enables time-travel queries and backtesting. Derived functions don't allow snapshotting.

### Decision 4: Tier-Specific Thresholds
Different evidence/confidence requirements per tier prevent noise while capturing early signals.

---

## References

- Original Plan: `docs/plans/2026-02-19-temporal-sports-procurement-prediction-engine.md`
- Ralph Loop: `backend/ralph_loop.py`
- Hypothesis Manager: `backend/hypothesis_manager.py`
- Schema Definitions: `backend/schemas.py`
- Graphiti Service: `backend/graphiti_service.py`

---

**Design Status**: ✅ Approved
**Next Step**: Generate implementation plan using writing-plans skill
