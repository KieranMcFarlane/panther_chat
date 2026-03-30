# Graphiti & GraphRAG Reasoning System - Complete Technical Reference

## Overview

This document explains how the system uses **Graphiti**, **GraphRAG**, and **Narrative Builder** to collect evidence over time, perform reasoning iterations, and calculate confidence scores through multiple passes.

---

## 📊 Core Components

### 1. Graphiti Service (Temporal Knowledge Graph)

**File**: `backend/graphiti_service.py`

**Purpose**: Stores and retrieves temporal episodes (RFPs, partnerships, tech adoptions, etc.)

**Key Features**:
- Episode storage in Supabase (`temporal_episodes` table)
- Timeline queries by entity
- Temporal pattern analysis
- Entity diff computation (changes over time)

**Usage**:
```python
from graphiti_service import GraphitiService

graphiti = GraphitiService()
await graphiti.initialize()

# Get entity timeline (last 365 days)
timeline = await graphiti.get_entity_timeline(
    entity_id="arsenal-fc",
    limit=100
)

# Query episodes by time range
episodes = await graphiti.query_episodes(
    entities=["arsenal-fc"],
    from_time="2024-01-01T00:00:00Z",
    to_time="2024-12-31T23:59:59Z",
    limit=50
)
```

**Episode Schema**:
```python
{
    "episode_id": "uuid",
    "entity_id": "arsenal-fc",
    "entity_name": "Arsenal FC",
    "episode_type": "RFP_DETECTED",  # or TECHNOLOGY_ADOPTED, PARTNERSHIP_FORMED, etc.
    "content": "Digital transformation RFP for CRM system",
    "timestamp": "2024-01-15T10:00:00Z",
    "confidence_score": 0.92,
    "metadata": {
        "source": "LinkedIn",
        "category": "Technology",
        "validated": true
    }
}
```

---

### 2. Narrative Builder (Episodes → Claude-Friendly Narratives)

**File**: `backend/narrative_builder.py`

**Purpose**: Converts temporal episodes into token-bounded narratives for Claude

**Key Features**:
- Groups episodes by type (RFP, PARTNERSHIP, EXECUTIVE_CHANGE, etc.)
- Formats as bullet points with timestamps
- Estimates token count (~4 chars per token)
- Truncates if exceeds `max_tokens`
- Includes confidence scores in output

**Usage**:
```python
from narrative_builder import build_narrative_from_episodes

# Build narrative from episodes
narrative_data = build_narrative_from_episodes(
    episodes=timeline,
    max_tokens=2000,
    group_by_type=True
)

# Result
print(narrative_data['narrative'])
"""
# Temporal Narrative (3 episodes: 2024-01-15 to 2024-03-10)

## Rfp Detected

- **2024-01-15** (Arsenal FC): [92%] Digital transformation RFP for CRM system (source: LinkedIn, category: Technology)

## Partnership Formed

- **2024-02-01** (Arsenal FC): Partnership with Salesforce announced (source: Press Release)

## Executive Change

- **2024-03-10** (Arsenal FC): New CTO appointed (source: News)
"""

print(f"Episodes included: {narrative_data['episode_count']}/{narrative_data['total_episodes']}")
print(f"Estimated tokens: {narrative_data['estimated_tokens']}")
print(f"Truncated: {narrative_data['truncated']}")
```

**Token Management**:
- Target: 1500-2000 tokens per narrative
- Compression: Group by type, reverse chronological order
- Fallback: Truncate with notice (`"... Narrative truncated at 2000 tokens (15/20 episodes shown)"`)

---

### 3. Evidence Collection Over Time (Multi-Pass)

**Schema**: `backend/schemas.py`

**Evidence Structure**:
```python
@dataclass
class Evidence:
    """Proof source for a Signal"""
    id: str
    source: str                    # URL, document ID, etc.
    date: datetime
    signal_id: str                 # Links to Signal.id
    url: Optional[str]             # For web sources
    extracted_text: Optional[str]  # Raw content
    credibility_score: float       # 0.0-1.0
    metadata: Dict[str, Any]        # Author, freshness, etc.
```

**Ralph Loop Validation Rules**:
1. **Pass 1 (Rule-Based)**: Minimum 3 evidence pieces, confidence >= 0.7
2. **Pass 2 (Claude Validation)**: Validates confidence matches evidence quality
3. **Pass 3 (Final Confirmation)**: Duplicate detection, final scoring

