# Entity Intelligence Journey: Complete Walkthrough

**Example Entity:** Boca Juniors (simulated)

> **⚠️ DISCLAIMER**
> All results shown are **SIMULATED** for demonstration purposes.
> Real system uses BrightData SDK for actual web scraping.
> URLs, scores, and RFPs are illustrative only.
> No actual RFPs or procurement opportunities are represented.

**Date:** 2026-02-22
**Purpose:** Demonstrate full pipeline from dossier → discovery → dashboard → feedback

---

## Phase 0: Entity Selection

```
User searches for: "Boca Juniors"
System finds entity in database: entity_id = "boca_juniors"
User clicks: "Generate Full Intelligence Dossier"
```

**Entity Metadata:**
- **ID**: boca_juniors
- **Name**: Boca Juniors
- **Type**: ORG (Organization)
- **League**: Argentine Primera División
- **Founded**: 1905
- **Stadium**: La Bombonera
- **Market**: South American football

---

## Phase 1: DOSSIER GENERATION (Cold Start)

### 1.1 Official Website Scraping

**File**: `backend/generate_entity_dossier.py`

```
Input:  Boca Juniors
URL:    https://www.bocajuniors.com.ar

Scraping Process:
├─ Extract leadership information
├─ Identify technology stack mentions
├─ Find procurement/tender notices
├─ Map partnership ecosystem
├─ Analyze budget indicators
└─ Build historical timeline
```

### 1.2 Initial Hypothesis Generation (SIMULATED)

The dossier analyzer generates **initial hypotheses** based on scraped data:

| Hypothesis ID | Category | Statement | Confidence | Source |
|---------------|----------|-----------|------------|--------|
| boca_juniors_crm_upgrade | CRM_UPGRADE | Boca Juniors needs CRM modernization | 0.65 | Website analysis |
| boca_juniors_analytics_platform | ANALYTICS_PLATFORM | Club lacks advanced analytics | 0.60 | Technology gap |
| boca_juniors_ticketing_system | TICKETING_SYSTEM | Current system needs mobile upgrade | 0.70 | Legacy system |
| boca_juniors_digital_transformation | DIGITAL_TRANSFORMATION | Digital initiative planned 2025 | 0.55 | Press release |

### 1.3 Dossier Output (SIMULATED)

**File:** `dossiers/boca_juniors_dossier.json`

```json
{
  "entity_id": "boca_juniors",
  "entity_name": "Boca Juniors",
  "generated_at": "2026-02-22T10:00:00Z",
  "total_confidence": 0.62,

  "sections": {
    "leadership_profile": {
      "president": "Jorge Amor Ameal",
      "key_executives": 8,
      "digital_maturity": "Medium"
    },

    "technology_stack": {
      "crm": "Legacy system",
      "analytics": "Third-party (Stats Perform)",
      "ticketing": "Ticketmaster integration",
      "ecommerce": "Basic platform"
    },

    "opportunities": [
      {
        "category": "CRM_UPGRADE",
        "title": "Fan Engagement CRM Modernization",
        "urgency": "High",
        "estimated_budget": "$500K - $1.5M",
        "confidence": 0.65
      },
      {
        "category": "ANALYTICS_PLATFORM",
        "title": "In-Game Analytics System",
        "urgency": "Medium",
        "estimated_budget": "$200K - $500K",
        "confidence": 0.60
      },
      {
        "category": "TICKETING_SYSTEM",
        "title": "Mobile-First Ticketing Platform",
        "urgency": "High",
        "estimated_budget": "$1M - $2M",
        "confidence": 0.70
      },
      {
        "category": "DIGITAL_TRANSFORMATION",
        "title": "Digital Transformation Initiative 2025",
        "urgency": "Medium",
        "estimated_budget": "$2M - $5M",
        "confidence": 0.55
      }
    ],

    "outreach_strategy": {
      "primary_contact": "VP Marketing",
      "recommended_approach": "Emphasize fan experience enhancement",
      "timing": "Q2 2025"
    }
  }
}
```

---

## Phase 2: HYPOTHESIS-DRIVEN DISCOVERY (Warm Start)

### 2.1 Dossier Context Initialization (SIMULATED)

**File**: `backend/hypothesis_driven_discovery.py`

