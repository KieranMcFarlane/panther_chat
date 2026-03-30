# Multi-Layered RFP Discovery System - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MULTI-LAYERED RFP DISCOVERY                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Dossier-Informed Hypothesis Generation                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Entity Dossier (BASIC/STANDARD/PREMIUM)                                 │
│  ├── Core Information                                                    │
│  ├── Digital Maturity                                                   │
│  ├── Leadership                                                         │
│  ├── Recent News                                                        │
│  └── [6 more sections...]                                              │
│           ↓                                                               │
│  DossierHypothesisGenerator                                              │
│  ├── Extract entity needs from sections                                 │
│  ├── Match needs to YP capabilities                                     │
│  └── Generate confidence-weighted hypotheses                            │
│           ↓                                                               │
│  Hypotheses: [React Dev, Mobile Apps, Digital Transformation...]       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Multi-Pass Context Management                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  MultiPassContext                                                        │
│  ├── Temporal Patterns (Graphiti)                                       │
│  │   ├── RFP history (timing, frequency)                                │
│  │   ├── Technology adoption patterns                                    │
│  │   └── Partnership history                                            │
│  │                                                                       │
│  ├── Graph Context (FalkorDB)                                          │
│  │   ├── Partners and their tech stacks                                 │
│  │   ├── Competitors and capabilities                                   │
│  │   └── Network-inferred hypotheses                                    │
│  │                                                                       │
│  └── Pass Strategy Generator                                            │
│      ├── Pass 1: Initial discovery (10 iterations, depth 2)            │
│      ├── Pass 2: Network context (15 iterations, depth 3)              │
│      ├── Pass 3: Deep dive (20 iterations, depth 4)                    │
│      └── Pass 4+: Adaptive (25 iterations, depth 5)                     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Multi-Pass Ralph Loop Coordinator                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  MultiPassRalphCoordinator                                               │
│                                                                           │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐  │
│  │   PASS 1   │ →  │   PASS 2   │ →  │   PASS 3   │ →  │  PASS 4+   │  │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘  │
│         ↓                 ↓                 ↓                 ↓          │
│                                                                           │
│  For each pass:                                                           │
│  1. Get strategy (focus areas, hop types, depth)                         │
│  2. Run discovery (single-hop, deterministic)                            │
│  3. Validate with Ralph Loop (3-pass governance)                         │
│  4. Generate new hypotheses from findings                                 │
│  5. Check stopping conditions (saturation, plateau)                      │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ OUTPUT: MultiPassResult                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  • Final confidence score (e.g., 0.75 = CONFIDENT)                        │
│  • Total signals detected (e.g., 12)                                     │
│  • High-confidence signals (>0.7) (e.g., 8)                              │
│  • Opportunity recommendations matched to YP services                     │
│  • Cost tracking (API credits, time)                                      │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌──────────────────┐
│  ENTITY DOSSIER   │
│  (11 sections)    │
└────────┬─────────┘
         │
         ↓ Extract needs
