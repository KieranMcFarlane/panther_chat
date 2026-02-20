# Complete System Quick Reference - Evidence, Confidence & Reasoning

## 🎯 The Big Picture

```
┌──────────────────────────────────────────────────────────┐
│  Multi-Layered RFP Discovery - Complete System           │
└──────────────────────────────────────────────────────────┘

Entity Dossier (what they have/need)
         ↓
Dossier Hypotheses (match to YP capabilities)
         ↓
Multi-Pass Discovery (3-4 passes with intelligence)
         ├─→ Pass 1: Initial discovery (dossier-informed)
         ├─→ Pass 2: Network context (partner/competitor)
         ├─→ Pass 3: Deep dive (temporal patterns)
         └─→ Pass 4+: Adaptive (cross-category)
         ↓
Each Pass Uses:
├─→ BrightData SDK (scraping)
├─→ Claude Agent SDK (analysis)
├─→ Graphiti (temporal episodes)
├─→ FalkorDB (network relationships)
├─→ Ralph Loop (3-pass validation)
├─→ Narrative Builder (episodes → stories)
└─→ EIG Calculator (hypothesis ranking)
         ↓
Final Result:
- Confidence score (0.0-1.0)
- Validated signals with evidence
- YP service matches
- Recommended actions
```

---

## 📊 Evidence Collection Over Time

### How Evidence Accumulates (Real Example)

**Pass 1: Initial Discovery** (3 evidence)
```
Signal: "Arsenal FC preparing React Web Development"
Evidence:
  1. LinkedIn: React Developer role (credibility: 0.8)
  2. Arsenal Careers: Frontend Engineer role (credibility: 0.9)
  3. Press Release: Digital platform rebuild (credibility: 0.85)

Confidence: 0.75
Decision: ACCEPT (+0.06)
Evidence Count: 3
```

**Pass 2: Network Context** (5 evidence)
```
Evidence (add 2 more):
  4. Partner Tech Stack: Partner X uses React (credibility: 0.7)
  5. Competitor Analysis: Chelsea uses React (credibility: 0.75)

Confidence: 0.75 → 0.83 (+0.08 from 2 ACCEPT, 1 WEAK_ACCEPT)
Evidence Count: 5
Decision: ACCEPT (+0.06), ACCEPT (+0.06), WEAK_ACCEPT (+0.02)
```

**Pass 3: Deep Dive** (6 evidence)
```
Evidence (add 1 more):
  6. Historical Pattern: RFP issued every March (credibility: 0.9)

Confidence: 0.83 → 0.90 (+0.07 from 2 ACCEPT)
Temporal Boost: +0.05 (2 RFPs in last 90 days)
Evidence Count: 6
Final Confidence: 0.90 (ACTIONABLE)
Decision: Ready for immediate outreach
```

### Evidence Schema

```python
from schemas import Evidence

evidence = Evidence(
    id="evidence-001",
    source="LinkedIn Job Posting",
    date=datetime.now(timezone.utc),
    signal_id="signal-001",
    url="https://linkedin.com/jobs/view/12345",
    extracted_text="Arsenal FC seeking React Developer for web platform rebuild...",
    credibility_score=0.8,  # 0.0-1.0 based on source authority
    metadata={
        "author": "Arsenal FC Recruiting Team",
        "freshness": "2 days ago",
        "verification": "Official company account"
    }
)
```

---

## 🧮 Confidence Scoring System

### Ralph Loop Fixed Math

**Rule**: Never drifts, always deterministic

```python
# Starting point
confidence = 0.50  # Neutral prior

# After each decision
for decision in decisions:
    if decision == "ACCEPT":
        confidence += 0.06
    elif decision == "WEAK_ACCEPT":
        confidence += 0.02
    # REJECT, NO_PROGRESS, SATURATED: += 0.00

# Enforce bounds
confidence = max(0.0, min(1.0, confidence))
```