```python
# Dossier hypotheses become PRIOR confidence (not neutral 0.50)
await discovery.initialize_from_dossier(
    entity_id="boca_juniors",
    dossier_hypotheses=[
        {
            "hypothesis_id": "boca_juniors_crm_upgrade",
            "category": "CRM_UPGRADE",
            "prior_confidence": 0.65,  # ← From dossier!
            "statement": "Boca Juniors needs CRM modernization"
        }
    ]
)
```

**Cost Comparison:**

| Approach | Starting Confidence | Iterations | Cost |
|---------|-------------------|------------|------|
| Cold Start | 0.50 | ~15-20 | ~$0.15 |
| **Warm Start (Dossier)** | 0.65 | ~8-12 | ~$0.08 |
| **Savings** | - | **47%** | **47%** |

### 2.2 Targeted Query Generation

Dossier signals generate **targeted search queries**:

| Dossier Signal | Generic Query | Targeted Query |
|----------------|---------------|-----------------|
| "Fan Engagement CRM Modernization" | "Boca Juniors CRM" | "Boca Juniors CRM fan engagement procurement tender" |
| "In-Game Analytics System" | "Boca Juniors analytics" | "Boca Juniors sports analytics RFP proposal" |
| "Mobile-First Ticketing Platform" | "Boca Juniors ticketing" | "Boca Juniors mobile ticketing system vendor selection" |

### 2.3 Discovery Execution (SIMULATED)

**File**: `backend/hypothesis_driven_discovery.py`

```python
result = await discovery.run_discovery(
    entity_id="boca_juniors",
    entity_name="Boca Juniors",
    template_id="south_american_club_centralized_procurement",
    max_iterations=30,
    max_depth=3
)
```

**Search Results (SIMULATED for demonstration):**

| Search | Results | Key Finding |
|-------|---------|-------------|
| CRM fan engagement tender | 7 results | PROCUREMENT_INDICATOR (0.72) |
| CRM system salesforce | 8 results | PROCUREMENT_INDICATOR (0.65) |
| Sports analytics RFP | 6 results | PROCUREMENT_INDICATOR (0.68) |
| Analytics partner | 7 results | CAPABILITY: Stats Perform (0.62) |
| Mobile ticketing vendor | 9 results | **VALIDATED_RFP (0.75)** |
| Season ticket technology | 8 results | PROCUREMENT_INDICATOR (0.60) |
| Digital transformation partnership | 7 results | PROCUREMENT_INDICATOR (0.55) |

> **Note**: In a real run, each result would include actual URLs, titles, and snippets from BrightData SDK searches.

### 2.4 Signal Classification (SIMULATED)

| Category | Signals | State | Maturity | Activity |
|----------|---------|-------|----------|----------|
| CRM_UPGRADE | 2 CAPABILITY, 2 PROCUREMENT | MONITOR | 0.25 | 0.30 |
| ANALYTICS_PLATFORM | 1 CAPABILITY, 2 PROCUREMENT | MONITOR | 0.15 | 0.25 |
| TICKETING_SYSTEM | 0 CAPABILITY, 2 PROCUREMENT | **LIVE** | 0.00 | 0.08 |
| DIGITAL_TRANSFORMATION | 0 CAPABILITY, 1 PROCUREMENT | MONITOR | 0.00 | 0.15 |

---

## Phase 3: DASHBOARD SCORING

### 3.1 Three-Axis Calculation

**File**: `backend/dashboard_scorer.py`

```python
scores = await scorer.calculate_entity_scores(
    entity_id="boca_juniors",
    entity_name="Boca Juniors",
    hypotheses=dossier_hypotheses + discovered_hypotheses
)
```

### 3.2 Score Breakdown (SIMULATED)

#### Axis 1: Procurement Maturity (0-100)

```
Capability Signals (40%):     25.0
Digital Initiatives (30%):    15.0
Partnership Activity (20%):   10.0
Executive Changes (10%):      5.0
────────────────────────────────────
TOTAL MATURITY:               55.0/100
```

#### Axis 2: Active Procurement Probability (6-month)

```
Validated RFP Bonus (+40%):    0.40  ← Hypothetical RFP
Procurement Density (30%):     0.15
Temporal Recency (20%):        0.18
EIG Confidence (10%):           0.02
────────────────────────────────────
TOTAL PROBABILITY:             0.75 (75%)
```

#### Axis 3: Sales Readiness Level

```
IF validated_rfp_detected:
   → LIVE (regardless of maturity/probability)

Boca Juniors (SIMULATED): 1 VALIDATED_RFP → LIVE
```