┌────────────────────────────────────────────────────────────────┐
│  NEED: React Developer job posting                                │
│  EVIDENCE: "Seeking React Developer for web platform rebuild"  │
│  SECTION: Careers Page                                          │
│  CONFIDENCE: 0.75                                               │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓ Match to YP capabilities
┌────────────────────────────────────────────────────────────────┐
│  YP CAPABILITY: React Web Development                            │
│  SERVICE: "Modern React.js web applications"                    │
│  TECHNOLOGY: React.js                                           │
│  TARGET MARKETS: Sports & Entertainment                        │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓ Generate hypothesis
┌────────────────────────────────────────────────────────────────┐
│  HYPOTHESIS                                                       │
│  ID: arsenal-fc_react_development                               │
│  STATEMENT: "Arsenal FC is preparing procurement related to    │
│              React Web Development"                               │
│  PRIOR PROBABILITY: 0.75 (boosted by dossier tier)            │
│  CONFIDENCE: 0.75                                               │
│  METADATA:                                                       │
│    - dossier_derived: true                                       │
│    - yp_capability: React Web Development                        │
│    - source_section: careers                                     │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓ Pass 1: Initial discovery
┌────────────────────────────────────────────────────────────────┐
│  DISCOVERY RESULTS                                                │
│  - Explored: Official Site, Careers Page                          │
│  - Iterations: 10 (depth 2)                                      │
│  - Raw signals: 5                                                │
│  - Ralph validated: 3 (passes 3-pass governance)                  │
│  - Confidence delta: +0.12                                        │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓ Pass 2: Network context
┌────────────────────────────────────────────────────────────────┐
│  NETWORK INTELLIGENCE                                              │
│  - Partner X uses React → 0.6 confidence boost                   │
│  - Competitor Y launched mobile app → mobile hypothesis         │
│  - Temporal: Entity issues RFPs every March → timing insight    │
│                                                                   │
│  NEW HYPOTHESES GENERATED:                                        │
│  - React Mobile App RFP (from React Dev job)                    │
│  - Fan Engagement Platform (from digital transformation)          │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓ Pass 3: Deep dive
┌────────────────────────────────────────────────────────────────┐
│  DEEP DIVE RESULTS                                                │
│  - Focused on top 3 signals from Pass 2                           │
│  - Explored to depth 4 (LinkedIn, tech blogs, annual reports)    │
│  - Raw signals: 8                                                │
│  - Ralph validated: 6 (high confidence)                           │
│  - Confidence delta: +0.08                                        │
└────────┬───────────────────────────────────────────────────────┘
         │
         ↓ Final result
┌────────────────────────────────────────────────────────────────┐
│  FINAL CONFIDENCE: 0.88 (ACTIONABLE)                             │
│  TOTAL SIGNALS: 9                                                │
│  HIGH CONFIDENCE (>0.7): 7                                        │
│  RECOMMENDED ACTION: "Immediate outreach"                         │
│                                                                   │
│  OPPORTUNITIES:                                                   │
│  1. React Web Development (confidence: 0.85)                       │
│     → YP Service: React Web Development                          │
│     → Estimated Value: High                                      │
│                                                                   │
│  2. Mobile App Development (confidence: 0.78)                     │
│     → YP Service: React Native Mobile Apps                       │
│     → Estimated Value: Medium-High                               │
│                                                                   │
│  3. Fan Engagement Platform (confidence: 0.72)                    │
│     → YP Service: Fan Engagement Platforms                       │
│     → Estimated Value: Medium                                    │
└────────────────────────────────────────────────────────────────┘
```

## Intelligence Sources Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE SOURCES                          │
└─────────────────────────────────────────────────────────────────┘

1. DOSSIER INTELLIGENCE
   ├─ What: Entity needs from dossier sections
   ├─ Source: FalkorDB + BrightData + Hypothesis Signals
   ├─ Example: "React Developer job posting"
   └→ Hypothesis: "React Web Development RFP"

2. TEMPORAL INTELLIGENCE (Graphiti)
   ├─ What: Historical patterns and timing
   ├─ Source: temporal_episodes table
   ├─ Example: "RFPs issued every March for 3 years"
   └→ Insight: "High probability of RFP in Q1"

3. NETWORK INTELLIGENCE (FalkorDB)
   ├─ What: Partner/competitor relationships
   ├─ Source: Entity graph (PARTNER_OF, COMPETES_WITH)
   ├─ Example: "Partner X adopted React 6 months ago"
   └→ Hypothesis: "React adoption likely (technology diffusion)"

4. RALPH LOOP VALIDATION
   ├─ What: Deterministic, governed validation
   ├─ Process: 3-pass (Rule-based → Claude → Final)
   ├─ Example: "3 pieces of evidence, confidence 0.85"
   └→ Decision: "ACCEPT with confidence > 0.7"

5. YELLOW PANTHER CAPABILITIES
   ├─ What: Agency services and technologies
   ├─ Source: YELLOW-PANTHER-PROFILE.md
   ├─ Example: "React Web Development, React Native Mobile"
   └→ Match: "Entity need → YP service"
```

## Confidence Evolution