**Example Calculation**:
```python
# Pass 1
decisions = ["ACCEPT", "WEAK_ACCEPT", "REJECT"]
delta = (1 * 0.06) + (1 * 0.02) + (1 * 0.00)
       = 0.08
confidence = 0.50 + 0.08 = 0.58

# Pass 2
decisions = ["ACCEPT", "ACCEPT", "ACCEPT", "REJECT", "REJECT"]
delta = (3 * 0.06) + (0 * 0.02) + (2 * 0.00)
       = 0.18
confidence = 0.58 + 0.18 = 0.76

# Pass 3
decisions = ["ACCEPT", "ACCEPT", "WEAK_ACCEPT"]
delta = (2 * 0.06) + (1 * 0.02)
       = 0.14
confidence = 0.76 + 0.14 = 0.90

# Final
confidence = 0.90  # ACTIONABLE band
```

### Claude Confidence Validation

**Purpose**: Claude validates that scraper-assigned confidence matches evidence quality

```python
from schemas import ConfidenceValidation

validation = ConfidenceValidation(
    original_confidence=0.75,      # What scraper said
    validated_confidence=0.82,      # What Claude says
    adjustment=0.07,                # Difference
    rationale="Evidence from official careers page (0.9 credibility) "
               "outweighs LinkedIn posting (0.8 credibility). "
               "Additional press release (0.85) supports high confidence.",
    requires_manual_review=False   # Clear case
)

# Edge case example
edge_case = ConfidenceValidation(
    original_confidence=0.65,
    validated_confidence=0.72,
    adjustment=0.07,
    rationale="Conflicting evidence: official site mentions CRM but "
               "no recent hiring. Slight boost due to partnership announcement. "
               "Human review recommended to verify intent.",
    requires_manual_review=True    # Flag for human review
)
```

---

## 🧠 EIG-Based Hypothesis Prioritization

### What is EIG?

**EIG** = Expected Information Gain
- High EIG = High priority for next exploration
- Balances uncertainty, novelty, and information value

### EIG Formula

```python
EIG(h) = (1 - confidence_h) × novelty_h × information_value_h
```

**Components**:

1. **Uncertainty** (`1 - confidence`)
   - Low confidence → High uncertainty → High EIG
   - Example: confidence=0.40 → uncertainty=0.60

2. **Novelty** (`1 / (1 + frequency)`)
   - Never seen → novelty=1.0
   - Seen once → novelty=0.5
   - Seen 5 times → novelty=0.167

3. **Information Value** (category multiplier)
   - C-Suite Hiring: 1.5 (highest value)
   - Digital Transformation: 1.3
   - CRM Implementation: 1.2
   - Operations: 1.0 (baseline)

### Example Calculations

```python
# Hypothesis 1: CRM Procurement (low confidence, never seen)
h1 = {
    "confidence": 0.42,
    "category": "CRM Implementation",
    "frequency": 0  # Never seen in cluster
}

eig_h1 = (1.0 - 0.42) × (1.0 / (1.0 + 0)) × 1.2
       = 0.58 × 1.0 × 1.2
       = 0.696  # High EIG → Prioritize this

# Hypothesis 2: Digital Transformation (high confidence, seen 5 times)
h2 = {
    "confidence": 0.85,
    "category": "Digital Transformation",
    "frequency": 5  # Common pattern
}

eig_h2 = (1.0 - 0.85) × (1.0 / (1.0 + 5)) × 1.3
       = 0.15 × 0.167 × 1.3
       = 0.033  # Low EIG → Deprioritize

# Hypothesis 3: CTO Hiring (medium confidence, seen once)
h3 = {
    "confidence": 0.60,
    "category": "C-Suite Hiring",
    "frequency": 1
}

eig_h3 = (1.0 - 0.60) × (1.0 / (1.0 + 1)) × 1.5
       = 0.40 × 0.5 × 1.5
       = 0.30  # Medium EIG → Moderate priority
```

---

## 🌐 BrightData SDK + Claude Setup

### Optimal Configuration

