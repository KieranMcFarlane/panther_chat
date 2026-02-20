# Entity Dossier System - Strategic Architecture

## Purpose: Hypothesis-Driven Discovery at Scale

**Goal**: Generate actionable intelligence dossiers for 3,000+ entities that feed into automated RFP discovery and human sales prioritization.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTITY DATABASE (3,000+)                      │
│                  FalkorDB + Supabase Cache                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ├─ Priority Score (0-100)
                     ├─ Entity Type (Club, League, Partner, etc.)
                     ├─ Last Updated Timestamp
                     └─ Available Data Quality
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DOSSIER GENERATOR                              │
│              Tier-Based Processing Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│  Priority 0-20   → BASIC (3 sections)   → $0.0004, ~5s         │
│  Priority 21-50  → STANDARD (7 sections) → $0.0095, ~15s        │
│  Priority 51-100 → PREMIUM (11 sections) → $0.057, ~30s         │
│                                                                  │
│  Model Cascade:                                                   │
│  - Haiku (80%): Core info, quick actions, contact, news         │
│  - Sonnet (15%): Digital maturity, leadership, AI assessment    │
│  - Opus (5%): Strategic analysis, connections, hypothesis gen   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DOSSIER OUTPUT STRUCTURE                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Metadata (entity info, confidence scores, signal tags)      │
│  2. Executive Summary (assessment, quick actions, key insights) │
│  3. Digital Infrastructure (tech stack, vendors, capability gaps)│
│  4. Procurement Signals (opportunities, budget, initiatives)    │
│  5. Leadership Analysis (decision makers, influence network)     │
│  6. Timing Analysis (contract windows, strategic cycles)         │
│  7. Risk Assessment (implementation risks, competition)          │
│  8. Recommended Approach (immediate actions, hypotheses)        │
│  9. Next Steps (monitoring triggers, data gaps, engagement)     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              SIGNAL EXTRACTION & HYPOTHESIS GENERATION           │
├─────────────────────────────────────────────────────────────────┤
│  Extract:                                                         │
│  - [PROCUREMENT] signals → RFP likelihood scores                │
│  - [CAPABILITY] signals → Tech gap identification               │
│  - [TIMING] signals → Contract window alerts                    │
│  - [CONTACT] signals → Decision maker mapping                  │
│                                                                  │
│  Generate:                                                       │
│  - Primary hypothesis (testable assertion about procurement)    │
│  - Secondary hypotheses (alternative scenarios)                 │
│  - Validation strategies (how to test)                           │
│  - Success metrics (what to measure)                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                 HYPOTHESIS-DRIVEN DISCOVERY                      │
│              (backend/hypothesis_driven_discovery.py)            │
├─────────────────────────────────────────────────────────────────┤
│  Input: 3,000 entities + generated hypotheses                    │
│                                                                  │
│  Process:                                                        │
│  1. EIG-based ranking (Expected Information Gain)               │
│  2. Single-hop exploration (deterministic cost control)         │
│  3. Signal validation (Ralph Loop 3-pass governance)           │
│  4. Confidence calculation (delta-based math)                   │
│                                                                  │
│  Output:                                                         │
│  - Validated signals (ACCEPT/WEAK_ACCEPT/REJECT)                │
│  - Confidence scores (0.00-1.00)                                │
│  - Recommended actions (immediate vs. monitor)                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ACTION DISPATCH                              │
├─────────────────────────────────────────────────────────────────┤
│  CONFIDENT (>0.60) + ACCEPTs → Sales outreach                   │
│  INFORMED (0.30-0.60) → Monitoring + periodic reassessment       │
│  EXPLORATORY (<0.30) → Background monitoring only               │
│                                                                  │
│  Human Sales Team:                                               │
│  - Warm introduction via LinkedIn connections                   │
│  - Targeted messaging based on decision maker profiles          │
│  - ROI projections and success metrics                           │
│                                                                  │
│  Automated Monitoring:                                           │
│  - Web scrapers for RFP announcements                           │
│  - LinkedIn job posting tracking                                 │
│  - News/press release monitoring                                 │
│  - Contract renewal date alerts                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dossier Content Strategy

### What Makes a Dossier "Hypothesis-Ready"?

#### 1. **Signal Tagging**
Every insight is tagged with signal type:
- `[PROCUREMENT]`: Active buying signals, RFP likelihood, budget movement
- `[CAPABILITY]`: Tech gaps, digital maturity, infrastructure needs
- `[TIMING]`: Contract windows, strategic cycles, urgency indicators
- `[CONTACT]`: Decision makers, influence mapping, introduction paths

