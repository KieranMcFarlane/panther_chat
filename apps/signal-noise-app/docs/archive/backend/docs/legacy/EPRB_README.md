# EPRB Architecture Implementation

## Overview

Complete implementation of the **EPRB (Exploratory → Promoted → Runtime Bindings)** Architecture for scalable RFP signal detection across 3,400+ sports entities.

## Architecture

```
EXPLORATION (Phase 1)          PROMOTION (Phase 2)           RUNTIME (Phase 3)           INFERENCE (Phase 4)
     ↓                                ↓                             ↓                              ↓
7 entities × 8 categories     Hard thresholds (5+,3+,<3)    Deterministic execution    7 → 3,393 transfer
Write-once logging            Ralph-governed               Bright Data SDK only        Confidence discount (-0.1)
```

## Phase 1: Exploration (backend/exploration/)

### Files Created
- `canonical_categories.py` - 8 canonical exploration categories
- `exploration_log.py` - Write-once immutable logging
- `evidence_store.py` - Append-only JSONL storage
- `exploration_coordinator.py` - 7-entity orchestration

### Key Classes
- `ExplorationCategory` - 8 canonical categories
- `ExplorationLogEntry` - Immutable log entry with hash chain
- `ExplorationReport` - Aggregated exploration results
- `EvidenceStore` - Append-only evidence storage
- `ExplorationCoordinator` - Orchestrates 7-entity exploration

### 8 Canonical Categories
1. `JOBS_BOARD_EFFECTIVENESS` - LinkedIn job posting signals
2. `OFFICIAL_SITE_RELIABILITY` - Press releases, news sections
3. `STRATEGIC_HIRE_INDICATORS` - CRM/Data/Digital roles
4. `PARTNERSHIP_SIGNALS` - Tech partner mentions
5. `OFFICIAL_DOMAIN_DISCOVERY` - Finding .com, .de, etc.
6. `SEMANTIC_FILTERING` - Filtering .gov, .edu for sports
7. `HISTORICAL_PATTERN_RECOGNITION` - Timeline analysis
8. `CLUSTER_PATTERN_REPLICATION` - Transfer learning

### Usage Example
```python
from backend.exploration.exploration_coordinator import ExplorationCoordinator
from backend.exploration.canonical_categories import ExplorationCategory

coordinator = ExplorationCoordinator()

report = await coordinator.run_exploration_cycle(
    cluster_id="top_tier_club_global",
    template_id="tpl_top_tier_club_v1",
    entity_sample=["arsenal", "chelsea", "liverpool", "man_city", "man_utd", "spurs", "west_ham"],
    categories=[ExplorationCategory.JOBS_BOARD_EFFECTIVENESS]
)

print(f"Observations: {report.total_observations}")
print(f"Repeatable patterns: {report.get_repeatable_patterns()}")
```

## Phase 2: Promotion (backend/promotion/)

### Files Created
- `acceptance_criteria.py` - Hard thresholds (5+, 3+, <3)
- `promotion_engine.py` - Ralph-governed promotion logic
- `template_updater.py` - Immutable version control
- `promotion_log.py` - Audit trail (append-only JSONL)

### Key Classes
- `AcceptanceCriteria` - Non-negotiable thresholds
- `PromotionEngine` - Ralph-governed promotion
- `PromotionDecision` - Decision with rationale
- `TemplateVersion` - Immutable version record
- `TemplateRegistry` - Append-only version registry
- `PromotionLog` - Complete audit trail

### Hard Thresholds
- **5+ observations** → `PROMOTE` (full promotion)
- **3+ observations** → `PROMOTE_WITH_GUARD` (conditional promotion)
- **<3 observations** → `KEEP_EXPLORING` (insufficient data)

### Usage Example
```python
from backend.promotion.promotion_engine import PromotionEngine
from backend.promotion.template_updater import create_template_version
from backend.promotion.promotion_log import log_promotion_decision

engine = PromotionEngine()

decision = await engine.evaluate_promotion(
    exploration_report=report,
    template=template_metadata
)

print(f"Action: {decision.action}")
print(f"Confidence: {decision.confidence:.2%}")
print(f"Rationale: {decision.rationale}")

# Create new template version if promoted
if decision.action == "PROMOTE":
    new_version = create_template_version(
        base_template_id="tpl_top_tier_club",
        template=updated_template,
        promoted_from=f"exploration_report_{report.template_id}",
        promotion_decision=decision.to_dict()
    )
    print(f"Created version: {new_version.version_id}")
```