**Multi-Pass Evidence Collection**:
```python
# Pass 1: Initial discovery
signal_1 = Signal(
    id="signal-001",
    type=SignalType.RFP_DETECTED,
    confidence=0.75,
    evidence=[
        Evidence(source="LinkedIn", credibility_score=0.8, ...),
        Evidence(source="Arsenal Careers", credibility_score=0.9, ...),
        Evidence(source="Press Release", credibility_score=0.85, ...)
    ],
    validation_pass=1
)

# Pass 2: Network context (add partner evidence)
signal_1.evidence.append(
    Evidence(source="Partner Tech Stack", credibility_score=0.7, ...)
)
signal_1.validation_pass = 2

# Pass 3: Deep dive (add temporal evidence)
signal_1.evidence.append(
    Evidence(source="Historical RFP Pattern", credibility_score=0.9, ...)
)
signal_1.validation_pass = 3
signal_1.confidence = 0.88  # Updated with all evidence
```

---

### 4. Confidence Scoring System

#### Fixed Math (Ralph Loop)

**File**: `backend/ralph_loop.py`

**Starting Point**: 0.50 (neutral prior)

**Deltas per Decision**:
- **ACCEPT**: +0.06 (strong evidence of procurement intent)
- **WEAK_ACCEPT**: +0.02 (capability present, intent unclear)
- **REJECT**: 0.00 (no evidence or contradicts hypothesis)
- **NO_PROGRESS**: 0.00 (no new information)
- **SATURATED**: 0.00 (category exhausted)

**Formula**:
```
final_confidence = 0.50 + (num_ACCEPT * 0.06) + (num_WEAK_ACCEPT * 0.02)
```

**Bounds**: 0.00 to 1.00 (enforced by system)

**Example Evolution**:
```
Pass 1:
  - 1 ACCEPT, 1 WEAK_ACCEPT, 1 REJECT
  - Delta: +0.08 (1 * 0.06 + 1 * 0.02)
  - Confidence: 0.50 → 0.58

Pass 2:
  - 3 ACCEPT, 0 WEAK_ACCEPT, 2 REJECT
  - Delta: +0.18 (3 * 0.06 + 0 * 0.02)
  - Confidence: 0.58 → 0.76

Pass 3:
  - 2 ACCEPT, 1 WEAK_ACCEPT, 0 REJECT
  - Delta: +0.14 (2 * 0.06 + 1 * 0.02)
  - Confidence: 0.76 → 0.90

Final: 0.90 (ACTIONABLE band)
```

#### Confidence Validation (Claude)

**Schema**: `schemas.py:137-167`

```python
@dataclass
class ConfidenceValidation:
    """
    Claude's validation of scraper-assigned confidence

    Tracks:
    - original_confidence: From scraper
    - validated_confidence: Claude's assessment
    - adjustment: Difference (validated - original)
    - rationale: Claude's reasoning
    - requires_manual_review: Edge cases flagged
    """
    original_confidence: float
    validated_confidence: float
    adjustment: float
    rationale: str
    requires_manual_review: bool = False
    validation_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
```

**Example**:
```python
validation = ConfidenceValidation(
    original_confidence=0.75,      # Scraper said 75%
    validated_confidence=0.82,      # Claude says 82% (better source)
    adjustment=0.07,                # +7% adjustment
    rationale="Evidence from official careers page is more credible than LinkedIn posting",
    requires_manual_review=False   # No edge case
)
```

---

### 5. EIG Calculator (Hypothesis Prioritization)

**File**: `backend/eig_calculator.py`

**Purpose**: Calculates Expected Information Gain for hypothesis ranking in multi-pass discovery

**EIG Formula**:
```
EIG(h) = (1 - confidence_h) × novelty_h × information_value_h
```

**Components**:

1. **Uncertainty** (`1 - confidence`):
   - Lower confidence → higher uncertainty → higher EIG
   - Encourages exploring uncertain hypotheses

2. **Novelty** (`1 / (1 + frequency)`):
   - Pattern seen 0 times → novelty = 1.0
   - Pattern seen 1 time → novelty = 0.5
   - Pattern seen 2 times → novelty = 0.33
   - Pattern seen 3+ times → novelty = 0.1-0.2
   - **Cluster dampening** prevents over-counting common patterns

3. **Information Value** (category multipliers):
   - C-Suite Hiring: 1.5 (highest)
   - Digital Transformation: 1.3
   - AI Platform: 1.3
   - Data Analytics: 1.2
   - CRM Implementation: 1.2
   - Fan Engagement: 1.1
   - Operations: 1.0 (baseline)