**Example**:
```json
{
  "insight": "Current analytics contract expires in 3 months",
  "signal_type": "[TIMING]",
  "confidence": 85,
  "source": "Contract analysis & vendor disclosure"
}
```

#### 2. **Confidence Scoring**
All assertions include 0-100 confidence scores:
- **90-100**: Directly observed, recent data
- **70-89**: Strong inference from multiple data points
- **50-69**: Moderate inference, some ambiguity
- **30-49**: Weak signal, requires validation
- **0-29**: Speculative, hypothesis only

#### 3. **Hypothesis Generation**
Each dossier produces 3-5 testable hypotheses:

**Primary Hypothesis**:
```json
{
  "statement": "Entity likely to issue RFP for fan engagement platform within 3-6 months due to expired contract and strategic initiative",
  "confidence": 75,
  "validation_strategy": "Monitor official tender portals + vendor news",
  "success_metrics": ["RFP published", "Vendor meetings scheduled"],
  "next_signals": ["[PROCUREMENT] Budget allocation announcement", "[TIMING] Contract expiration"]
}
```

#### 4. **Actionable Next Steps**
Clear, time-bound actions with ownership:
```json
{
  "action": "Schedule intro via mutual connection Sarah Mitchell",
  "priority": "HIGH",
  "timeline": "2-4 weeks",
  "owner": "Sales: Stuart Cope",
  "success_criteria": "Meeting scheduled with Commercial Director",
  "hypothesis_to_test": "Warm introduction increases engagement probability by 3x"
}
```

---

## Scale Strategy: 3,000 Entities

### Cost-Optimized Processing

**Priority Distribution** (estimated):
- **1,800 entities** (60%) → Basic tier @ $0.0004 = **$0.72**
- **900 entities** (30%) → Standard tier @ $0.0095 = **$8.55**
- **300 entities** (10%) → Premium tier @ $0.057 = **$17.10**

**Total Cost**: ~$26 for all 3,000 entities

### Parallel Processing

```
Batch size: 50 entities
Concurrent limit: 10 batches
Throughput: 500 entities per batch cycle

Estimated time:
- Basic: 1,800 entities / 10 concurrent = 180 cycles × 5s = 15 minutes
- Standard: 900 entities / 10 concurrent = 90 cycles × 15s = 22.5 minutes
- Premium: 300 entities / 10 concurrent = 30 cycles × 30s = 15 minutes

Total: ~52 minutes for full dossier generation
```

### Caching Strategy

- **Cache duration**: 7 days for Standard/Premium, 30 days for Basic
- **Invalidation triggers**: Manual refresh + significant entity changes
- **Cache hit target**: 80%+ (reduce regeneration costs)

---

## Integration with Existing Systems

### 1. Hypothesis-Driven Discovery
**File**: `backend/hypothesis_driven_discovery.py`

**Dossier integration**:
```python
# Dossier provides initial hypothesis set
dossier_hypotheses = extract_hypotheses_from_dossier(dossier_data)

# Feed into EIG calculator for prioritization
ranked_hypotheses = eig_calculator.rank_hypotheses(
    dossier_hypotheses,
    prior_confidence=dossier['metadata']['confidence_overall']
)

# Execute top hypotheses via single-hop discovery
for hypothesis in ranked_hypotheses[:5]:
    result = await discovery.run_single_hop(hypothesis)
```

### 2. Ralph Loop Validation
**File**: `backend/ralph_loop.py`

**Dossier integration**:
```python
# Dossier signals as input to validation
raw_signals = extract_signals_from_dossier(dossier_data)

# Validate via 3-pass governance
validated_signals = await ralph_loop.validate_signals(
    raw_signals=raw_signals,
    entity_id=dossier['metadata']['entity_id'],
    min_evidence=3,
    min_confidence=0.7
)

# Update confidence based on validation
final_confidence = calculate_confidence_from_decisions(validated_signals)
```

### 3. Template System
**File**: `backend/template_discovery.py`

**Dossier integration**:
```python
# Dossier provides entity-specific context
entity_context = {
    'digital_maturity': dossier['digital_infrastructure']['digital_maturity_metrics'],
    'vendor_relationships': dossier['digital_infrastructure']['vendor_relationships'],
    'procurement_signals': dossier['procurement_signals']
}

# Match against existing templates
matched_templates = template_discovery.match_templates(
    entity_context=entity_context,
    template_library=production_templates
)

# Generate entity-specific template if no match
if not matched_templates:
    new_template = template_discovery.generate_template(entity_context)
```

---

## Human-AI Collaboration Design