```python
from brightdata_sdk_client import BrightDataSDKClient
from claude_client import ClaudeClient

# Initialize clients
brightdata = BrightDataSDKClient()  # Official SDK
claude = ClaudeClient()

# Multi-hop discovery pattern
async def discover_entity(entity_id, entity_name):
    """Complete discovery with evidence collection"""

    all_evidence = []

    # Hop 1: Search for official site
    print(f"Hop 1: Finding official site for {entity_name}...")
    search_result = await brightdata.search_engine(
        query=f"{entity_name} official website careers",
        engine="google",
        num_results=5
    )

    if search_result['status'] == 'success':
        # Extract official site URL
        for result in search_result['results']:
            if 'official' in result['title'].lower() or entity_name.lower() in result['url'].lower():
                official_url = result['url']
                print(f"  ✓ Found: {official_url}")

                # Hop 2: Scrape official site
                print(f"Hop 2: Scraping {official_url}...")
                scrape_result = await brightdata.scrape_as_markdown(official_url)

                if scrape_result['status'] == 'success':
                    content = scrape_result['content']

                    # Hop 3: Analyze with Claude
                    print(f"Hop 3: Analyzing content with Claude...")
                    analysis = await claude.analyze(
                        prompt=f"""
                        Extract procurement signals from this content.

                        Entity: {entity_name}
                        Content: {content[:5000]}

                        Look for:
                        1. Job postings (technical roles)
                        2. Digital transformation mentions
                        3. Technology stack details
                        4. Partnership announcements
                        5. RFP indicators

                        Return as structured JSON with:
                        - signals_found: list
                        - confidence: 0.0-1.0
                        - evidence: list of quotes
                        """,
                        tools=[]  # No tools needed for text analysis
                    )

                    # Collect evidence
                    if analysis.get('signals_found'):
                        all_evidence.extend(analysis.get('evidence', []))
                        print(f"  ✓ Found {len(analysis.get('evidence', []))} pieces of evidence")

    return all_evidence
```

### HTTP Fallback (When SDK Unavailable)

**The SDK automatically falls back to httpx + BeautifulSoup**:

```python
# If SDK fails, this happens automatically:
result = await brightdata.scrape_as_markdown(url)

# SDK unavailable → uses httpx
{
    "status": "success",
    "content": "...",  # Scraped via httpx
    "metadata": {
        "source": "fallback_httpx",
        "warning": "BrightData SDK unavailable, using httpx"
    }
}
```

---

## 📖 Graphiti & Narrative Builder

### Graphiti: Temporal Episode Storage

```python
from graphiti_service import GraphitiService

# Initialize
graphiti = GraphitiService()
await graphiti.initialize()

# Store episode (automatically done by Ralph Loop)
episode = {
    "episode_id": "uuid-123",
    "entity_id": "arsenal-fc",
    "entity_name": "Arsenal FC",
    "episode_type": "RFP_DETECTED",
    "content": "Digital transformation RFP for CRM system",
    "timestamp": "2024-01-15T10:00:00Z",
    "confidence_score": 0.92,
    "metadata": {
        "source": "LinkedIn",
        "validated": True
    }
}

# Retrieve timeline
timeline = await graphiti.get_entity_timeline(
    entity_id="arsenal-fc",
    limit=100
)

# Returns list of episodes
# [
#   {"episode_type": "RFP_DETECTED", "timestamp": "2024-01-15", ...},
#   {"episode_type": "PARTNERSHIP_FORMED", "timestamp": "2024-02-01", ...},
#   ...
# ]
```

### Narrative Builder: Episodes → Claude Stories

```python
from narrative_builder import build_narrative_from_episodes

# Build Claude-friendly narrative
narrative_data = build_narrative_from_episodes(
    episodes=timeline,
    max_tokens=2000  # Fits in Claude context
)

print(narrative_data['narrative'])
"""
# Temporal Narrative (3 episodes: 2024-01-15 to 2024-03-10)

## Rfp Detected

- **2024-01-15** (Arsenal FC): [92%] Digital transformation RFP for CRM system
  (source: LinkedIn, category: Technology)

## Partnership Formed

- **2024-02-01** (Arsenal FC): Partnership with Salesforce announced
  (source: Press Release)

## Executive Change

- **2024-03-10** (Arsenal FC): New CTO appointed
  (source: News)
"""

print(f"Episodes: {narrative_data['episode_count']}/{narrative_data['total_episodes']}")
print(f"Tokens: ~{narrative_data['estimated_tokens']}")
print(f"Truncated: {narrative_data['truncated']}")
```

---

## 🔄 Complete Multi-Pass Flow

### End-to-End Example