```
Pass 1: Initial Discovery
├─ Starting confidence: 0.50 (neutral prior)
├─ Signals found: 3 (1 ACCEPT, 1 WEAK_ACCEPT, 1 REJECT)
├─ Delta: +0.08 (1 * 0.06 + 1 * 0.02)
└─ Ending confidence: 0.58

Pass 2: Network Context
├─ Starting confidence: 0.58
├─ Signals found: 5 (3 ACCEPT, 1 WEAK_ACCEPT, 1 REJECT)
├─ Network boost: +0.06 (partner uses React)
├─ Delta: +0.14 (3 * 0.06 + 1 * 0.02)
└─ Ending confidence: 0.72

Pass 3: Deep Dive
├─ Starting confidence: 0.72
├─ Signals found: 4 (3 ACCEPT, 0 WEAK_ACCEPT, 1 REJECT)
├─ Temporal boost: +0.02 (RFP pattern matches)
├─ Delta: +0.10 (3 * 0.06)
└─ Ending confidence: 0.82

FINAL CONFIDENCE: 0.82 (ACTIONABLE band)
```

## Stopping Conditions

```
┌─────────────────────────────────────────────────────────────────┐
│              STOPPING CONDITIONS (Early Termination)             │
└─────────────────────────────────────────────────────────────────┘

1. CONFIDENCE SATURATION
   Condition: < 0.01 gain over last 2 passes
   Example: Pass 2 (+0.03), Pass 3 (+0.008), Pass 4 (+0.007)
   Action: Stop exploration

2. SIGNAL EXHAUSTION
   Condition: No new signals in last pass
   Example: Pass 2 found 5 signals, Pass 3 found 0 signals
   Action: Stop exploration

3. HIGH CONFIDENCE PLATEAU
   Condition: > 0.85 confidence with minimal gain (<0.02)
   Example: Confidence 0.86 → 0.87 → 0.87
   Action: Stop exploration (already actionable)

4. CATEGORY SATURATION
   Condition: 3 consecutive REJECTs in a category
   Example: Mobile Apps: REJECT, REJECT, REJECT
   Action: Skip this category in future passes
```

## Key Files

```
backend/
├── dossier_hypothesis_generator.py      # Phase 1 (450 lines)
│   └── DossierHypothesisGenerator
│       ├── generate_hypotheses_from_dossier()
│       ├── _extract_entity_needs()
│       ├── _match_yp_capability()
│       └── _calculate_prior_probability()
│
├── multi_pass_context.py                 # Phase 2 (650 lines)
│   └── MultiPassContext
│       ├── get_pass_strategy()
│       ├── get_temporal_patterns() [Graphiti]
│       ├── get_graph_context() [FalkorDB]
│       └── _generate_network_hypotheses()
│
├── multi_pass_ralph_loop.py            # Phase 3 (550 lines)
│   └── MultiPassRalphCoordinator
│       ├── run_multi_pass_discovery()
│       ├── _run_single_pass()
│       ├── _generate_next_pass_hypotheses()
│       └── _should_stop_discovery()
│
└── test_multi_pass_integration.py       # Tests (300 lines)
    ├── test_dossier_hypothesis_generation()
    ├── test_multi_pass_context()
    └── test_ralph_loop_validation()
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 14)                                              │
│  ├── Entity browser pages                                           │
│  ├── Opportunity dashboard                                          │
│  └── Multi-pass progress visualization                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Python/FastAPI)                                          │
│  ├── Multi-pass discovery orchestration                            │
│  ├── Ralph Loop validation API (port 8001)                         │
│  ├── Dossier generation service                                     │
│  └── Hypothesis management                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AI LAYER                                                           │
│  ├── Claude Agent SDK (orchestration)                              │
│  ├── Claude Models (Haiku 80%, Sonnet 15%, Opus 5%)              │
│  └── Prompt engineering for hypothesis generation                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                         │
│  ├── FalkorDB (graph relationships)                               │
│  ├── Graphiti (temporal episodes)                                 │
│  ├── Supabase (cache layer, 22 tables)                           │
│  └── BrightData (web scraping SDK)                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  VALIDATION LAYER                                                  │
│  ├── Ralph Loop (3-pass governance)                               │
│  │   ├── Pass 1: Rule-based filtering                             │
│  │   ├── Pass 2: Claude validation                               │
│  │   └── Pass 3: Final confirmation                              │
│  └── Fixed confidence math (no drift)                              │
└─────────────────────────────────────────────────────────────────┘
```