### AI Gets: Structured Data
```json
{
  "confidence": 75,
  "signals": ["[PROCUREMENT]", "[TIMING]"],
  "hypothesis_id": "hyp_arsenal_001",
  "validation_strategy": "monitor_tender_portals",
  "next_signals": ["budget_announcement", "contract_expiration"]
}
```

### Humans Get: Narrative + Actionable Intelligence
```markdown
## Arsenal FC - Priority: HIGH (85/100)

### Immediate Opportunity
Arsenal's analytics contract with NTT DATA expires in 3 months. Based on recent
job postings for "Fan Engagement Platform Lead" and budget allocation in annual
report, they're likely to issue an RFP in Q2 2025.

### Recommended Action
Schedule warm introduction via Stuart Cope → Sarah Mitchell → Juliet Slot
(Commercial Director). Position Yellow Panther as "lightweight experimental R&D wing"
for pilot projects NTT cannot deliver quickly.

### Success Criteria
- Intro meeting scheduled within 2 weeks
- Pilot project proposal accepted within 6 weeks
- Proof of concept deployed within 3 months
```

### Decision Support: Confidence Bands

| Band | Range | Meaning | Action |
|------|-------|---------|--------|
| **EXPLORATORY** | <0.30 | Research phase | Monitor only |
| **INFORMED** | 0.30-0.60 | Monitoring | Add to watchlist |
| **CONFIDENT** | 0.60-0.80 | Sales engaged | Prioritize outreach |
| **ACTIONABLE** | >0.80 + gate | Immediate outreach | dedicate resources |

---

## Quality Assurance

### Prompt Engineering Safeguards

1. **Abstract Examples**: No entity-specific data in templates
2. **Explicit Instructions**: "Generate entity-specific analysis ONLY"
3. **Confidence Requirements**: All assertions must have scores
4. **Signal Tagging**: Every insight tagged with signal type
5. **Hypothesis Readiness**: Clear boolean flag for hypothesis-ready insights

### Output Validation

```python
def validate_dossier_structure(dossier: dict) -> bool:
    """Ensure dossier meets hypothesis-ready standards"""

    required_sections = [
        'metadata',
        'executive_summary',
        'digital_infrastructure',
        'procurement_signals',
        'leadership_analysis',
        'timing_analysis',
        'recommended_approach',
        'next_steps'
    ]

    # Check all sections present
    for section in required_sections:
        if section not in dossier:
            return False

    # Check confidence scores on all insights
    insights = dossier['executive_summary']['key_insights']
    for insight in insights:
        if 'confidence' not in insight or insight['confidence'] > 100:
            return False

    # Check signal tagging
    for insight in insights:
        if 'signal_type' not in insight:
            return False

    # Check hypothesis generation
    if 'hypothesis_generation' not in dossier['recommended_approach']:
        return False

    return True
```

---

## Monitoring & Iteration

### Metrics to Track

1. **Dossier Quality**:
   - Hypothesis validation rate (how many prove true)
   - Signal accuracy (how many predictions correct)
   - Human feedback ratings (usefulness score)

2. **System Performance**:
   - Cache hit rate (target: 80%+)
   - Generation time (target: <60min for 3k entities)
   - Cost per entity (target: <$0.01 average)

3. **Business Impact**:
   - RFP detection rate (how many discovered)
   - Sales win rate (dossier-assisted vs. cold)
   - Time-to-opportunity (faster detection = advantage)

### Continuous Improvement

```python
# Track hypothesis outcomes
hypothesis_outcomes = {
    'hyp_arsenal_001': {
        'prediction': 'RFP issued in Q2 2025',
        'actual': 'RFP issued March 2025',
        'correct': True,
        'confidence_at_prediction': 75,
        'feedback_used_to_improve': True
    }
}

# Recalibrate confidence scoring
actual_outcomes = [h for h in hypothesis_outcomes.values()]
predicted_confidences = [h['confidence_at_prediction'] for h in actual_outcomes]

# Adjust scoring model if systematic bias
if avg(predicted_confidences) - actual_success_rate > 0.1:
    recalibrate_confidence_model()
```

---

## Summary

**Strategic Goal**: Transform 3,000 entities from database records into actionable intelligence that drives automated RFP discovery and prioritized human sales outreach.

**Key Innovations**:
1. **Abstract prompt templates** prevent literal copying
2. **Signal tagging** enables automated hypothesis generation
3. **Tiered processing** optimizes cost at scale
4. **Confidence scoring** supports human-AI collaboration
5. **Hypothesis-ready output** feeds directly into discovery system

**Expected Impact**:
- **Cost**: ~$26 for full 3,000-entity dossier generation
- **Time**: ~60 minutes for parallel processing
- **Value**: Continuous RFP intelligence + prioritized sales pipeline
