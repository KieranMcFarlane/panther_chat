# Hypothesis-Driven Discovery: Data Storage Guide

**Where to find entity runtime data, ledgers, links, reasoning logs, and evidence**

---

## 📊 Data Storage Architecture Overview

The hypothesis-driven discovery system stores data in **multiple layers**:

1. **Primary Storage** - FalkorDB Graph Database (persistent)
2. **Cache Layer** - In-memory LRU cache (fast access)
3. **Log Files** - Execution logs and discovery reports (files)
4. **Runtime Bindings** - Template-entity mappings (files)

---

## 1. 🗄️ Primary Storage: FalkorDB (Graph Database)

### Location
- **Database**: FalkorDB (Neo4j-compatible)
- **Graph Name**: `sports_intelligence`
- **Connection**: Environment variables (`FALKORDB_URI`, `FALKORDB_USER`, `FALKORDB_PASSWORD`)

### Schema

#### Hypothesis Nodes
```cypher
(:Hypothesis {
  hypothesis_id: "digital_transformation_procurement",
  entity_id: "arsenal-fc",
  category: "Digital Infrastructure",
  statement: "Entity is exploring CRM systems",
  prior_probability: 0.5,

  // State tracking
  iterations_attempted: 5,
  iterations_accepted: 2,
  iterations_weak_accept: 1,
  iterations_rejected: 0,
  iterations_no_progress: 2,

  // Confidence tracking
  confidence: 0.75,
  reinforced_count: 2,
  weakened_count: 0,
  last_delta: +0.06,

  // Lifecycle
  status: "ACTIVE",  // ACTIVE, PROMOTED, DEGRADED, SATURATED, KILLED
  created_at: "2026-02-03T06:11:59Z",
  last_updated: "2026-02-03T06:12:30Z",
  promoted_at: null,
  degraded_at: null,
  saturated_at: null,
  killed_at: null,

  // EIG tracking
  expected_information_gain: 2.5,

  // Metadata (JSON string with discovered data)
  metadata: '{
    "discovered_urls": ["https://arsenal.com/careers", "https://arsenal.com/about"],
    "evidence_excerpts": ["Arsenal is hiring for CRM Manager..."],
    "reasoning_steps": [
      "Step 1: Checked official site - found careers page",
      "Step 2: Discovered CRM system job posting",
      "Step 3: Evaluated evidence - ACCEPT"
    ],
    "cost_breakdown": {
      "api_calls": 5,
      "total_cost_usd": 0.15,
      "claude_tokens": 2500
    },
    "hop_history": [
      {
        "hop_type": "official_site",
        "url": "https://arsenal.com",
        "decision": "ACCEPT",
        "confidence_delta": 0.06,
        "justification": "Found CRM job posting",
        "evidence_found": "Arsenal is hiring for CRM Manager position..."
      }
    ]
  }'
})
```

### How to Query Hypothesis Data

#### Get All Hypotheses for an Entity
```python
from backend.hypothesis_persistence_native import HypothesisRepository

repo = HypothesisRepository()
await repo.initialize()

hypotheses = await repo.get_hypotheses_for_entity("arsenal-fc")
for h in hypotheses:
    print(f"{h.hypothesis_id}: {h.confidence:.2f} - {h.status}")
    if h.metadata:
        print(f"  URLs: {h.metadata.get('discovered_urls', [])}")
        print(f"  Evidence: {h.metadata.get('evidence_excerpts', [])}")
```

#### Get Specific Hypothesis
```python
hypothesis = await repo.get_hypothesis(
    hypothesis_id="digital_transformation_procurement",
    entity_id="arsenal-fc"
)

print(f"Confidence: {hypothesis.confidence}")
print(f"Iterations: {hypothesis.iterations_attempted}")
print(f"Status: {hypothesis.status}")
print(f"Metadata: {hypothesis.metadata}")
```

#### Search Hypotheses by Status
```cypher
// Get all PROMOTED hypotheses
MATCH (h:Hypothesis {status: "PROMOTED"})
RETURN h.hypothesis_id, h.entity_id, h.confidence, h.promoted_at
ORDER BY h.confidence DESC

// Get all hypotheses for a category
MATCH (h:Hypothesis {category: "Digital Infrastructure"})
RETURN h.hypothesis_id, h.entity_id, h.status
ORDER BY h.confidence DESC
```