## Phase 3: Runtime (backend/runtime/)

### Files Created
- `execution_engine.py` - Deterministic execution (Bright Data SDK only)
- `performance_tracker.py` - Confidence adjustment tracking
- `drift_detector.py` - Automatic retirement detection

### Key Classes
- `ExecutionEngine` - 100% deterministic execution
- `ExecutionResult` - Result with zero Claude/MCP calls
- `PerformanceTracker` - Usage tracking and confidence adjustment
- `PerformanceMetrics` - Binding performance metrics
- `DriftDetector` - Drift signal detection
- `DriftDetectionResult` - Drift analysis result

### Deterministic Guarantees
- **NO Claude calls** (no LLM involvement)
- **NO MCP tools** (use Bright Data SDK directly)
- All execution tracked with performance metrics
- Automatic drift detection and retirement

### Drift Signals
- Success rate < 50% (over last 10 executions)
- Confidence adjustment < -0.3
- No signals in 5+ consecutive executions
- Entity domain changed (404 errors)

### Usage Example
```python
from backend.runtime.execution_engine import ExecutionEngine
from backend.runtime.performance_tracker import PerformanceTracker
from backend.runtime.drift_detector import DriftDetector

# Execute binding deterministically
engine = ExecutionEngine()

result = await engine.execute_binding_deterministic(
    template_id="tpl_top_tier_club_v1",
    entity_id="arsenal",
    entity_name="Arsenal FC"
)

print(f"Success: {result.success}")
print(f"Signals found: {result.signals_found}")
print(f"Claude calls: {result.claude_calls}")  # Always 0
print(f"MCP calls: {result.mcp_calls}")  # Always 0
print(f"SDK calls: {result.sdk_calls}")

# Track performance
tracker = PerformanceTracker()
tracker.record_execution("arsenal", success=True, signals_found=3)

# Detect drift
detector = DriftDetector()
drift_result = detector.detect_drift("arsenal")

if drift_result.drift_detected:
    print(f"Drift detected: {drift_result.recommended_action.value}")
```

## Phase 4: Inference (backend/inference/)

### Files Created
- `pattern_replication.py` - Cross-entity pattern transfer
- `inference_validator.py` - Validate replicated patterns

### Key Classes
- `ReplicatedPattern` - Pattern from source to target
- `PatternReplicationEngine` - Extract and replicate patterns
- `ReplicationResult` - Result from pattern replication
- `InferenceValidator` - Validate replicated patterns
- `InferenceValidation` - Validation result

### Replication Process
1. Extract proven patterns from 7 explored entities
2. Calculate statistics (success rate, confidence)
3. Apply to target entities with confidence discount (-0.1)
4. Validate with sample execution (deterministic)
5. Promote binding if validation successful

### Usage Example
```python
from backend.inference.pattern_replication import PatternReplicationEngine
from backend.inference.inference_validator import InferenceValidator

# Extract and replicate patterns
replication_engine = PatternReplicationEngine()

patterns = replication_engine.extract_patterns_from_exploration(
    exploration_report
)

results = await replication_engine.replicate_to_entities(
    patterns=patterns,
    target_entities=["entity_1", "entity_2", ...],  # 3,393 entities
    cluster_id="top_tier_club_global",
    template_id="tpl_top_tier_club_v1"
)

# Validate replicated patterns
validator = InferenceValidator()

validation = await validator.validate_replicated_pattern(
    pattern=patterns[0],
    target_entity_id="entity_1",
    target_entity_name="Entity 1",
    template_id="tpl_top_tier_club_v1"
)

print(f"Validation status: {validation.validation_status}")
print(f"Signals found: {validation.signals_found}")
print(f"Rationale: {validation.rationale}")
```

## Integration (backend/eprb_integration.py)

### EPRBOrchestrator

Complete workflow orchestrator that ties all phases together:

```python
from backend.eprb_integration import EPRBOrchestrator

orchestrator = EPRBOrchestrator()

# Run full EPRB workflow
result = await orchestrator.run_full_workflow(
    cluster_id="top_tier_club_global",
    template_id="tpl_top_tier_club_v1",
    template=template_metadata,
    entity_sample=["arsenal", "chelsea", "liverpool", ...],  # 7 entities
    target_entities=[...]  # 3,393 remaining entities
)

print(f"Exploration observations: {result['phases']['exploration']['total_observations']}")
print(f"Promotion action: {result['phases']['promotion']['action']}")
print(f"Runtime signals: {result['phases']['runtime']['total_signals']}")
print(f"Inference entities: {result['phases']['inference']['target_entities']}")
```

