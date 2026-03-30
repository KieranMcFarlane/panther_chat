# Hypothesis-Driven Discovery System - Quick Start Guide

## Overview

The Hypothesis-Driven Discovery System is a production-ready implementation of optimal discovery with:

- **Explicit Hypothesis Objects**: First-class hypotheses with full lifecycle tracking
- **EIG-Based Prioritization**: Expected Information Gain for intelligent exploration
- **Deterministic Single-Hop Execution**: Predictable cost, auditable reasoning
- **FalkorDB Persistence**: Full graph database persistence for all state
- **Depth-Aware Stopping**: Enforced 2-3 level depth limits

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HypothesisManager                        │
│  • Initialize hypotheses from templates                     │
│  • Update hypothesis state after iterations                 │
│  • Manage lifecycle transitions                             │
│  • Persist to FalkorDB                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      EIGCalculator                           │
│  • Calculate Expected Information Gain                      │
│  • Apply cluster dampening                                  │
│  • Rank hypotheses by priority                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            HypothesisDrivenDiscovery                         │
│  • Run single-hop iterations                                │
│  • Select top hypothesis by EIG                             │
│  • Execute hop (scrape + evaluate)                          │
│  • Track depth and cost                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              HypothesisRepository (FalkorDB)                 │
│  • Persist hypotheses                                       │
│  • Track cluster pattern frequencies                        │
│  • Query active hypotheses                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation

### 1. Install Dependencies

```bash
pip install neo4j falkordb python-dotenv
```

### 2. Configure Environment Variables

Add to `.env`:

```bash
# FalkorDB Connection
FALKORDB_URI=bolt://localhost:7687
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password
FALKORDB_DATABASE=sports_intelligence
```

### 3. Initialize Database Schema

```bash
python backend/test_hypothesis_driven_discovery.py
```

This will create the necessary constraints and indexes automatically.

---

## Usage Examples

### Example 1: Initialize Hypotheses from Template

```python
from backend.hypothesis_manager import HypothesisManager
from backend.hypothesis_persistence import HypothesisRepository

# Initialize repository
repo = HypothesisRepository()
await repo.initialize()

# Create manager with repository
manager = HypothesisManager(repository=repo)

# Initialize hypotheses from template
hypotheses = await manager.initialize_hypotheses(
    template_id="tier_1_club_centralized_procurement",
    entity_id="arsenal-fc",
    entity_name="Arsenal FC"
)

print(f"Initialized {len(hypotheses)} hypotheses")
for h in hypotheses:
    print(f"  - {h.hypothesis_id}: {h.statement}")
    print(f"    Confidence: {h.confidence:.2f}, Status: {h.status}")

# Close repository
await repo.close()
```

### Example 2: Calculate EIG with Cluster Dampening

```python
from backend.hypothesis_manager import Hypothesis
from backend.eig_calculator import EIGCalculator, ClusterState

# Create hypothesis
h = Hypothesis(
    hypothesis_id="arsenal_crm_procurement",
    entity_id="arsenal-fc",
    category="CRM Implementation",
    statement="Arsenal FC is preparing CRM procurement",
    prior_probability=0.5,
    confidence=0.42
)

# Calculate EIG without cluster dampening
calculator = EIGCalculator()
eig = calculator.calculate_eig(h)
print(f"EIG (no dampening): {eig:.3f}")

# Calculate EIG with cluster dampening
cluster_state = ClusterState(
    cluster_id="tier_1_clubs",
    pattern_frequencies={"Strategic Hire": 5, "CRM Implementation": 2}
)

eig_with_dampening = calculator.calculate_eig(h, cluster_state)
print(f"EIG (with dampening): {eig_with_dampening:.3f}")
```

### Example 3: Run Full Discovery

```python
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient

# Initialize clients
claude = ClaudeClient()
brightdata = BrightDataSDKClient()

# Create discovery engine
discovery = HypothesisDrivenDiscovery(
    claude_client=claude,
    brightdata_client=brightdata
)

# Run discovery
result = await discovery.run_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    template_id="tier_1_club_centralized_procurement",
    max_iterations=30,
    max_depth=3
)

# Check results
print(f"Final Confidence: {result.final_confidence:.2f}")
print(f"Confidence Band: {result.confidence_band}")
print(f"Is Actionable: {result.is_actionable}")
print(f"Iterations: {result.iterations_completed}")
print(f"Cost: ${result.total_cost_usd:.4f}")
print(f"Depth Stats: {result.depth_stats}")
```

### Example 4: Query Active Hypotheses

```python
from backend.hypothesis_persistence import HypothesisRepository

# Initialize repository
repo = HypothesisRepository()
await repo.initialize()

# Get active hypotheses for entity
hypotheses = await repo.get_active_hypotheses(
    entity_id="arsenal-fc",
    status="ACTIVE"
)

print(f"Found {len(hypotheses)} active hypotheses")
for h in hypotheses:
    print(f"  - {h.hypothesis_id}:")
    print(f"    EIG: {h.expected_information_gain:.3f}")
    print(f"    Confidence: {h.confidence:.2f}")

# Close repository
await repo.close()
```