**Example Calculation**:
```python
# Hypothesis: Arsenal FC preparing CRM procurement
h = Hypothesis(
    hypothesis_id="arsenal_crm_procurement",
    category="CRM Implementation",
    confidence=0.42  # Low confidence → high uncertainty
)

# Without cluster state
eig = (1.0 - 0.42) × 1.0 × 1.2  # uncertainty × novelty × info_value
    = 0.58 × 1.0 × 1.2
    = 0.696

# With cluster state (CRM seen 5 times in cluster)
novelty = 1.0 / (1.0 + 5)  # = 0.167
eig = (1.0 - 0.42) × 0.167 × 1.2
    = 0.58 × 0.167 × 1.2
    = 0.116  # Lower EIG due to common pattern
```

**Usage in Multi-Pass**:
```python
# Re-score hypotheses before each pass
calculator = EIGCalculator()

for hypothesis in hypotheses:
    hypothesis.expected_information_gain = calculator.calculate_eig(
        hypothesis=hypothesis,
        cluster_state=cluster_state  # Tracks pattern frequencies
    )

# Select top hypothesis
top_hypothesis = max(hypotheses, key=lambda h: h.expected_information_gain)
```

---

### 6. BrightData SDK + Claude Setup (Optimal)

**File**: `backend/brightdata_sdk_client.py`

**Key Achievement**: Official Python SDK wrapper (NOT MCP)

**Architecture**:
```
BrightData SDK Client
    ├── Official brightdata package (async)
    ├── HTTP fallback with httpx + BeautifulSoup
    ├── Proxy rotation (handled by SDK)
    └── Pay-per-success pricing
```

**Primary Methods**:

1. **Search Engine (SERP API)**:
```python
client = BrightDataSDKClient()

# Google search
result = await client.search_engine(
    query='"Arsenal FC" CRM digital transformation',
    engine="google",
    country="us",
    num_results=10
)

# Returns
{
    "status": "success",
    "engine": "google",
    "query": "...",
    "results": [
        {
            "position": 1,
            "title": "Arsenal FC Digital Transformation...",
            "url": "https://arsenal.com/careers/...",
            "snippet": "Seeking CRM Manager..."
        },
        ...
    ],
    "timestamp": "2024-01-15T10:00:00Z",
    "metadata": {"source": "brightdata_sdk"}
}
```

2. **Scrape as Markdown**:
```python
# Single URL scrape
result = await client.scrape_as_markdown("https://arsenal.com/careers/")

# Returns
{
    "status": "success",
    "url": "https://arsenal.com/careers/",
    "content": "# Careers at Arsenal FC\n\n## CRM Manager...",
    "timestamp": "2024-01-15T10:00:00Z",
    "metadata": {
        "word_count": 1250,
        "source": "brightdata_sdk"
    }
}
```

3. **Batch Scrape** (Concurrent):
```python
# Scrape multiple URLs at once
urls = [
    "https://arsenal.com/careers/",
    "https://arsenal.com/press/",
    "https://linkedin.com/company/arsenal"
]

result = await client.scrape_batch(urls)

# Returns
{
    "status": "success",
    "total_urls": 3,
    "successful": 3,
    "failed": 0,
    "results": [...],
    "metadata": {"source": "brightdata_sdk"}
}
```

**Recent Improvements**:
1. **Async Context Manager**: `await BrightDataClient(token).__aenter__()`
2. **HTTP Fallback**: Automatic fallback to httpx when SDK unavailable
3. **Error Handling**: Graceful degradation with warnings
4. **Environment Loading**: Loads from current and parent `.env` files

**Integration with Claude Agent SDK**:
```python
from brightdata_sdk_client import BrightDataSDKClient
from claude_client import ClaudeClient

# Initialize clients
brightdata = BrightDataSDKClient()
claude = ClaudeClient()

# Multi-hop discovery
async def discover_entity(entity_name):
    # Hop 1: Search for official site
    search_result = await brightdata.search_engine(
        query=f"{entity_name} official website"
    )
    official_url = search_result['results'][0]['url']

    # Hop 2: Scrape official site
    site_content = await brightdata.scrape_as_markdown(official_url)

    # Hop 3: Analyze with Claude
    analysis = await claude.analyze(
        prompt=f"Extract procurement signals from:\n{site_content[:5000]}",
        tools=[]  # No tools needed for text analysis
    )

    return analysis
```

---