---

## 2. 💾 Cache Layer: In-Memory Storage

### Location
- **Implementation**: `backend/hypothesis_cache.py`
- **Type**: LRU cache with TTL
- **Default**: 100MB max size, 60-minute TTL
- **Purpose**: Fast access (<100ms) without database queries

### What's Cached
- Recent hypotheses (accessed in last 60 minutes)
- Frequently accessed entities (top 10 by access count)

### Cache Statistics
```python
from backend.hypothesis_manager import HypothesisManager

manager = HypothesisManager(cache_enabled=True)
stats = manager.get_cache_statistics()

print(f"Hit Rate: {stats['hit_rate']:.2%}")
print(f"Items: {stats['item_count']}")
print(f"Size: {stats['size_mb']:.2f} MB")
print(f"Evictions: {stats['evictions']}")
```

### Clear Cache
```python
await manager.clear_cache()
```

---

## 3. 📝 Log Files: Execution Logs & Reports

### Discovery Execution Logs

#### Full Runtime Discovery Log
- **File**: `backend/full_runtime_discovery.log`
- **Size**: 2.67 MB
- **Content**: Complete execution trace of discovery runs

#### Batch Discovery Log
- **File**: `data/batch_discovery.log`
- **Size**: 6.7 MB
- **Content**: Batch entity discovery results

#### Discovery Progress Log
- **File**: `data/discovery_progress.log`
- **Size**: 2.5 MB
- **Content**: Real-time discovery progress tracking

### Discovery Reports (JSON)

#### Final Reports (Completed Discoveries)
- **Pattern**: `data/discovery_report_final_YYYYMMDD_HHMMSS.json`
- **Example**: `data/discovery_report_final_20260202_001509.json`
- **Size**: ~267 KB each
- **Content**: Final discovery results per entity

#### Intermediate Reports (In-Progress)
- **Pattern**: `data/discovery_report_intermediate_YYYYMMDD_HHMMSS.json`
- **Example**: `data/discovery_report_intermediate_20260201_233541.json`
- **Size**: ~30-325 KB each
- **Content**: Checkpoint results during discovery

### How to Read Discovery Reports

```python
import json
from pathlib import Path

# Read a discovery report
report_path = "data/discovery_report_final_20260202_001509.json"
with open(report_path) as f:
    report = json.load(f)

print(f"Entity: {report['entity_id']}")
print(f"Status: {report['status']}")
print(f"Hypotheses: {len(report.get('hypotheses', []))}")

for h in report.get('hypotheses', []):
    print(f"\n{h['hypothesis_id']}:")
    print(f"  Confidence: {h.get('confidence', 0):.2f}")
    print(f"  Status: {h.get('status', 'UNKNOWN')}")
    print(f"  Evidence: {h.get('evidence', [])[:3]}...")  # First 3 evidence items
```

---

## 4. 🔗 Links & Evidence: Where URLs Are Stored

### In Hypothesis Metadata Field

The `metadata` field in each Hypothesis node stores:

```json
{
  "discovered_urls": [
    "https://arsenal.com/careers",
    "https://arsenal.com/about",
    "https://linkedin.com/company/arsenal"
  ],
  "evidence_excerpts": [
    "Arsenal is hiring for CRM Manager position...",
    "Job description mentions Salesforce experience...",
    "Investing in digital transformation..."
  ],
  "hop_history": [
    {
      "hop_type": "official_site",
      "url": "https://arsenal.com/careers",
      "decision": "ACCEPT",
      "confidence_delta": 0.06,
      "justification": "Found CRM job posting",
      "evidence_found": "Arsenal is hiring for CRM Manager...",
      "cost_usd": 0.03,
      "timestamp": "2026-02-03T06:12:00Z"
    },
    {
      "hop_type": "linkedin",
      "url": "https://linkedin.com/company/arsenal",
      "decision": "WEAK_ACCEPT",
      "confidence_delta": 0.02,
      "justification": "Company has digital tools listed",
      "evidence_found": "Uses Salesforce, HubSpot...",
      "cost_usd": 0.02,
      "timestamp": "2026-02-03T06:12:05Z"
    }
  ]
}
```

### How to Extract All URLs