### Example 5: Update Cluster Pattern Frequencies

```python
from backend.hypothesis_persistence import HypothesisRepository

# Initialize repository
repo = HypothesisRepository()
await repo.initialize()

# Update cluster pattern frequency
await repo.update_cluster_pattern_frequency(
    cluster_id="tier_1_clubs",
    pattern_name="Strategic Hire",
    frequency=1  # or omit to increment
)

# Get all pattern frequencies for cluster
frequencies = await repo.get_cluster_pattern_frequencies("tier_1_clubs")
print(f"Cluster frequencies: {frequencies}")

# Close repository
await repo.close()
```

---

## Hypothesis Lifecycle States

| State | Description | Transition Criteria |
|-------|-------------|---------------------|
| **ACTIVE** | Normal investigation | Default initial state |
| **PROMOTED** | Strong evidence | confidence ≥0.70 AND ≥2 ACCEPTs |
| **DEGRADED** | Contradicted | confidence <0.30 AND ≥2 REJECTs |
| **SATURATED** | No new information | ≥3 NO_PROGRESS in last 5 iterations |
| **KILLED** | Explicitly falsified | ≥2 REJECTs + contradictory evidence |

---

## Depth Levels

| Level | Name | Hop Types |
|-------|------|-----------|
| **1** | SURFACE | Official sites, homepages, overview pages |
| **2** | OPERATIONAL | Job postings, tender portals, specific pages |
| **3** | AUTHORITY | Job descriptions, strategy docs, finance pages |

---

## EIG Formula

```
EIG(h) = (1 - confidence_h) × novelty_h × information_value_h
```

Where:
- **confidence_h**: Current hypothesis confidence (0.0-1.0)
- **novelty_h**: Pattern novelty score (0.0-1.0, from cluster dampening)
- **information_value_h**: Category value multiplier (e.g., C-suite = 1.5, general = 1.0)

---

## FalkorDB Schema

### Nodes
- `(:Hypothesis)` - First-class hypothesis objects
- `(:Entity)` - Sports entities (clubs, leagues, etc.)
- `(:Cluster)` - Entity clusters for dampening
- `(:Pattern)` - Pattern names for frequency tracking

### Relationships
- `(:Entity)-[:HAS_HYPOTHESIS]->(:Hypothesis)`
- `(:Hypothesis)-[:IN_CATEGORY]->(:Category)`
- `(:Cluster)-[:HAS_PATTERN]->(:Pattern)`

### Constraints
- `Hypothesis.hypothesis_id` UNIQUE
- `Entity.id` UNIQUE
- `Cluster.cluster_id` UNIQUE
- `Pattern.name` UNIQUE

### Indexes
- `Hypothesis(entity_id)`
- `Hypothesis(status)`
- `Hypothesis(expected_information_gain)`
- `Hypothesis(created_at)`

---

## Testing

Run the integration test:

```bash
python backend/test_hypothesis_driven_discovery.py
```

This will test:
1. Hypothesis manager with persistence
2. EIG calculator with cluster dampening
3. Full discovery flow

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Cost Per Entity | $0.03-$0.10 | vs current $0.05-$0.15 |
| Average Depth | 2-3 levels | Enforced by stopping rules |
| Time Per Entity | <3 minutes | vs current 5-10 minutes |
| Cache Hit Rate | >60% | For promoted bindings |
| Cluster Savings | >15% | From pattern dampening |

---

## Troubleshooting

### Issue: "neo4j not installed"

**Solution:**
```bash
pip install neo4j
```

### Issue: "Failed to connect to FalkorDB"

**Solution:** Check environment variables in `.env`:
```bash
FALKORDB_URI=bolt://localhost:7687
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password
```

### Issue: "Template not found"

**Solution:** Ensure template exists in `data/production_templates_dict.json`:
```bash
python backend/template_loader.py --list-templates
```

---

## Next Steps

1. **Run Integration Tests**: Verify FalkorDB persistence works
2. **Test with Real Entities**: Run discovery on 10 entities (Arsenal, KNVB, etc.)
3. **Monitor Performance**: Track cost, quality, and speed metrics
4. **Tune EIG Multipliers**: Adjust category value multipliers based on results
5. **Scale to Production**: Roll out to all 3,400+ entities

---

## Reference Implementation

See the following files for complete implementation:

- `backend/hypothesis_manager.py` - Hypothesis lifecycle management
- `backend/eig_calculator.py` - EIG calculation with cluster dampening
- `backend/hypothesis_driven_discovery.py` - Deterministic single-hop discovery
- `backend/hypothesis_persistence.py` - FalkorDB persistence layer
- `backend/test_hypothesis_driven_discovery.py` - Integration tests

---

## Support

For questions or issues, check:
1. Integration test output: `python backend/test_hypothesis_driven_discovery.py`
2. FalkorDB connection: `python backend/test_falkordb_native.py`
3. Template loading: `python backend/template_loader.py`

---

**Status**: ✅ Implementation Complete (Phases 1-3)

**Last Updated**: 2026-02-02