### 3.3 Confidence Interval

```
Sample Size: 1 (base) + 4 (hypotheses) = 5
Confidence Level: 0.5 + (5 × 0.05) = 0.75 (75%)

Margin of Error: (1 - 0.75) × 10 = 2.5%

Maturity Range: [52.5, 57.5]
Probability Range: [72.5%, 77.5%]
```

---

## Phase 4: FEEDBACK LOOP

### 4.1 Updated Dossier (SIMULATED)

```json
{
  "entity_id": "boca_juniors",
  "enriched_at": "2026-02-22T10:30:00Z",

  "original_opportunities": 4,
  "discovered_signals": 8,
  "validated_rfps": 1,

  "final_scores": {
    "procurement_maturity": 55.0,
    "active_probability": 0.75,
    "sales_readiness": "LIVE"
  },

  "new_intelligence": {
    "validated_rfp": {
      "title": "Sistema de entradas móviles - Licitación Pública",
      "source": "discovered via BrightData",
      "value_estimate": "$1.5M - $2M",
      "confidence": 0.75
    },
    "priority_recommendation": "HIGH - Active RFP detected"
  }
}
```

### 4.2 Outreach Strategy Update

| Before Discovery | After Discovery |
|-----------------|----------------|
| Target: VP Marketing | Target: Procurement Director |
| Approach: Educational | Approach: RFP Response |
| Timing: Q2 2025 | Timing: IMMEDIATE (3-week deadline) |
| Value: $500K opportunity | Value: $1.5M opportunity |

---

## Summary: Boca Juniors Journey (SIMULATED)

| Phase | Duration | Input | Output | Value |
|-------|----------|-------|--------|-------|
| **Dossier** | 45 sec | Official website | 4 initial hypotheses | Warm start |
| **Discovery** | 90 sec | Dossier + searches | 8 new signals | Validates gaps |
| **Dashboard** | 2 sec | All hypotheses | 3-axis scores | Sales signal |
| **Total** | **~2 min** | - | **LIVE state** | Actionable |

---

## Scaling to 3,000+ Entities

### Processing Time (Estimated)

```
Per entity:        ~2 minutes
Sequential:         3,000 × 2 min = 100 hours
Parallel (10 con):   ~10 hours for full database
```

### Expected Distribution (Based on Demo Results)

| Readiness Level | % of Entities | Count | Action |
|----------------|--------------|-------|--------|
| LIVE | ~5% | ~150 | Immediate outreach |
| HIGH_PRIORITY | ~10% | ~300 | Top priority |
| ENGAGE | ~20% | ~600 | Active engagement |
| MONITOR | ~60% | ~1,800 | Watchlist |
| NOT_READY | ~5% | ~150 | Monitor only |

### Pipeline Value (Hypothetical)

```
150 LIVE entities × 20% conversion × $1M avg deal size = $30M pipeline
300 HIGH_PRIORITY × 15% conversion × $500K avg = $22.5M pipeline
───────────────────────────────────────────────────────────────
Total Potential: ~$50M+ pipeline from full database run
```

---

## Files Involved

| Phase | File | Lines | Purpose |
|-------|------|-------|---------|
| Dossier | `backend/generate_entity_dossier.py` | 866 | 11-section dossier generation |
| Discovery | `backend/hypothesis_driven_discovery.py` | 2,000+ | EIG-based exploration |
| Dashboard | `backend/dashboard_scorer.py` | 720 | Three-axis scoring |
| Integration | `run_discovery_with_dossier_context()` | 120 | Dossier→Discovery bridge |

---

## Client FAQ

**Q: How accurate are the confidence scores?**
A: Confidence reflects data quantity, not prediction accuracy. 75% means we have 5 hypotheses worth of data. More hypotheses = higher confidence.

**Q: What if no signals are found?**
A: Entity would score NOT_READY. System is conservative - no data = no outreach recommendation.

**Q: How often should we re-run?**
A: Recommended: Monthly for ENGAGE+, quarterly for MONITOR. LIVE entities trigger immediate alerts.

**Q: Can we customize for our industry?**
A: Yes. Template system adapts to any sector. Categories, search queries, and scoring weights are configurable.

---

*Document: ENTITY-JOURNEY-WALKTHROUGH.md*
*Version: 1.0*
*Generated: 2026-02-22*
*Status: For Client Presentation Only*