```cypher
// Query all discovered URLs from metadata
MATCH (h:Hypothesis)
WHERE h.metadata IS NOT NULL
RETURN
  h.entity_id,
  h.hypothesis_id,
  h.confidence,
  h.metadata.discovered_urls as urls,
  h.metadata.evidence_excerpts as evidence
```

---

## 5. 🧠 Reasoning Logs: AI Decision Trail

### Where Reasoning Is Stored

Reasoning is stored in the `hop_history` array within the `metadata` field:

```json
{
  "hop_history": [
    {
      "hop_type": "official_site",
      "url": "https://arsenal.com/careers",
      "decision": "ACCEPT",
      "confidence_delta": 0.06,
      "justification": "Clear procurement signal - CRM Manager job posting indicates active exploration",
      "evidence_found": "Arsenal FC is currently seeking a CRM Manager to lead their digital transformation initiatives. Requirements include Salesforce experience...",
      "reasoning": "Job posting (ID: 12345) explicitly mentions 'CRM implementation' and 'salesforce experience required', indicating active procurement cycle",
      "timestamp": "2026-02-03T06:12:00Z"
    }
  ],
  "reasoning_summary": "Total 5 hops across 3 categories. Official site provided strongest signal (2 ACCEPT decisions), LinkedIn provided supporting evidence (1 WEAK_ACCEPT). No contradictory evidence found."
}
```

### Reasoning Components

| Component | Location | Description |
|-----------|----------|-------------|
| **Hop Type** | `hop_history[].hop_type` | Source of evidence (official_site, linkedin, job_boards, etc.) |
| **Decision** | `hop_history[].decision` | ACCEPT, WEAK_ACCEPT, REJECT, NO_PROGRESS |
| **Confidence Delta** | `hop_history[].confidence_delta` | How much this changed confidence (+0.06, +0.02, 0.0) |
| **Justification** | `hop_history[].justification` | Why this decision was made |
| **Evidence Found** | `hop_history[].evidence_found` | Actual text/content discovered |
| **Reasoning** | `hop_history[].reasoning` | Detailed AI reasoning process |
| **Timestamp** | `hop_history[].timestamp` | When this hop was executed |

### How to Get Reasoning Logs

```python
from backend.hypothesis_persistence_native import HypothesisRepository

repo = HypothesisRepository()
await repo.initialize()

# Get hypothesis with metadata
hypothesis = await repo.get_hypothesis(
    "digital_transformation_procurement",
    "arsenal-fc"
)

if hypothesis and hypothesis.metadata:
    hop_history = hypothesis.metadata.get('hop_history', [])

    print(f"Total Hops: {len(hop_history)}")
    for i, hop in enumerate(hop_history, 1):
        print(f"\nHop {i}: {hop['hop_type']}")
        print(f"  URL: {hop['url']}")
        print(f"  Decision: {hop['decision']}")
        print(f"  Delta: +{hop['confidence_delta']:.2f}")
        print(f"  Reasoning: {hop['reasoning']}")
        print(f"  Evidence: {hop['evidence_found'][:100]}...")
```

---

## 6. 📊 Runtime Bindings: Template-Entity Mappings

### Location
- **Directory**: `backend/data/runtime_bindings/`
- **File**: `backend/template_runtime_binding.py`
- **Purpose**: Maps hypotheses to entities based on templates

### Runtime Binding Structure

```python
# Template → Entities mapping
runtime_bindings = {
    "tier_1_club_centralized_procurement": {
        "hypotheses": [
            "digital_transformation_procurement",
            "crm_system_procurement",
            "ecommerce_platform_procurement"
        ],
        "entities": [
            "arsenal-fc", "chelsea-fc", "liverpool-fc",
            "manchester-united-fc", "manchester-city-fc"
        ],
        "confidence_threshold": 0.70,
        "max_iterations": 30
    }
}
```

### How to Access Runtime Bindings

```python
from backend.template_runtime_binding import RuntimeBindingLoader

loader = RuntimeBindingLoader()
bindings = loader.load_bindings()

for template_id, binding in bindings.items():
    print(f"Template: {template_id}")
    print(f"  Entities: {len(binding['entities'])}")
    print(f"  Hypotheses: {binding['hypotheses']}")
```

---

## 7. 📈 Monitoring & Metrics Data