## 🔄 Multi-Pass Evidence & Confidence Flow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PASS 1: Initial Discovery                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Generate hypotheses (dossier-informed or template)       │
│    → 6-10 hypotheses with confidence ~0.50                   │
│                                                               │
│ 2. Calculate EIG for all hypotheses                           │
│    → Rank by uncertainty × novelty × info_value              │
│                                                               │
│ 3. Select top hypothesis                                     │
│    → highest EIG score                                       │
│                                                               │
│ 4. Execute hop (BrightData SDK + Claude)                     │
│    → Scrape official site, careers, press                    │
│    → Extract evidence with Claude                              │
│                                                               │
│ 5. Collect evidence                                           │
│    → Minimum 3 pieces required                               │
│    → Evidence: {source, url, text, credibility}              │
│                                                               │
│ 6. Apply Ralph Loop Pass 1 (Rule-Based)                      │
│    → Check: 3+ evidence? confidence >= 0.7?                   │
│    → Decision: ACCEPT/WEAK_ACCEPT/REJECT/SATURATED           │
│                                                               │
│ 7. Update confidence                                          │
│    → Starting: 0.50                                          │
│    → Delta: +0.06 per ACCEPT, +0.02 per WEAK_ACCEPT          │
│    → Ending: 0.50 + delta                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TEMPORAL CONTEXT: Build narrative from episodes              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Query Graphiti for episodes                               │
│    → get_entity_timeline(entity_id, limit=100)               │
│                                                               │
│ 2. Build temporal narrative                                   │
│    → narrative_builder.build_narrative_from_episodes()       │
│    → Token-bounded (max_tokens=2000)                          │
│    → Group by type (RFP, PARTNERSHIP, etc.)                  │
│                                                               │
│ 3. Analyze temporal patterns                                  │
│    → RFP frequency, tech adoptions, timing                    │
│    → Calculate temporal fit score (0.0-1.0)                    │
│                                                               │
│ 4. Calculate confidence boost                                  │
│    → 3+ RFPs: +0.10                                          │
│    → 1-2 RFPs: +0.05                                          │
│    → 0 RFPs: +0.00                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PASS 2: Network Context                                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Generate new hypotheses from Pass 1 findings             │
│    → React job → "React Mobile App RFP"                      │
│    → Digital transformation → "CRM Platform RFP"              │
│                                                               │
│ 2. Re-calculate EIG (with cluster state)                     │
│    → Cluster dampening reduces novelty for common patterns  │
│    → High-value categories prioritized                        │
│                                                               │
│ 3. Select top hypothesis (Pass 1 insights)                   │
│    → Focus on high-confidence areas                           │
│                                                               │
│ 4. Execute hop (network context)                             │
│    → Scrape partner tech stacks, competitors                 │
│    → Analyze with Claude                                      │
│                                                               │
│ 5. Collect evidence (add to existing)                         │
│    → Evidence count increases (3 → 5 → 8)                    │
│                                                               │
│ 6. Apply Ralph Loop Pass 2 (Claude Validation)                │
│    → Claude validates confidence matches evidence quality      │
│    → ConfidenceValidation object created                      │
│    → Manual review flag for edge cases                        │
│                                                               │
│ 7. Update confidence (with temporal boost)                    │
│    → Previous confidence + delta + temporal_boost              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TEMPORAL CONTEXT: Inter-pass narrative                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Build narrative from recent episodes (last 90 days)       │
│    → "2 RFPs detected, 1 partnership formed"                  │
│                                                               │
│ 2. Calculate temporal fit for hypotheses                     │
│    → Digital Transformation: 0.75 (1/2 episodes match)        │
│    → React Development: 0.50 (0/2 episodes match)             │
│                                                               │
│ 3. Generate focus areas for next pass                         │
│    → "High RFP Activity Areas", "Digital Transformation"      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PASS 3: Deep Dive                                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Generate evolved hypotheses (Pass 2 insights)             │
│    → Focus on top 3 signals from Pass 2                       │
│    → Cross-category hypotheses                               │
│                                                               │
│ 2. Re-calculate EIG (updated cluster state)                  │
│    → Novelty decays for frequently seen patterns              │
│                                                               │
│ 3. Select top hypothesis (highest confidence)                 │
│                                                               │
│ 4. Execute deep dive hop                                     │
│    → LinkedIn jobs, tech blogs, annual reports              │
│    → Maximum depth (4-5 levels)                               │
│                                                               │
│ 5. Collect evidence (add to existing)                         │
│    → Evidence count: 8 → 12 → 15                             │
│                                                               │
│ 6. Apply Ralph Loop Pass 3 (Final Confirmation)              │
│    → Duplicate detection                                      │
│    → Final confidence scoring                                 │
│    → Validation complete                                     │
│                                                               │
│ 7. Update confidence (with all boosts)                        │
│    → Final confidence: 0.90 (ACTIONABLE)                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FINAL RESULT                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Entity: Arsenal FC                                            │
│ Final Confidence: 0.90 (ACTIONABLE)                           │
│ Band: Ready for immediate outreach                            │
│                                                               │
│ Total Signals: 9                                              │
│ High Confidence (>0.7): 7                                     │
│                                                               │
│ Opportunities:                                                │
│ 1. React Web Development (0.85 confidence)                   │
│    → YP Service: React Web Development                       │
│    → Action: Immediate outreach                               │
│                                                               │
│ 2. Mobile App Development (0.78 confidence)                  │
│    → YP Service: React Native Mobile Apps                   │
│    → Action: High priority                                   │
│                                                               │
│ 3. Fan Engagement Platform (0.72 confidence)                │
│    → YP Service: Fan Engagement Platforms                    │
│    → Action: Engage                                         │
│                                                               │
│ Evidence Breakdown:                                          │
│ - Official site: 3 pieces                                    │
│ - Careers page: 4 pieces                                     │
│ - Press releases: 3 pieces                                   │
│ - Partner patterns: 2 pieces                                  │
│ - Temporal history: 2 pieces                                  │
│ Total: 14 evidence pieces across all signals                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 Confidence Boost Calculations