## Data Flow

```
1. EXPLORATION (7 entities)
   ├─ ExplorationCoordinator.run_exploration_cycle()
   ├─ EvidenceStore.append() [write-once]
   └─ ExplorationReport [aggregated results]

2. PROMOTION (Ralph-governed)
   ├─ PromotionEngine.evaluate_promotion()
   ├─ AcceptanceCriteria.evaluate() [hard thresholds]
   ├─ TemplateRegistry.create_version() [immutable]
   └─ PromotionLog.append() [audit trail]

3. RUNTIME (deterministic)
   ├─ ExecutionEngine.execute_binding_deterministic()
   ├─ PerformanceTracker.record_execution()
   └─ DriftDetector.detect_drift()

4. INFERENCE (cross-entity)
   ├─ PatternReplicationEngine.extract_patterns()
   ├─ PatternReplicationEngine.replicate_to_entities()
   └─ InferenceValidator.validate_replicated_pattern()
```

## File Structure

```
backend/
├── exploration/
│   ├── __init__.py
│   ├── canonical_categories.py      # 8 exploration categories
│   ├── exploration_log.py           # Immutable logging
│   ├── evidence_store.py            # Append-only JSONL
│   └── exploration_coordinator.py   # 7-entity orchestration
│
├── promotion/
│   ├── __init__.py
│   ├── acceptance_criteria.py       # Hard thresholds
│   ├── promotion_engine.py          # Ralph-governed logic
│   ├── template_updater.py          # Immutable versioning
│   └── promotion_log.py             # Audit trail
│
├── runtime/
│   ├── __init__.py
│   ├── execution_engine.py          # Deterministic execution
│   ├── performance_tracker.py       # Confidence tracking
│   └── drift_detector.py            # Automatic retirement
│
├── inference/
│   ├── __init__.py
│   ├── pattern_replication.py       # Cross-entity transfer
│   └── inference_validator.py       # Validation logic
│
└── eprb_integration.py              # Complete workflow

data/
├── exploration/
│   └── evidence_logs.jsonl          # Append-only evidence
├── promotion/
│   └── promotion_log.jsonl          # Append-only audit
├── runtime_bindings/
│   └── bindings_cache.json          # Runtime bindings
└── bootstrapped_templates/
    └── registry.json                # Template version registry
```

## Testing

### Unit Tests
```python
# Test exploration logging
from backend.exploration.exploration_log import ExplorationLogEntry

entry = ExplorationLogEntry(
    cluster_id="test",
    template_id="test",
    entity_sample=["entity1"],
    category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS
)

assert entry.entry_hash  # Hash calculated automatically

# Test hard thresholds
from backend.promotion.acceptance_criteria import AcceptanceCriteria

criteria = AcceptanceCriteria()
decision = criteria.evaluate(
    total_observations=5,
    average_confidence=0.85,
    entities_with_pattern=4,
    entity_sample_size=7
)

assert decision == "PROMOTE"

# Test deterministic execution
from backend.runtime.execution_engine import ExecutionEngine

engine = ExecutionEngine()
result = await engine.execute_binding_deterministic(
    template_id="test",
    entity_id="test",
    entity_name="Test Entity"
)

assert result.claude_calls == 0  # No Claude calls
assert result.mcp_calls == 0     # No MCP calls
```

## Success Criteria

✅ Phase 1: Exploration infrastructure complete (8 canonical categories, write-once logging)
✅ Phase 2: Promotion engine complete (hard thresholds, immutable versioning)
✅ Phase 3: Runtime execution complete (deterministic, drift detection)
✅ Phase 4: Inference system complete (pattern replication, validation)
✅ Integration: EPRBOrchestrator ties all phases together

## Next Steps

1. Implement actual exploration logic per category (currently placeholder)
2. Add deterministic binding creation with Bright Data SDK
3. Integrate with existing template_loader.py and template_enrichment_agent.py
4. Add CopilotKit API routes for EPRB workflow
5. Test full workflow with real entities
6. Scale to 3,400+ entities

## Key Principles

- **Templates NEVER learn** (immutable, version-controlled)
- **Bindings learn locally** (entity-specific optimization)
- **Clusters learn statistically** (cross-entity wisdom)
- **All learning is auditable** (write-once immutable evidence)
- **Runtime is deterministic** (NO Claude, NO MCP, SDK only)