### Rollout Metrics

#### Metrics Log Files
- **File**: `data/rollout_metrics.jsonl` (JSON Lines format)
- **Content**: One JSON object per entity processed

**Example entry**:
```json
{
  "timestamp": "2026-02-03T04:10:00.000Z",
  "entity_id": "arsenal-fc",
  "total_cost_usd": 0.15,
  "iterations": 5,
  "actionable": true,
  "final_confidence": 0.85,
  "duration_seconds": 0.1,
  "old_cost_usd": 0.25,
  "old_actionable": false,
  "error": null
}
```

#### Monitoring Reports
- **File**: `data/rollout_report.md` (auto-generated)
- **Content**: Aggregate metrics summary

#### Dashboard Snapshots
- **File**: `data/dashboard_snapshot.json` (on demand)
- **Content**: Point-in-time metrics snapshot

### How to Query Metrics

```python
import json
from pathlib import Path

# Read metrics log
metrics = []
with open('data/rollout_metrics.jsonl') as f:
    for line in f:
        metrics.append(json.loads(line))

# Calculate aggregates
total_cost = sum(m['total_cost_usd'] for m in metrics)
actionable_count = sum(1 for m in metrics if m['actionable'])
print(f"Total Cost: ${total_cost:.2f}")
print(f"Actionable: {actionable_count}/{len(metrics)} ({actionable_count/len(metrics)*100:.1f}%)")
```

---

## 8. 🗂️ Entity Data Files

### Entity Registries

#### All Entities (Flat)
- **File**: `data/all_entities_flat.json`
- **Size**: 1.0 MB
- **Content**: Complete entity list with properties

#### All Entities (Nested)
- **File**: `data/all_entities.json`
- **Size**: 1.0 MB
- **Content**: Hierarchical entity structure

#### Converted Entities
- **File**: `data/converted_entities.json`
- **Size**: 1.2 MB
- **Content**: Legacy entity data format

### How to Query Entity Data

```python
import json

# Load entity data
with open('data/all_entities_flat.json') as f:
    entities = json.load(f)

# Find specific entity
for entity in entities:
    if entity['entity_id'] == 'arsenal-fc':
        print(f"Name: {entity['name']}")
        print(f"Type: {entity['type']}")
        print(f"Properties: {entity.keys()}")
        break
```

---

## 9. 🔍 Discovery Checkpoints

### Checkpoint File
- **File**: `data/discovery_checkpoint.json`
- **Size**: 909 bytes
- **Content**: Resume point for interrupted discovery runs

### Rollout Checkpoints
- **File**: `data/rollout_checkpoint.json` (created during staged rollout)
- **Purpose**: Save/restore rollout state

---

## 📋 Quick Reference: Data Location Summary

| Data Type | Location | Format | Access Method |
|-----------|----------|--------|----------------|
| **Hypotheses** | FalkorDB Graph | Graph nodes | `HypothesisRepository.get_hypothesis()` |
| **Metadata** | FalkorDB Graph | JSON in `metadata` field | `hypothesis.metadata` |
| **Discovered URLs** | FalkorDB Graph | JSON array in `metadata` | `h.metadata['discovered_urls']` |
| **Evidence** | FalkorDB Graph | JSON array in `metadata` | `hypothesis.metadata['evidence_excerpts']` |
| **Reasoning** | FalkorDB Graph | JSON array in `metadata` | `hypothesis.metadata['hop_history']` |
| **Cache** | In-memory | LRU cache | `HypothesisManager.get_cache_statistics()` |
| **Execution Logs** | Files (data/) | Text logs | Read directly |
| **Discovery Reports** | Files (data/) | JSON | `json.load()` |
| **Metrics** | Files (data/) | JSON Lines | Read line-by-line |
| **Entities** | Files (data/) | JSON | `json.load()` |
| **Runtime Bindings** | Files (backend/data/) | Python | `RuntimeBindingLoader` |

---

## 🔧 Query Examples

### Get All Data for an Entity