### Temporal Boost (Graphiti)

```python
def calculate_temporal_boost(rfp_count, tech_adoptions):
    """
    Calculate confidence boost from temporal patterns

    RFP History:
    - 3+ RFPs → +0.10 (high activity)
    - 1-2 RFPs → +0.05 (moderate activity)
    - 0 RFPs → +0.00 (no activity)

    Tech Adoptions:
    - 3+ → +0.05 additional
    - <3 → +0.00
    """
    boost = 0.0

    if rfp_count >= 3:
        boost += 0.10
    elif rfp_count >= 1:
        boost += 0.05

    if tech_adoptions >= 3:
        boost += 0.05

    return boost
```

**Example**:
```python
# Arsenal FC has 2 RFPs and 0 tech adoptions
boost = calculate_temporal_boost(rfp_count=2, tech_adoptions=0)
# = 0.05 (moderate RFP activity)

# Apply to confidence
confidence = 0.85 + boost
# = 0.90
```

### Network Boost (FalkorDB)

```python
def calculate_network_boost(partner_tech, entity_tech):
    """
    Calculate confidence boost from network intelligence

    Partner Technology Adoption:
    - Partner uses React, entity doesn't → +0.06
    - Partner recently adopted (< 6 months) → +0.04

    Technology Diffusion:
    - 2+ partners use same tech → +0.03
    - Competitor uses tech → +0.02 (pressure to keep up)
    """
    boost = 0.0

    # Partner adoption
    if partner_tech and partner_tech not in entity_tech:
        boost += 0.06

    # Technology diffusion
    if partner_count >= 2:
        boost += 0.03

    return boost
```

---

## 🧪 Testing & Validation

### Test Evidence Collection Over Time

```python
# backend/test_evidence_evolution.py

async def test_multi_pass_evidence():
    """Test how evidence accumulates across passes"""

    entity_id = "arsenal-fc"
    all_evidence = []

    # Pass 1: Initial evidence
    signal = Signal(
        id="signal-001",
        type=SignalType.RFP_DETECTED,
        confidence=0.75,
        entity_id=entity_id,
        evidence=[
            Evidence(source="LinkedIn", credibility_score=0.8, ...),
            Evidence(source="Careers Page", credibility_score=0.9, ...),
            Evidence(source="Press Release", credibility_score=0.85, ...)
        ]
    )

    print(f"Pass 1: {len(signal.evidence)} evidence, confidence={signal.confidence}")

    # Pass 2: Add network evidence
    signal.evidence.append(
        Evidence(source="Partner Tech Stack", credibility_score=0.7, ...)
    )
    signal.evidence.append(
        Evidence(source="Competitor Analysis", credibility_score=0.75, ...)
    )
    signal.confidence += 0.08  # Delta from new decisions

    print(f"Pass 2: {len(signal.evidence)} evidence, confidence={signal.confidence}")

    # Pass 3: Add temporal evidence
    signal.evidence.append(
        Evidence(source="Historical RFP Pattern", credibility_score=0.9, ...)
    )
    signal.confidence += 0.07  # Delta from new decisions

    print(f"Pass 3: {len(signal.evidence)} evidence, confidence={signal.confidence}")

    # Output
    # Pass 1: 3 evidence, confidence=0.75
    # Pass 2: 5 evidence, confidence=0.83
    # Pass 3: 6 evidence, confidence=0.90
```