```python
from multi_pass_ralph_loop import MultiPassRalphCoordinator
from temporal_context_provider import TemporalContextProvider

# Initialize
coordinator = MultiPassRalphCoordinator()
temporal_provider = TemporalContextProvider()

# Run discovery
result = await coordinator.run_multi_pass_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    max_passes=4
)

# Access results by pass
for pass_result in result.pass_results:
    pass_num = pass_result.pass_number

    print(f"\n=== Pass {pass_num} ===")

    # Strategy used
    print(f"Strategy: {pass_result.strategy.description}")
    print(f"Focus: {', '.join(pass_result.strategy.focus_areas[:3])}")

    # Signals validated
    print(f"Signals validated: {len(pass_result.validated_signals)}")

    # Show top signals
    for signal in sorted(pass_result.validated_signals, key=lambda s: s.confidence, reverse=True)[:3]:
        print(f"  - {signal.category}: {signal.confidence:.2f} (evidence: {len(signal.evidence)})")

    # Confidence delta
    print(f"Confidence delta: +{pass_result.confidence_delta:.3f}")

# Final summary
print(f"\n=== Final Result ===")
print(f"Final Confidence: {result.final_confidence:.2f}")
print(f"Total Signals: {result.total_signals_detected}")
print(f"High Confidence (>0.7): {result.high_confidence_signals}")
print(f"Unique Categories: {result.unique_categories}")
```

### Inter-Pass Temporal Context

```python
# Get temporal context between passes
context = await temporal_provider.get_inter_pass_context(
    entity_id="arsenal-fc",
    from_pass=2,
    to_pass=3,
    time_horizon_days=90
)

print(f"Narrative: {context.narrative_summary}")
# "2 RFP(s) detected"

print(f"Temporal Boost: +{context.confidence_boost:.2f}")
# "+0.05"

print(f"Focus Areas: {', '.join(context.focus_areas[:3])}")
# "High RFP Activity Areas, Digital Transformation, Web Development"
```

---

## 📋 Quick Reference Card

### Evidence Collection Rules

| Rule | Value |
|------|-------|
| Minimum evidence per signal | 3 pieces |
| Minimum confidence for validation | 0.70 |
| Evidence credibility range | 0.0-1.0 |
| Maximum validation passes | 3 |
| Category saturation threshold | 3 REJECTs |

### Confidence Math

| Decision Type | Delta |
|--------------|-------|
| ACCEPT | +0.06 |
| WEAK_ACCEPT | +0.02 |
| REJECT | +0.00 |
| NO_PROGRESS | +0.00 |
| SATURATED | +0.00 |

**Starting point**: 0.50
**Bounds**: 0.00 to 1.00

### EIG Categories

| Category | Multiplier | Priority |
|----------|-----------|----------|
| C-Suite Hiring | 1.5x | Highest |
| Digital Transformation | 1.3x | High |
| AI Platform | 1.3x | High |
| Data Analytics | 1.2x | Medium-High |
| CRM Implementation | 1.2x | Medium-High |
| Fan Engagement | 1.1x | Medium |
| Operations | 1.0x | Baseline |

### Temporal Boosts

| RFP Count | Tech Adoptions | Boost |
|-----------|----------------|-------|
| 3+ | Any | +0.10 |
| 1-2 | 3+ | +0.10 |
| 1-2 | 0-2 | +0.05 |
| 0 | Any | +0.00 |

---

## ✅ System Status

**Implemented Components**:
- ✅ Graphiti temporal episodes
- ✅ Narrative builder (token-bounded)
- ✅ Evidence collection (multi-pass)
- ✅ Confidence scoring (deterministic)
- ✅ Ralph Loop validation (3-pass)
- ✅ EIG calculator (cluster dampening)
- ✅ BrightData SDK (official + fallback)
- ✅ Multi-pass coordinator
- ✅ Temporal context provider

**Production Ready**: Yes

**Documentation**:
- `GRAPHITI_GRAPHRAG_COMPLETE_REFERENCE.md` - This document
- `MULTI_PASS_PHASE4_COMPLETE.md` - Implementation summary
- `MULTI_PASS_QUICK_REFERENCE.md` - Quick reference

---

**Last Updated**: 2026-02-05
**Version**: 1.0.0 (Complete System)