```python
from backend.hypothesis_persistence_native import HypothesisRepository

repo = HypothesisRepository()
await repo.initialize()

# Get all hypotheses for entity
hypotheses = await repo.get_hypotheses_for_entity("arsenal-fc")

for h in hypotheses:
    print(f"\n{'='*60}")
    print(f"Hypothesis: {h.hypothesis_id}")
    print(f"Confidence: {h.confidence:.2f}")
    print(f"Status: {h.status}")
    print(f"Iterations: {h.iterations_attempted}")

    # Extract reasoning and evidence
    if h.metadata:
        print(f"\n📊 Discovered URLs:")
        for url in h.metadata.get('discovered_urls', []):
            print(f"  - {url}")

        print(f"\n🧠 Reasoning Steps:")
        for hop in h.metadata.get('hop_history', []):
            print(f"  Step: {hop['hop_type']}")
            print(f"  URL: {hop['url']}")
            print(f"  Decision: {hop['decision']} (+{hop['confidence_delta']:.2f})")
            print(f"  Reasoning: {hop['reasoning']}")
            print(f"  Evidence: {hop['evidence_found'][:80]}...")
```

### Export Entity Ledger to File

```python
import json
from datetime import datetime
from backend.hypothesis_persistence_native import HypothesisRepository

async def export_entity_ledger(entity_id: str, output_file: str):
    """Export complete discovery ledger for an entity"""
    repo = HypothesisRepository()
    await repo.initialize()

    hypotheses = await repo.get_hypotheses_for_entity(entity_id)

    ledger = {
        'entity_id': entity_id,
        'export_timestamp': datetime.now().isoformat(),
        'hypotheses': []
    }

    for h in hypotheses:
        hypothesis_data = {
            'hypothesis_id': h.hypothesis_id,
            'category': h.category,
            'statement': h.statement,
            'confidence': h.confidence,
            'status': h.status,
            'iterations_attempted': h.iterations_attempted,
            'created_at': h.created_at.isoformat(),
            'last_updated': h.last_updated.isoformat(),
            'metadata': h.metadata
        }
        ledger['hypotheses'].append(hypothesis_data)

    with open(output_file, 'w') as f:
        json.dump(ledger, f, indent=2)

    print(f"✅ Ledger exported to {output_file}")

# Usage
await export_entity_ledger('arsenal-fc', 'data/arsenal_ledger.json')
```

---

## 🎯 Summary: Where to Find What

| Want to Find? | Look Here |
|---------------|-----------|
| **Hypothesis objects** | FalkorDB - `Hypothesis` nodes |
| **Confidence scores** | `h.confidence` field |
| **Decision history** | `h.metadata['hop_history']` array |
| **Discovered URLs** | `h.metadata['discovered_urls']` array |
| **Evidence excerpts** | `h.metadata['evidence_excerpts']` array |
| **AI reasoning** | `h.metadata['hop_history'][i]['reasoning']` |
| **Cost breakdown** | `h.metadata['cost_breakdown']` dict |
| **Lifecycle status** | `h.status` (ACTIVE, PROMOTED, etc.) |
| **Timestamps** | `h.created_at`, `h.last_updated`, `h.promoted_at`, etc. |
| **Execution logs** | `data/discovery_*.log` files |
| **Final reports** | `data/discovery_report_final_*.json` files |
| **Metrics** | `data/rollout_metrics.jsonl` |

---

## 🚀 Quick Start: Access Your Data

### 1. Query FalkorDB Directly

```python
from backend.hypothesis_persistence_native import HypothesisRepository

repo = HypothesisRepository()
await repo.initialize()

# Get hypothesis with all metadata
h = await repo.get_hypothesis(
    hypothesis_id="digital_transformation_procurement",
    entity_id="arsenal-fc"
)

print(f"Hypothesis: {h.hypothesis_id}")
print(f"Confidence: {h.confidence}")
print(f"Metadata: {json.dumps(h.metadata, indent=2)}")
```

### 2. Read Discovery Reports

```python
import json
from pathlib import Path

# List all reports
reports = sorted(Path('data').glob('discovery_report_final_*.json'))

# Read most recent
latest = reports[-1]
with open(latest) as f:
    report = json.load(f)

print(f"Entity: {report['entity_id']}")
print(f"Status: {report['status']}")
```

### 3. Monitor Real-Time Metrics

```bash
# Run monitoring dashboard
python3 scripts/monitor_rollout.py --refresh 5
```

---

**All your discovery data is stored in FalkorDB with comprehensive metadata, reasoning logs, and evidence tracking!** 🎯