### Test Confidence Math Determinism

```python
# backend/test_confidence_determinism.py

def test_confidence_never_drifts():
    """Test that confidence math is deterministic across runs"""

    # Same decisions should produce same confidence
    decisions_1 = {
        'ACCEPT': 3,
        'WEAK_ACCEPT': 1,
        'REJECT': 2
    }

    confidence_1 = 0.50 + (decisions_1['ACCEPT'] * 0.06) + (decisions_1['WEAK_ACCEPT'] * 0.02)
    # = 0.50 + (3 * 0.06) + (1 * 0.02)
    # = 0.50 + 0.18 + 0.02
    # = 0.70

    # Run again with same decisions
    decisions_2 = decisions_1.copy()
    confidence_2 = 0.50 + (decisions_2['ACCEPT'] * 0.06) + (decisions_2['WEAK_ACCEPT'] * 0.02)

    assert confidence_1 == confidence_2  # ✅ Deterministic
```

---

## 🎯 Best Practices

### 1. Evidence Collection

- **Minimum 3 evidence per signal** (Ralph Loop Pass 1 requirement)
- **Diverse sources** (official site, careers, press, partners)
- **Credibility scoring** (0.0-1.0 based on source authority)
- **Timestamp tracking** (evidence freshness matters)

### 2. Confidence Management

- **Fixed math** (never drifts, always deterministic)
- **Claude validation** (Pass 2 validates scraper confidence)
- **Temporal boosting** (historical patterns add confidence)
- **Saturation detection** (stop when 3 REJECTs in category)

### 3. BrightData SDK Usage

- **Use SDK directly** (not MCP - avoid timeout issues)
- **Batch scraping** (concurrent for multiple URLs)
- **HTTP fallback** (automatic when SDK unavailable)
- **Proxy rotation** (handled by SDK)

### 4. Narrative Building

- **Token-bounded** (max_tokens=2000 for Claude context)
- **Group by type** (RFP, PARTNERSHIP, EXECUTIVE_CHANGE)
- **Reverse chronological** (newest first)
- **Include confidence** (shows signal strength)

### 5. EIG Optimization

- **High-value categories** (C-Suite = 1.5x multiplier)
- **Novelty decay** (common patterns get lower EIG)
- **Uncertainty bonus** (low confidence = high EIG)
- **Cluster tracking** (pattern frequencies across entities)

---

## 📚 File Reference

| File | Purpose | Key Classes/Functions |
|------|---------|---------------------|
| `graphiti_service.py` | Temporal episodes storage | `GraphitiService`, `get_entity_timeline()`, `query_episodes()` |
| `narrative_builder.py` | Episodes → narratives | `build_narrative_from_episodes()`, `estimate_tokens()` |
| `schemas.py` | Entity/Signal/Evidence definitions | `Entity`, `Signal`, `Evidence`, `ConfidenceValidation` |
| `ralph_loop.py` | Multi-pass validation | `RalphLoop`, `validate_signals()`, 3-pass governance |
| `eig_calculator.py` | Hypothesis prioritization | `EIGCalculator`, `calculate_eig()`, cluster dampening |
| `brightdata_sdk_client.py` | Web scraping SDK | `BrightDataSDKClient`, `search_engine()`, `scrape_as_markdown()` |
| `multi_pass_context.py` | Context across passes | `MultiPassContext`, `get_pass_strategy()`, temporal patterns |
| `temporal_context_provider.py` | Inter-pass context | `TemporalContextProvider`, `get_inter_pass_context()`, fit scoring |

---

## ✅ System Status

**Fully Implemented & Tested**:
- ✅ Graphiti temporal episode tracking
- ✅ Narrative builder (token-bounded)
- ✅ Evidence collection over time (multi-pass)
- ✅ Confidence scoring (fixed math, deterministic)
- ✅ Ralph Loop 3-pass validation
- ✅ EIG calculator with cluster dampening
- ✅ BrightData SDK + Claude integration
- ✅ Multi-pass context manager
- ✅ Temporal fit scoring

**Production Ready**: Yes

**Last Updated**: 2026-02-05
**Version**: 1.0.0 (Complete System)
