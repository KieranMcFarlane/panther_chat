# Signal Noise App: End-to-End System Demonstration

**Generated:** 2026-02-19T09:09:05.591518
**Version:** 1.0.0
**Purpose:** Complete system validation across all entity types

---

## Executive Summary

This document demonstrates the complete Signal Noise system functionality
by executing all 6 system steps across three different entity types:

- **Arsenal FC** (SPORT_CLUB)
  - Final Confidence: 0.56
  - Confidence Band: INFORMED
  - Total Signals: 0
  - Estimated Value: $500/entity/month
  - Duration: 87.3s
  - Cost: $0.00

- **International Canoe Federation** (SPORT_FEDERATION)
  - Final Confidence: 0.52
  - Confidence Band: INFORMED
  - Total Signals: 0
  - Estimated Value: $500/entity/month
  - Duration: 35.9s
  - Cost: $0.00

- **Major League Cricket** (SPORT_LEAGUE)
  - Final Confidence: 0.52
  - Confidence Band: INFORMED
  - Total Signals: 0
  - Estimated Value: $500/entity/month
  - Duration: 16.5s
  - Cost: $0.00

- **Fulham FC** (SPORT_CLUB)
  - Final Confidence: 0.50
  - Confidence Band: INFORMED
  - Total Signals: 0
  - Estimated Value: $500/entity/month
  - Duration: 280.4s
  - Cost: $0.00

### Overall Metrics

- **Total Entities Processed:** 4
- **Entity Types Tested:** 
- **Total Steps Executed:** 0
- **Successful Steps:** 24
- **Average Confidence:** 0.53
- **Total Duration:** 420.1 seconds
- **Total Cost:** $0.00

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SIGNAL NOISE SYSTEM FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1: Question-First Dossier     ━━● Generate hypotheses       │
│  STEP 2: Hypothesis-Driven Discovery ━━━━━● Validate via web       │
│  STEP 3: Ralph Loop Validation     ━━━━━━━● 3-pass governance     │
│  STEP 4: Temporal Intelligence     ━━━━━━━━● Pattern analysis      │
│  STEP 5: Narrative Builder         ━━━━━━━━━● Compress context      │
│  STEP 6: Yellow Panther Scoring    ━━━━━━━━━━● Sales positioning    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Confidence Bands (Pricing)

| Band | Range | Meaning | Price |
|------|-------|---------|-------|
| EXPLORATORY | <0.30 | Research phase | $0 |
| INFORMED | 0.30-0.60 | Monitoring | $500/entity/month |
| CONFIDENT | 0.60-0.80 | Sales engaged | $2,000/entity/month |
| ACTIONABLE | >0.80 + gate | Immediate outreach | $5,000/entity/month |

### Decision Types (Internal → External)

| Internal | External | Delta | Meaning |
|----------|----------|-------|---------|
| ACCEPT | Procurement Signal | +0.06 | Strong evidence of procurement intent |
| WEAK_ACCEPT | Capability Signal | +0.02 | Capability present, intent unclear |
| REJECT | No Signal | 0.00 | No evidence or contradicts hypothesis |
| NO_PROGRESS | No Signal | 0.00 | No new information |
| SATURATED | Saturated | 0.00 | Category exhausted |

---

## Entity ARSENAL-FC: Arsenal FC (SPORT_CLUB)

### Summary

- **Entity ID:** arsenal-fc
- **Entity Type:** SPORT_CLUB
- **Started:** 2026-02-19T09:02:05.512956+00:00
- **Completed:** 2026-02-19T09:03:32.766446+00:00
- **Duration:** 87.25 seconds
- **Total Cost:** $0.00
- **Final Confidence:** 0.56
- **Confidence Band:** INFORMED
- **Total Signals:** 0
  - Procurement Signals: 0
  - Capability Signals: 0
- **Estimated Value:** $500/entity/month

### Step 1: Question-First Dossier ✅

**Started:** 2026-02-19T09:02:05.513017+00:00
**Completed:** 2026-02-19T09:02:05.514981+00:00
**Duration:** 1ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: arsenal-fc
  - `entity_name`: Arsenal FC
  - `entity_type`: SPORT_CLUB

**Output:**
  - `questions_count`: 7
  - `hypotheses`: [{'hypothesis_id': 'arsenal-fc_sc_mobile_fan_platform', 'entity_id': 'arsenal-fc', 'entity_name': 'Arsenal FC', 'statement': 'Arsenal FC will issue mobile app RFP (£80K-£300K budget) within 6-18 months', 'category': 'mobile', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_mobile_fan_platform', 'yp_service_fit': ['MOBILE_APPS', 'FAN_ENGAGEMENT'], 'budget_range': '£80K-£300K', 'yp_advantage': 'Team GB Olympic mobile app delivery, STA Award 2024 winner', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Job postings: Mobile Developer, iOS Developer, Product Manager - Mobile', 'RFP keywords: mobile app, fan app, official app, React Native, RFP, Request for Proposal, tender, procurement, EOI, RFI', 'Announcements: Digital transformation initiatives, fan engagement strategy'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Any mention of mobile platform development or fan app in official channels', 'confidence_boost': 0.15}}, {'hypothesis_id': 'arsenal-fc_sc_digital_transformation', 'entity_id': 'arsenal-fc', 'entity_name': 'Arsenal FC', 'statement': 'Arsenal FC is seeking digital transformation partner (£150K-£500K) for modernization project', 'category': 'digital', 'prior_probability': 0.7, 'confidence': 0.7, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_digital_transformation', 'yp_service_fit': ['DIGITAL_TRANSFORMATION'], 'budget_range': '£150K-£500K', 'yp_advantage': '3-year partnership track record (Premier Padel), end-to-end transformation expertise', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Job postings: CTO, CIO, Digital Transformation Manager, Cloud Architect', 'RFP keywords: digital transformation, cloud migration, modernization, RFP, Request for Proposal, tender, ITT, procurement, vendor portal', 'Strategic announcements: Digital modernization, cloud migration, legacy system refresh', 'Partnership announcements: Technology consulting partners'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Mentions of modernization, cloud migration, or technology overhaul initiatives', 'confidence_boost': 0.2}}, {'hypothesis_id': 'arsenal-fc_sc_ticketing_ecommerce', 'entity_id': 'arsenal-fc', 'entity_name': 'Arsenal FC', 'statement': 'Arsenal FC will replace ticketing/e-commerce platform (£80K-£250K) within 12 months', 'category': 'ticketing', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_ticketing_ecommerce', 'yp_service_fit': ['ECOMMERCE', 'FAN_ENGAGEMENT'], 'budget_range': '£80K-£250K', 'yp_advantage': 'BNP Paribas Open ticketing platform experience, high-volume e-commerce delivery', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Fan complaints: Ticketing issues, checkout problems, mobile ticketing', 'Job postings: E-commerce Manager, Head of Ticketing, CRM Manager', 'RFP keywords: ticketing system, e-commerce platform, POS system, RFP, Request for Proposal, tender, RFQ, supplier portal', 'Partnership changes: New ticketing provider partnerships'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Evidence of ticketing issues or job postings for e-commerce roles', 'confidence_boost': 0.15}}, {'hypothesis_id': 'arsenal-fc_sc_analytics_data_platform', 'entity_id': 'arsenal-fc', 'entity_name': 'Arsenal FC', 'statement': 'Arsenal FC will invest in analytics/data platform (£100K-£400K) for performance/fan insights', 'category': 'analytics', 'prior_probability': 0.62, 'confidence': 0.62, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_analytics_data_platform', 'yp_service_fit': ['ANALYTICS'], 'budget_range': '£100K-£400K', 'yp_advantage': 'ISU skating analytics platform, sports analytics expertise', 'positioning_strategy': 'CAPABILITY_PARTNER', 'next_signals': ['Job postings: Data Analyst, Data Engineer, BI Developer, Analytics Manager', 'RFP keywords: analytics platform, BI system, data warehouse, CRM analytics, RFP, Request for Proposal, tender, RFQ', 'Partnerships: Analytics providers, BI platform announcements', 'Strategic mentions: Data-driven decisions, fan insights, performance analytics'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Job postings for analytics roles or data platform announcements', 'confidence_boost': 0.12}}, {'hypothesis_id': 'arsenal-fc_sc_fan_engagement_gaps', 'entity_id': 'arsenal-fc', 'entity_name': 'Arsenal FC', 'statement': 'Arsenal FC will seek fan engagement solution (£80K-£300K) to improve supporter experience', 'category': 'fan', 'prior_probability': 0.6, 'confidence': 0.6, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_fan_engagement_gaps', 'yp_service_fit': ['FAN_ENGAGEMENT', 'MOBILE_APPS'], 'budget_range': '£80K-£300K', 'yp_advantage': 'FIBA 3×3 fan engagement platform, multi-federation experience', 'positioning_strategy': 'INNOVATION_PARTNER', 'next_signals': ['Season ticket holder feedback: Engagement complaints, communication issues', 'Job postings: Fan Engagement Manager, Head of Supporter Services', 'RFP keywords: fan engagement platform, CRM system, loyalty platform, RFP, Request for Proposal, tender, EOI', 'Initiatives: Fan experience programs, loyalty scheme launches'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Fan engagement initiatives or related job postings', 'confidence_boost': 0.1}}, {'hypothesis_id': 'arsenal-fc_sc_stadium_technology', 'entity_id': 'arsenal-fc', 'entity_name': 'Arsenal FC', 'statement': 'Arsenal FC will upgrade stadium technology (£100K-£400K) for matchday experience', 'category': 'stadium', 'prior_probability': 0.62, 'confidence': 0.62, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_stadium_technology', 'yp_service_fit': ['MOBILE_APPS', 'UI_UX_DESIGN', 'ECOMMERCE'], 'budget_range': '£100K-£400K', 'yp_advantage': 'Olympic venue app experience, large-scale deployment capability', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Stadium announcements: WiFi upgrades, mobile ordering, seat upgrades', 'Job postings: Stadium Technology Manager, Venue Operations Director', 'RFP keywords: stadium technology, venue WiFi, mobile ordering, RFP, Request for Proposal, tender, ITT, supplier portal', 'Partnerships: Stadium technology providers, connectivity partners'], 'hop_types': ['RFP_PAGE', 'PRESS_RELEASE', 'CAREERS_PAGE'], 'accept_criteria': 'Stadium technology initiatives or related partnerships', 'confidence_boost': 0.12}}, {'hypothesis_id': 'arsenal-fc_sc_legacy_replacement', 'entity_id': 'arsenal-fc', 'entity_name': 'Arsenal FC', 'statement': 'Arsenal FC will initiate legacy system replacement (£150K-£500K) within 6-12 months', 'category': 'legacy', 'prior_probability': 0.6799999999999999, 'confidence': 0.6799999999999999, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_legacy_replacement', 'yp_service_fit': ['DIGITAL_TRANSFORMATION', 'ANALYTICS'], 'budget_range': '£150K-£500K', 'yp_advantage': 'End-to-end digital transformation, legacy migration expertise', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Partnership changes: Ending vendor relationships', 'Strategic announcements: System modernization, platform migration', 'RFP keywords: system migration, legacy replacement, platform modernization, RFP, Request for Proposal, tender, ITT, RFQ', 'Job postings: Migration specialists, system architects'], 'hop_types': ['RFP_PAGE', 'PRESS_RELEASE', 'CAREERS_PAGE'], 'accept_criteria': 'Evidence of vendor changes or modernization initiatives', 'confidence_boost': 0.18}}]
  - `yp_service_mappings`: [{'question': 'What mobile app or fan engagement platform investments are planned by {entity}?', 'services': ['MOBILE_APPS', 'FAN_ENGAGEMENT']}, {'question': 'What digital transformation initiatives is {entity} undertaking or planning?', 'services': ['DIGITAL_TRANSFORMATION']}, {'question': 'What ticketing or e-commerce pain points indicate replacement needs at {entity}?', 'services': ['ECOMMERCE', 'FAN_ENGAGEMENT']}, {'question': 'What analytics or data platform needs does {entity} have for performance or fan insights?', 'services': ['ANALYTICS']}, {'question': 'What fan engagement strategy gaps or opportunities exist at {entity}?', 'services': ['FAN_ENGAGEMENT', 'MOBILE_APPS']}, {'question': 'What stadium or venue technology upgrades is {entity} planning?', 'services': ['MOBILE_APPS', 'UI_UX_DESIGN', 'ECOMMERCE']}, {'question': 'What legacy system replacement signals is {entity} showing?', 'services': ['DIGITAL_TRANSFORMATION', 'ANALYTICS']}]
  - `budget_ranges`: []
  - `starting_confidence`: 0.55
  - `yp_profile`: {'ideal_budget_range': '£80K-£500K', 'ideal_timeline': '3-12 months', 'team_size': '2-8 developers', 'case_studies': {'team_gb': {'service': 'MOBILE_APPS', 'description': 'Olympic mobile app delivery', 'achievement': 'STA Award 2024 winner', 'budget': '~£300K', 'relevance': 'Shows Olympic-scale delivery capability'}, 'premier_padel': {'service': 'DIGITAL_TRANSFORMATION', 'description': '3-year strategic partnership', 'achievement': 'End-to-end digital transformation', 'budget': '~£500K/year', 'relevance': 'Long-term federation partnership model'}, 'fiba_3x3': {'service': 'FAN_ENGAGEMENT', 'description': 'FIBA 3×3 Basketball platform', 'achievement': 'Multi-federation engagement platform', 'budget': '~£200K', 'relevance': 'Federation member management experience'}, 'isu': {'service': 'ANALYTICS', 'description': 'International Skating Union data platform', 'achievement': 'Sports analytics implementation', 'budget': '~£150K', 'relevance': 'International federation analytics'}, 'lnb': {'service': 'MOBILE_APPS', 'description': 'Ligue Nationale de Basket mobile platform', 'achievement': 'French basketball federation app', 'budget': '~£250K', 'relevance': 'Federation-wide mobile deployment'}, 'bnpp_paribas': {'service': 'ECOMMERCE', 'description': 'BNP Paribas Open ticketing platform', 'achievement': 'Major event e-commerce delivery', 'budget': '~£200K', 'relevance': 'High-volume ticketing/e-commerce'}}, 'competitive_differentiators': ['Wild Creativity × Boundless Technology approach', 'Agile 2-8 developer team structure', 'Proven sports industry experience', 'Multi-federation partnership track record', 'Olympic-scale delivery capability (Team GB)', 'End-to-end digital transformation expertise']}

**Details:**

Step 1: Question-First Dossier Generation

Entity: Arsenal FC (arsenal-fc)
Type: SPORT_CLUB

Generated 7 questions:

1. What mobile app or fan engagement platform investments are planned by {entity}?...
2. What digital transformation initiatives is {entity} undertaking or planning?...
3. What ticketing or e-commerce pain points indicate replacement needs at {entity}?...
4. What analytics or data platform needs does {entity} have for performance or fan insights?...
5. What fan engagement strategy gaps or opportunities exist at {entity}?...
6. What stadium or venue technology upgrades is {entity} planning?...
7. What legacy system replacement signals is {entity} showing?...

YP Service Mappings: 7
Budget Indicators: 0
Starting Confidence: 0.55

YP Profile Services: ['team_gb', 'premier_padel', 'fiba_3x3', 'isu', 'lnb', 'bnpp_paribas']


**Logs:**

  - Importing entity_type_dossier_questions module...
  - Generating questions for entity type: SPORT_CLUB
  - Generated 7 questions
  - Generated 7 hypotheses
  - Question-first dossier generation completed successfully

### Step 2: Hypothesis-Driven Discovery ✅

**Started:** 2026-02-19T09:02:05.515551+00:00
**Completed:** 2026-02-19T09:03:32.516211+00:00
**Duration:** 87000ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: arsenal-fc
  - `entity_name`: Arsenal FC
  - `entity_type`: SPORT_CLUB
  - `hypotheses_count`: 7
  - `max_iterations`: 10

**Output:**
  - `final_confidence`: 0.56
  - `iterations_completed`: 2
  - `validated_signals`: [{'id': 'arsenal-fc_design_20260219090331_0', 'type': 'TECHNOLOGY_ADOPTED', 'subtype': None, 'confidence': 0.52, 'evidence_count': 1, 'first_seen': '2026-02-19T09:03:31.839181+00:00', 'entity_id': 'arsenal-fc', 'metadata': {'hypothesis_id': 'arsenal-fc_ui/ux_design_project', 'hypothesis_statement': 'Arsenal FC is preparing procurement related to UI/UX Design Project', 'hypothesis_category': 'design', 'decision': 'WEAK_ACCEPT', 'confidence_delta': 0.02, 'justification': 'The content shows a procurement role (Procurement Manager) at Arsenal FC, indicating general procurement capability but no specific UI/UX project intent.', 'hop_type': 'rfp_page', 'source_url': 'https://uk.linkedin.com/in/isaac-ainsworth-358a0b1a1', 'entity_name': 'Arsenal FC', 'yp_service_fit': [], 'budget_range': '', 'positioning_strategy': ''}, 'evidence': [{'id': 'arsenal-fc_design_20260219090331_0_evidence_0', 'source': 'https://uk.linkedin.com/in/isaac-ainsworth-358a0b1a1', 'url': 'https://uk.linkedin.com/in/isaac-ainsworth-358a0b1a1', 'content': 'Currently working as a Procurement Manager at Arsenal Football Club', 'confidence': 0.52, 'collected_at': '2026-02-19T09:03:31.839148+00:00'}]}]
  - `total_cost_usd`: 0.002
  - `hops_executed`: {'1': 1, '2': 2}
  - `confidence_progression`: []
  - `decisions`: []

**Details:**

Step 2: Hypothesis-Driven Discovery

Entity: Arsenal FC
Template: yellow_panther_agency
Iterations: 2
Max Depth: 3

Final Confidence: 0.56
Total Cost: $0.0020

Validated Signals: 1
Raw Signal Objects: 1

  - TECHNOLOGY_ADOPTED: 0.52

Hypotheses Generated: 10

Depth Statistics:
  Depth 1: 1 iterations
  Depth 2: 2 iterations


**Logs:**

  - Importing hypothesis_driven_discovery module...
  - Initializing HypothesisDrivenDiscovery...
  - Running discovery for Arsenal FC (max 10 iterations)...
  - Discovery completed: 2 iterations
  - Hypothesis-driven discovery completed successfully

### Step 3: Ralph Loop Validation ✅

**Started:** 2026-02-19T09:03:32.518081+00:00
**Completed:** 2026-02-19T09:03:32.518390+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: arsenal-fc
  - `entity_name`: Arsenal FC
  - `entity_type`: SPORT_CLUB
  - `signals_count`: 1

**Output:**
  - `pass_1_results`: [{'signal_id': 'arsenal-fc_design_20260219090331_0', 'decision': 'REJECT', 'reason': 'Insufficient evidence: 1 < 3'}]
  - `pass_2_results`: [{'signal_id': 'arsenal-fc_design_20260219090331_0', 'decision': 'REJECT', 'confidence': 0.52}]
  - `pass_3_results`: [{'signal_id': 'arsenal-fc_design_20260219090331_0', 'decision': 'REJECT', 'reason': 'Confidence too low: 0.52'}]
  - `validated_signals`: []
  - `rejected_count`: 1
  - `validation_rate`: 0.0

**Details:**

Step 3: Ralph Loop Validation

Entity: Arsenal FC
Signals Processed: 1

Pass 1 (Rule-based Filtering): 1 results
  - ACCEPT: 0
  - WEAK_ACCEPT: 0
  - REJECT: 1

Pass 2 (Claude Validation): 1 results
  - Signals forwarded to Pass 3: 0

Pass 3 (Final Confirmation): 1 results
  - Validated: 0
  - Rejected: 1

Validated Signals: 0
Rejected: 1
Validation Rate: 0.0%


**Logs:**

  - Running Ralph Loop validation for 1 signals...
  - Validation complete: 0/1 signals validated
  - Ralph Loop validation completed successfully

### Step 4: Temporal Intelligence ✅

**Started:** 2026-02-19T09:03:32.519432+00:00
**Completed:** 2026-02-19T09:03:32.681005+00:00
**Duration:** 161ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: arsenal-fc
  - `entity_name`: Arsenal FC
  - `entity_type`: SPORT_CLUB

**Output:**
  - `timeline_episodes`: 4
  - `time_span_days`: 0
  - `patterns_detected`: []
  - `episode_types`: {'OTHER': 4}
  - `similar_entities`: []
  - `temporal_fit_score`: 0.5

**Details:**

Step 4: Temporal Intelligence Analysis

Entity: Arsenal FC
Timeline Episodes: 4
Time Span: 0 days

Patterns Detected:

Episode Types:
  - OTHER: 4

Temporal Fit Score: 0.50
  (Based on RFP history, timeline depth, and pattern diversity)

**Logs:**

  - Fetching entity timeline from Graphiti...
  - Retrieved 4 timeline episodes
  - Temporal analysis complete: fit_score=0.50
  - Temporal intelligence analysis completed successfully

### Step 5: Narrative Builder ✅

**Started:** 2026-02-19T09:03:32.681645+00:00
**Completed:** 2026-02-19T09:03:32.756316+00:00
**Duration:** 74ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: arsenal-fc
  - `entity_name`: Arsenal FC
  - `entity_type`: SPORT_CLUB
  - `max_tokens`: 2000

**Output:**
  - `narrative`: # Temporal Narrative (4 episodes: 2026-01-18T22:08:30.853128+00:00 to 2026-02-19T09:03:31.840519+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run found 1 signal(s). Final confidence: 0.56. Signals: TECHNOLOGY_ADOPTED
- **2026-02-19** (Unknown): Discovery run completed with 7 iterations. Final confidence: 0.50. No signals detected.
- **2026-01-18** (Unknown): Request for AI-powered analytics
- **2026-01-18** (Unknown): Digital Transformation RFP

  - `episode_count`: 4
  - `total_episodes`: 4
  - `estimated_tokens`: 115
  - `truncated`: False

**Details:**

Step 5: Narrative Builder

Entity: Arsenal FC
Episodes Available: 4
Episodes Included: 4
Estimated Tokens: 115
Truncated: False

Narrative Preview (first 500 chars):
# Temporal Narrative (4 episodes: 2026-01-18T22:08:30.853128+00:00 to 2026-02-19T09:03:31.840519+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run found 1 signal(s). Final confidence: 0.56. Signals: TECHNOLOGY_ADOPTED
- **2026-02-19** (Unknown): Discovery run completed with 7 iterations. Final confidence: 0.50. No signals detected.
- **2026-01-18** (Unknown): Request for AI-powered analytics
- **2026-01-18** (Unknown): Digital Transformation RFP
...


**Logs:**

  - Fetching episodes for narrative building...
  - Retrieved 4 episodes
  - Narrative built: 115 tokens
  - Narrative builder completed successfully

### Step 6: Yellow Panther Scoring ✅

**Started:** 2026-02-19T09:03:32.757080+00:00
**Completed:** 2026-02-19T09:03:32.766049+00:00
**Duration:** 8ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: arsenal-fc
  - `entity_name`: Arsenal FC
  - `entity_type`: SPORT_CLUB
  - `signals_count`: 0
  - `temporal_fit`: 0.5

**Output:**
  - `fit_score`: 35.0
  - `priority`: TIER_4
  - `budget_alignment`: MARGINAL
  - `service_alignment`: []
  - `positioning_strategy`: Position based on signal type and entity
  - `recommendations`: ['Monitor for additional signals', 'Add to watch list for future opportunities']
  - `scoring_breakdown`: {'service_match': 0.0, 'budget': 12.5, 'timeline': 7.5, 'entity_size': 8.0, 'geographic': 7.0}

**Details:**

Step 6: Yellow Panther Fit Scoring

Entity: Arsenal FC
Entity Type: SPORT_CLUB

YP Fit Score: 35.0/100
Priority Tier: PriorityTier.TIER_4
Budget Alignment: BudgetAlignment.MARGINAL

Service Alignment:

Recommendations:
  - Monitor for additional signals
  - Add to watch list for future opportunities

Scoring Breakdown:
  - service_match: 0.0 points
  - budget: 12.5 points
  - timeline: 7.5 points
  - entity_size: 8.0 points
  - geographic: 7.0 points


**Logs:**

  - Importing yellow_panther_scorer module...
  - Scoring entity against YP profile...
  - YP Fit Score: 35.0/100
  - Priority: PriorityTier.TIER_4
  - Yellow Panther scoring completed successfully

### Sales Recommendations

- {'text': 'Monitor for additional signals'}
- {'text': 'Add to watch list for future opportunities'}


---

## Entity ICF: International Canoe Federation (SPORT_FEDERATION)

### Summary

- **Entity ID:** icf
- **Entity Type:** SPORT_FEDERATION
- **Started:** 2026-02-19T09:03:32.766460+00:00
- **Completed:** 2026-02-19T09:04:08.646880+00:00
- **Duration:** 35.88 seconds
- **Total Cost:** $0.00
- **Final Confidence:** 0.52
- **Confidence Band:** INFORMED
- **Total Signals:** 0
  - Procurement Signals: 0
  - Capability Signals: 0
- **Estimated Value:** $500/entity/month

### Step 1: Question-First Dossier ✅

**Started:** 2026-02-19T09:03:32.766501+00:00
**Completed:** 2026-02-19T09:03:32.766651+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: icf
  - `entity_name`: International Canoe Federation
  - `entity_type`: SPORT_FEDERATION

**Output:**
  - `questions_count`: 6
  - `hypotheses`: [{'hypothesis_id': 'icf_sf_member_platform', 'entity_id': 'icf', 'entity_name': 'International Canoe Federation', 'statement': 'International Canoe Federation will seek member database/platform RFP (£150K-£500K) for federation management', 'category': 'member', 'prior_probability': 0.6799999999999999, 'confidence': 0.6799999999999999, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sf_member_platform', 'yp_service_fit': ['MOBILE_APPS', 'DIGITAL_TRANSFORMATION'], 'budget_range': '£150K-£500K', 'yp_advantage': 'Multi-federation partnerships (FIBA 3×3, ISU, LNB), Olympic scalability (170+ federations)', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Job postings: CRM Manager, Member Services Director, Digital Platform Manager', 'RFP keywords: member database, federation platform, CRM system, RFP, Request for Proposal, tender, EOI, ITT, procurement', 'Announcements: Strategic plan mentions, digital initiative announcements'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Any mention of member system modernization or digital platform', 'confidence_boost': 0.18}}, {'hypothesis_id': 'icf_sf_officiating_tech', 'entity_id': 'icf', 'entity_name': 'International Canoe Federation', 'statement': 'International Canoe Federation will issue AI officiating/platform RFP (£200K-£500K) before next major event', 'category': 'officiating', 'prior_probability': 0.7, 'confidence': 0.7, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sf_officiating_tech', 'yp_service_fit': ['ANALYTICS', 'MOBILE_APPS'], 'budget_range': '£200K-£500K', 'yp_advantage': 'International federation experience (ISU officiating platform), event tech delivery', 'positioning_strategy': 'INNOVATION_PARTNER', 'next_signals': ['Job postings: Officiating Technology Manager, Event Technology Director', 'RFP keywords: officiating system, VAR, video referee, AI officiating, RFP, Request for Proposal, tender, ITT, procurement', 'Event announcements: Technology trials, officiating system upgrades', 'Partnerships: Technology providers for officiating/VAR systems'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Job postings or announcements about officiating technology', 'confidence_boost': 0.2}}, {'hypothesis_id': 'icf_sf_certification_modernization', 'entity_id': 'icf', 'entity_name': 'International Canoe Federation', 'statement': 'International Canoe Federation will seek digital certification platform (£100K-£300K) for assessment modernization', 'category': 'certification', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sf_certification_modernization', 'yp_service_fit': ['DIGITAL_TRANSFORMATION', 'UI_UX_DESIGN'], 'budget_range': '£100K-£300K', 'yp_advantage': 'Federation certification platform experience, multi-language capability', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Job postings: Certification Manager, Assessment System Lead', 'Initiatives: Digital assessment programs, online certification launches', 'RFP keywords: certification system, assessment platform, digital testing, RFP, Request for Proposal, tender, RFQ, EOI'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'OFFICIAL_SITE'], 'accept_criteria': 'Digital certification or assessment system initiatives', 'confidence_boost': 0.15}}, {'hypothesis_id': 'icf_sf_event_management', 'entity_id': 'icf', 'entity_name': 'International Canoe Federation', 'statement': 'International Canoe Federation will seek event management platform (£100K-£400K) for championship operations', 'category': 'event', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sf_event_management', 'yp_service_fit': ['ECOMMERCE', 'MOBILE_APPS'], 'budget_range': '£100K-£400K', 'yp_advantage': 'Major event platform delivery (Olympic-scale), multi-event management', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Job postings: Event Technology Manager, Championship Operations Lead', 'RFP keywords: event management, championship platform, competition system, RFP, Request for Proposal, tender, ITT, procurement', 'Event announcements: New event formats, digital ticketing for events', 'Partnerships: Event technology providers'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Event management technology initiatives or partnerships', 'confidence_boost': 0.15}}, {'hypothesis_id': 'icf_sf_member_communication', 'entity_id': 'icf', 'entity_name': 'International Canoe Federation', 'statement': 'International Canoe Federation will implement member communication platform (£80K-£250K) for federation engagement', 'category': 'member', 'prior_probability': 0.62, 'confidence': 0.62, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sf_member_communication', 'yp_service_fit': ['FAN_ENGAGEMENT', 'MOBILE_APPS'], 'budget_range': '£80K-£250K', 'yp_advantage': 'FIBA 3×3 member engagement platform, federation communication tools', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Job postings: Communication Manager, Member Engagement Lead', 'RFP keywords: member communication, federation portal, engagement platform, RFP, Request for Proposal, tender, EOI, ITT', 'Initiatives: Member portal launches, communication strategy updates', 'Platform announcements: Member apps, communication tools'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Member communication or engagement platform initiatives', 'confidence_boost': 0.12}}, {'hypothesis_id': 'icf_sf_analytics_platform', 'entity_id': 'icf', 'entity_name': 'International Canoe Federation', 'statement': 'International Canoe Federation will invest in federation analytics platform (£150K-£400K) for member insights', 'category': 'analytics', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sf_analytics_platform', 'yp_service_fit': ['ANALYTICS'], 'budget_range': '£150K-£400K', 'yp_advantage': 'ISU analytics platform, international federation data systems', 'positioning_strategy': 'CAPABILITY_PARTNER', 'next_signals': ['Job postings: Data Analyst, Analytics Manager, Performance Data Lead', 'RFP keywords: analytics platform, data warehouse, federation BI, RFP, Request for Proposal, tender, RFQ, ITT', 'Strategic mentions: Data-driven member support, performance insights', 'Partnerships: Analytics platform providers'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Analytics platform initiatives or related job postings', 'confidence_boost': 0.15}}]
  - `yp_service_mappings`: [{'question': 'What member federation management platform or mobile app initiatives are underway at {entity}?', 'services': ['MOBILE_APPS', 'DIGITAL_TRANSFORMATION']}, {'question': 'What officiating or technology projects is {entity} planning for major events?', 'services': ['ANALYTICS', 'MOBILE_APPS']}, {'question': 'What digital certification or assessment systems is {entity} modernizing?', 'services': ['DIGITAL_TRANSFORMATION', 'UI_UX_DESIGN']}, {'question': 'What event management platform needs does {entity} have for competitions/championships?', 'services': ['ECOMMERCE', 'MOBILE_APPS']}, {'question': 'What digital member communication or engagement platforms is {entity} implementing?', 'services': ['FAN_ENGAGEMENT', 'MOBILE_APPS']}, {'question': 'What analytics or performance data platform is {entity} seeking for member federations?', 'services': ['ANALYTICS']}]
  - `budget_ranges`: []
  - `starting_confidence`: 0.6
  - `yp_profile`: {'ideal_budget_range': '£80K-£500K', 'ideal_timeline': '3-12 months', 'team_size': '2-8 developers', 'case_studies': {'team_gb': {'service': 'MOBILE_APPS', 'description': 'Olympic mobile app delivery', 'achievement': 'STA Award 2024 winner', 'budget': '~£300K', 'relevance': 'Shows Olympic-scale delivery capability'}, 'premier_padel': {'service': 'DIGITAL_TRANSFORMATION', 'description': '3-year strategic partnership', 'achievement': 'End-to-end digital transformation', 'budget': '~£500K/year', 'relevance': 'Long-term federation partnership model'}, 'fiba_3x3': {'service': 'FAN_ENGAGEMENT', 'description': 'FIBA 3×3 Basketball platform', 'achievement': 'Multi-federation engagement platform', 'budget': '~£200K', 'relevance': 'Federation member management experience'}, 'isu': {'service': 'ANALYTICS', 'description': 'International Skating Union data platform', 'achievement': 'Sports analytics implementation', 'budget': '~£150K', 'relevance': 'International federation analytics'}, 'lnb': {'service': 'MOBILE_APPS', 'description': 'Ligue Nationale de Basket mobile platform', 'achievement': 'French basketball federation app', 'budget': '~£250K', 'relevance': 'Federation-wide mobile deployment'}, 'bnpp_paribas': {'service': 'ECOMMERCE', 'description': 'BNP Paribas Open ticketing platform', 'achievement': 'Major event e-commerce delivery', 'budget': '~£200K', 'relevance': 'High-volume ticketing/e-commerce'}}, 'competitive_differentiators': ['Wild Creativity × Boundless Technology approach', 'Agile 2-8 developer team structure', 'Proven sports industry experience', 'Multi-federation partnership track record', 'Olympic-scale delivery capability (Team GB)', 'End-to-end digital transformation expertise']}

**Details:**

Step 1: Question-First Dossier Generation

Entity: International Canoe Federation (icf)
Type: SPORT_FEDERATION

Generated 6 questions:

1. What member federation management platform or mobile app initiatives are underway at {entity}?...
2. What officiating or technology projects is {entity} planning for major events?...
3. What digital certification or assessment systems is {entity} modernizing?...
4. What event management platform needs does {entity} have for competitions/championships?...
5. What digital member communication or engagement platforms is {entity} implementing?...
6. What analytics or performance data platform is {entity} seeking for member federations?...

YP Service Mappings: 6
Budget Indicators: 0
Starting Confidence: 0.60

YP Profile Services: ['team_gb', 'premier_padel', 'fiba_3x3', 'isu', 'lnb', 'bnpp_paribas']


**Logs:**

  - Importing entity_type_dossier_questions module...
  - Generating questions for entity type: SPORT_FEDERATION
  - Generated 6 questions
  - Generated 6 hypotheses
  - Question-first dossier generation completed successfully

### Step 2: Hypothesis-Driven Discovery ✅

**Started:** 2026-02-19T09:03:32.767407+00:00
**Completed:** 2026-02-19T09:04:08.389135+00:00
**Duration:** 35621ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: icf
  - `entity_name`: International Canoe Federation
  - `entity_type`: SPORT_FEDERATION
  - `hypotheses_count`: 6
  - `max_iterations`: 10

**Output:**
  - `final_confidence`: 0.52
  - `iterations_completed`: 2
  - `validated_signals`: [{'id': 'icf_design_20260219090408_0', 'type': 'TECHNOLOGY_ADOPTED', 'subtype': None, 'confidence': 0.56, 'evidence_count': 1, 'first_seen': '2026-02-19T09:04:08.204675+00:00', 'entity_id': 'icf', 'metadata': {'hypothesis_id': 'icf_ui/ux_design_project', 'hypothesis_statement': 'International Canoe Federation is preparing procurement related to UI/UX Design Project', 'hypothesis_category': 'design', 'decision': 'ACCEPT', 'confidence_delta': 0.06, 'justification': 'The content contains an active RFP for an OTT platform development project issued by ICF, which includes UI/UX design requirements as part of the end-to-end solution. This is a direct and explicit procurement signal.', 'hop_type': 'rfp_page', 'source_url': 'https://www.canoeicf.com/sites/default/files/rfp_-_icf_ott_platform_2026.pdf', 'entity_name': 'International Canoe Federation', 'yp_service_fit': [], 'budget_range': '', 'positioning_strategy': ''}, 'evidence': [{'id': 'icf_design_20260219090408_0_evidence_0', 'source': 'https://www.canoeicf.com/sites/default/files/rfp_-_icf_ott_platform_2026.pdf', 'url': 'https://www.canoeicf.com/sites/default/files/rfp_-_icf_ott_platform_2026.pdf', 'content': 'REQUEST FOR PROPOSAL (RFP): ICF OTT Platform Development...This RFP seeks proposals from qualified OTT technology providers to design, develop, launch, and operate this platform.', 'confidence': 0.56, 'collected_at': '2026-02-19T09:04:08.204583+00:00'}]}, {'id': 'icf_data engineering_20260219090408_1', 'type': 'TECHNOLOGY_ADOPTED', 'subtype': None, 'confidence': 0.52, 'evidence_count': 1, 'first_seen': '2026-02-19T09:04:08.205039+00:00', 'entity_id': 'icf', 'metadata': {'hypothesis_id': 'icf_python_data_processing_project', 'hypothesis_statement': 'International Canoe Federation is preparing procurement related to Python Data Processing Project', 'hypothesis_category': 'data engineering', 'decision': 'WEAK_ACCEPT', 'confidence_delta': 0.02, 'justification': 'The document contains an active RFP for an OTT platform development project issued by ICF, indicating a clear procurement intent. However, the RFP is focused on OTT platform development rather than a Python Data Processing Project specifically. While the platform may involve data processing capabilities, the primary scope is video streaming and content monetization, not the data engineering patterns mentioned in the hypothesis.', 'hop_type': 'rfp_page', 'source_url': 'https://www.canoeicf.com/sites/default/files/rfp_-_icf_ott_platform_2026.pdf', 'entity_name': 'International Canoe Federation', 'yp_service_fit': [], 'budget_range': '', 'positioning_strategy': ''}, 'evidence': [{'id': 'icf_data engineering_20260219090408_1_evidence_0', 'source': 'https://www.canoeicf.com/sites/default/files/rfp_-_icf_ott_platform_2026.pdf', 'url': 'https://www.canoeicf.com/sites/default/files/rfp_-_icf_ott_platform_2026.pdf', 'content': 'REQUEST FOR PROPOSAL (RFP): ICF OTT Platform Development\nIssued by: International Canoe Federation (ICF)\nDate of Issue: 1st December 2025. Deadline for Submissions: 13th January 2026', 'confidence': 0.52, 'collected_at': '2026-02-19T09:04:08.205006+00:00'}]}]
  - `total_cost_usd`: 0.002
  - `hops_executed`: {'1': 1, '2': 1}
  - `confidence_progression`: []
  - `decisions`: []

**Details:**

Step 2: Hypothesis-Driven Discovery

Entity: International Canoe Federation
Template: yellow_panther_agency
Iterations: 2
Max Depth: 3

Final Confidence: 0.52
Total Cost: $0.0020

Validated Signals: 2
Raw Signal Objects: 2

  - TECHNOLOGY_ADOPTED: 0.56
  - TECHNOLOGY_ADOPTED: 0.52

Hypotheses Generated: 10

Depth Statistics:
  Depth 1: 1 iterations
  Depth 2: 1 iterations


**Logs:**

  - Importing hypothesis_driven_discovery module...
  - Initializing HypothesisDrivenDiscovery...
  - Running discovery for International Canoe Federation (max 10 iterations)...
  - Discovery completed: 2 iterations
  - Hypothesis-driven discovery completed successfully

### Step 3: Ralph Loop Validation ✅

**Started:** 2026-02-19T09:04:08.391227+00:00
**Completed:** 2026-02-19T09:04:08.391648+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: icf
  - `entity_name`: International Canoe Federation
  - `entity_type`: SPORT_FEDERATION
  - `signals_count`: 2

**Output:**
  - `pass_1_results`: [{'signal_id': 'icf_design_20260219090408_0', 'decision': 'REJECT', 'reason': 'Insufficient evidence: 1 < 3'}, {'signal_id': 'icf_data engineering_20260219090408_1', 'decision': 'REJECT', 'reason': 'Insufficient evidence: 1 < 3'}]
  - `pass_2_results`: [{'signal_id': 'icf_design_20260219090408_0', 'decision': 'REJECT', 'confidence': 0.56}, {'signal_id': 'icf_data engineering_20260219090408_1', 'decision': 'REJECT', 'confidence': 0.52}]
  - `pass_3_results`: [{'signal_id': 'icf_design_20260219090408_0', 'decision': 'REJECT', 'reason': 'Confidence too low: 0.56'}, {'signal_id': 'icf_data engineering_20260219090408_1', 'decision': 'REJECT', 'reason': 'Confidence too low: 0.52'}]
  - `validated_signals`: []
  - `rejected_count`: 2
  - `validation_rate`: 0.0

**Details:**

Step 3: Ralph Loop Validation

Entity: International Canoe Federation
Signals Processed: 2

Pass 1 (Rule-based Filtering): 2 results
  - ACCEPT: 0
  - WEAK_ACCEPT: 0
  - REJECT: 2

Pass 2 (Claude Validation): 2 results
  - Signals forwarded to Pass 3: 0

Pass 3 (Final Confirmation): 2 results
  - Validated: 0
  - Rejected: 2

Validated Signals: 0
Rejected: 2
Validation Rate: 0.0%


**Logs:**

  - Running Ralph Loop validation for 2 signals...
  - Validation complete: 0/2 signals validated
  - Ralph Loop validation completed successfully

### Step 4: Temporal Intelligence ✅

**Started:** 2026-02-19T09:04:08.392628+00:00
**Completed:** 2026-02-19T09:04:08.593822+00:00
**Duration:** 201ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: icf
  - `entity_name`: International Canoe Federation
  - `entity_type`: SPORT_FEDERATION

**Output:**
  - `timeline_episodes`: 2
  - `time_span_days`: 0
  - `patterns_detected`: []
  - `episode_types`: {'OTHER': 2}
  - `similar_entities`: []
  - `temporal_fit_score`: 0.5

**Details:**

Step 4: Temporal Intelligence Analysis

Entity: International Canoe Federation
Timeline Episodes: 2
Time Span: 0 days

Patterns Detected:

Episode Types:
  - OTHER: 2

Temporal Fit Score: 0.50
  (Based on RFP history, timeline depth, and pattern diversity)

**Logs:**

  - Fetching entity timeline from Graphiti...
  - Retrieved 2 timeline episodes
  - Temporal analysis complete: fit_score=0.50
  - Temporal intelligence analysis completed successfully

### Step 5: Narrative Builder ✅

**Started:** 2026-02-19T09:04:08.595826+00:00
**Completed:** 2026-02-19T09:04:08.641590+00:00
**Duration:** 45ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: icf
  - `entity_name`: International Canoe Federation
  - `entity_type`: SPORT_FEDERATION
  - `max_tokens`: 2000

**Output:**
  - `narrative`: # Temporal Narrative (2 episodes: 2026-02-19T08:58:00.661865+00:00 to 2026-02-19T09:04:08.205687+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...
- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...

  - `episode_count`: 2
  - `total_episodes`: 2
  - `estimated_tokens`: 93
  - `truncated`: False

**Details:**

Step 5: Narrative Builder

Entity: International Canoe Federation
Episodes Available: 2
Episodes Included: 2
Estimated Tokens: 93
Truncated: False

Narrative Preview (first 500 chars):
# Temporal Narrative (2 episodes: 2026-02-19T08:58:00.661865+00:00 to 2026-02-19T09:04:08.205687+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...
- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...
...


**Logs:**

  - Fetching episodes for narrative building...
  - Retrieved 2 episodes
  - Narrative built: 93 tokens
  - Narrative builder completed successfully

### Step 6: Yellow Panther Scoring ✅

**Started:** 2026-02-19T09:04:08.642550+00:00
**Completed:** 2026-02-19T09:04:08.644861+00:00
**Duration:** 2ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: icf
  - `entity_name`: International Canoe Federation
  - `entity_type`: SPORT_FEDERATION
  - `signals_count`: 0
  - `temporal_fit`: 0.5

**Output:**
  - `fit_score`: 35.0
  - `priority`: TIER_4
  - `budget_alignment`: MARGINAL
  - `service_alignment`: []
  - `positioning_strategy`: Position based on signal type and entity
  - `recommendations`: ['Monitor for additional signals', 'Add to watch list for future opportunities']
  - `scoring_breakdown`: {'service_match': 0.0, 'budget': 12.5, 'timeline': 7.5, 'entity_size': 8.0, 'geographic': 7.0}

**Details:**

Step 6: Yellow Panther Fit Scoring

Entity: International Canoe Federation
Entity Type: SPORT_FEDERATION

YP Fit Score: 35.0/100
Priority Tier: PriorityTier.TIER_4
Budget Alignment: BudgetAlignment.MARGINAL

Service Alignment:

Recommendations:
  - Monitor for additional signals
  - Add to watch list for future opportunities

Scoring Breakdown:
  - service_match: 0.0 points
  - budget: 12.5 points
  - timeline: 7.5 points
  - entity_size: 8.0 points
  - geographic: 7.0 points


**Logs:**

  - Importing yellow_panther_scorer module...
  - Scoring entity against YP profile...
  - YP Fit Score: 35.0/100
  - Priority: PriorityTier.TIER_4
  - Yellow Panther scoring completed successfully

### Sales Recommendations

- {'text': 'Monitor for additional signals'}
- {'text': 'Add to watch list for future opportunities'}


---

## Entity MLC: Major League Cricket (SPORT_LEAGUE)

### Summary

- **Entity ID:** mlc
- **Entity Type:** SPORT_LEAGUE
- **Started:** 2026-02-19T09:04:08.646952+00:00
- **Completed:** 2026-02-19T09:04:25.159974+00:00
- **Duration:** 16.51 seconds
- **Total Cost:** $0.00
- **Final Confidence:** 0.52
- **Confidence Band:** INFORMED
- **Total Signals:** 0
  - Procurement Signals: 0
  - Capability Signals: 0
- **Estimated Value:** $500/entity/month

### Step 1: Question-First Dossier ✅

**Started:** 2026-02-19T09:04:08.647131+00:00
**Completed:** 2026-02-19T09:04:08.647656+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: mlc
  - `entity_name`: Major League Cricket
  - `entity_type`: SPORT_LEAGUE

**Output:**
  - `questions_count`: 5
  - `hypotheses`: [{'hypothesis_id': 'mlc_sl_league_mobile_app', 'entity_id': 'mlc', 'entity_name': 'Major League Cricket', 'statement': 'Major League Cricket will develop league-wide mobile platform (£200K-£500K) for fan engagement', 'category': 'league', 'prior_probability': 0.7, 'confidence': 0.7, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sl_league_mobile_app', 'yp_service_fit': ['MOBILE_APPS', 'FAN_ENGAGEMENT'], 'budget_range': '£200K-£500K', 'yp_advantage': 'Olympic mobile app experience, multi-club deployment capability', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Job postings: Mobile Product Manager, League Digital Director', 'RFP keywords: mobile app, league platform, fan app, React Native, RFP, Request for Proposal, tender, ITT, EOI, procurement', 'League announcements: Mobile strategy, digital fan experience', 'Club initiatives: Coordinated mobile efforts across clubs'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'League-wide mobile or digital platform announcements', 'confidence_boost': 0.2}}, {'hypothesis_id': 'mlc_sl_digital_operations', 'entity_id': 'mlc', 'entity_name': 'Major League Cricket', 'statement': 'Major League Cricket will seek digital operations transformation (£200K-£500K) for league efficiency', 'category': 'digital', 'prior_probability': 0.6799999999999999, 'confidence': 0.6799999999999999, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sl_digital_operations', 'yp_service_fit': ['DIGITAL_TRANSFORMATION'], 'budget_range': '£200K-£500K', 'yp_advantage': 'Premier Padel 3-year transformation model, league operations expertise', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Job postings: League Operations Director, Digital Transformation Lead', 'RFP keywords: digital transformation, CRM system, data warehouse, RFP, Request for Proposal, tender, ITT, procurement', 'Strategic announcements: Operations modernization, digital league management', 'Club mandates: Digital requirements for member clubs'], 'hop_types': ['CAREERS_PAGE', 'PRESS_RELEASE', 'RFP_PAGE'], 'accept_criteria': 'League operations modernization initiatives', 'confidence_boost': 0.18}}, {'hypothesis_id': 'mlc_sl_centralized_analytics', 'entity_id': 'mlc', 'entity_name': 'Major League Cricket', 'statement': 'Major League Cricket will invest in centralized analytics platform (£150K-£400K) for league-wide insights', 'category': 'centralized', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sl_centralized_analytics', 'yp_service_fit': ['ANALYTICS'], 'budget_range': '£150K-£400K', 'yp_advantage': 'ISU federation analytics, multi-club data platform experience', 'positioning_strategy': 'CAPABILITY_PARTNER', 'next_signals': ['Job postings: Head of Analytics, Data Platform Manager', 'RFP keywords: analytics platform, data warehouse, league BI, centralized data, RFP, Request for Proposal, tender, RFQ, ITT', 'League initiatives: Data sharing, analytics for member clubs', 'Partnerships: Analytics platform providers'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Centralized analytics or data platform initiatives', 'confidence_boost': 0.15}}, {'hypothesis_id': 'mlc_sl_ecommerce_platform', 'entity_id': 'mlc', 'entity_name': 'Major League Cricket', 'statement': 'Major League Cricket will create unified e-commerce platform (£150K-£400K) for league merchandise/ticketing', 'category': 'ecommerce', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sl_ecommerce_platform', 'yp_service_fit': ['ECOMMERCE'], 'budget_range': '£150K-£400K', 'yp_advantage': 'BNP Paribas Open ticketing experience, league-wide commerce', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Job postings: E-commerce Director, Head of League Commerce', 'RFP keywords: e-commerce platform, ticketing system, league merchandise, RFP, Request for Proposal, tender, RFQ, ITT, supplier portal', 'League announcements: Unified shopping, league ticketing platform', 'Club alignment: Standardized e-commerce across clubs'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'League-wide e-commerce or ticketing initiatives', 'confidence_boost': 0.15}}, {'hypothesis_id': 'mlc_sl_broadcast_streaming', 'entity_id': 'mlc', 'entity_name': 'Major League Cricket', 'statement': 'Major League Cricket will enhance broadcast/streaming platform (£200K-£500K) for digital content', 'category': 'broadcast', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sl_broadcast_streaming', 'yp_service_fit': ['MOBILE_APPS', 'UI_UX_DESIGN'], 'budget_range': '£200K-£500K', 'yp_advantage': 'Streaming platform experience, mobile video delivery', 'positioning_strategy': 'INNOVATION_PARTNER', 'next_signals': ['Job postings: Streaming Product Manager, Digital Content Lead', 'RFP keywords: streaming platform, OTT, video delivery, broadcast, RFP, Request for Proposal, tender, ITT, media procurement', 'Media announcements: OTT platform, direct-to-consumer streaming', 'Partnerships: Streaming technology providers'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Streaming or broadcast platform initiatives', 'confidence_boost': 0.15}}]
  - `yp_service_mappings`: [{'question': 'What league-wide mobile app or digital platform initiatives is {entity} pursuing?', 'services': ['MOBILE_APPS', 'FAN_ENGAGEMENT']}, {'question': 'What digital transformation of league operations is {entity} undertaking?', 'services': ['DIGITAL_TRANSFORMATION']}, {'question': 'What centralized analytics or data platform is {entity} building for league and clubs?', 'services': ['ANALYTICS']}, {'question': 'What league-wide e-commerce or ticketing platform is {entity} developing?', 'services': ['ECOMMERCE']}, {'question': 'What broadcast or streaming enhancements is {entity} planning for content distribution?', 'services': ['MOBILE_APPS', 'UI_UX_DESIGN']}]
  - `budget_ranges`: []
  - `starting_confidence`: 0.5
  - `yp_profile`: {'ideal_budget_range': '£80K-£500K', 'ideal_timeline': '3-12 months', 'team_size': '2-8 developers', 'case_studies': {'team_gb': {'service': 'MOBILE_APPS', 'description': 'Olympic mobile app delivery', 'achievement': 'STA Award 2024 winner', 'budget': '~£300K', 'relevance': 'Shows Olympic-scale delivery capability'}, 'premier_padel': {'service': 'DIGITAL_TRANSFORMATION', 'description': '3-year strategic partnership', 'achievement': 'End-to-end digital transformation', 'budget': '~£500K/year', 'relevance': 'Long-term federation partnership model'}, 'fiba_3x3': {'service': 'FAN_ENGAGEMENT', 'description': 'FIBA 3×3 Basketball platform', 'achievement': 'Multi-federation engagement platform', 'budget': '~£200K', 'relevance': 'Federation member management experience'}, 'isu': {'service': 'ANALYTICS', 'description': 'International Skating Union data platform', 'achievement': 'Sports analytics implementation', 'budget': '~£150K', 'relevance': 'International federation analytics'}, 'lnb': {'service': 'MOBILE_APPS', 'description': 'Ligue Nationale de Basket mobile platform', 'achievement': 'French basketball federation app', 'budget': '~£250K', 'relevance': 'Federation-wide mobile deployment'}, 'bnpp_paribas': {'service': 'ECOMMERCE', 'description': 'BNP Paribas Open ticketing platform', 'achievement': 'Major event e-commerce delivery', 'budget': '~£200K', 'relevance': 'High-volume ticketing/e-commerce'}}, 'competitive_differentiators': ['Wild Creativity × Boundless Technology approach', 'Agile 2-8 developer team structure', 'Proven sports industry experience', 'Multi-federation partnership track record', 'Olympic-scale delivery capability (Team GB)', 'End-to-end digital transformation expertise']}

**Details:**

Step 1: Question-First Dossier Generation

Entity: Major League Cricket (mlc)
Type: SPORT_LEAGUE

Generated 5 questions:

1. What league-wide mobile app or digital platform initiatives is {entity} pursuing?...
2. What digital transformation of league operations is {entity} undertaking?...
3. What centralized analytics or data platform is {entity} building for league and clubs?...
4. What league-wide e-commerce or ticketing platform is {entity} developing?...
5. What broadcast or streaming enhancements is {entity} planning for content distribution?...

YP Service Mappings: 5
Budget Indicators: 0
Starting Confidence: 0.50

YP Profile Services: ['team_gb', 'premier_padel', 'fiba_3x3', 'isu', 'lnb', 'bnpp_paribas']


**Logs:**

  - Importing entity_type_dossier_questions module...
  - Generating questions for entity type: SPORT_LEAGUE
  - Generated 5 questions
  - Generated 5 hypotheses
  - Question-first dossier generation completed successfully

### Step 2: Hypothesis-Driven Discovery ✅

**Started:** 2026-02-19T09:04:08.649714+00:00
**Completed:** 2026-02-19T09:04:24.766278+00:00
**Duration:** 16116ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: mlc
  - `entity_name`: Major League Cricket
  - `entity_type`: SPORT_LEAGUE
  - `hypotheses_count`: 5
  - `max_iterations`: 10

**Output:**
  - `final_confidence`: 0.52
  - `iterations_completed`: 2
  - `validated_signals`: [{'id': 'mlc_design_20260219090424_0', 'type': 'TECHNOLOGY_ADOPTED', 'subtype': None, 'confidence': 0.56, 'evidence_count': 1, 'first_seen': '2026-02-19T09:04:24.465575+00:00', 'entity_id': 'mlc', 'metadata': {'hypothesis_id': 'mlc_ui/ux_design_project', 'hypothesis_statement': 'Major League Cricket is preparing procurement related to UI/UX Design Project', 'hypothesis_category': 'design', 'decision': 'ACCEPT', 'confidence_delta': 0.06, 'justification': 'The content provides a clear, active RFP for a Digital Transformation Project from American Cricket Enterprises, which is directly related to the UI/UX Design Project hypothesis. This meets the HIGH CONFIDENCE criteria for an active procurement signal.', 'hop_type': 'rfp_page', 'source_url': 'https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6', 'entity_name': 'Major League Cricket', 'yp_service_fit': [], 'budget_range': '', 'positioning_strategy': ''}, 'evidence': [{'id': 'mlc_design_20260219090424_0_evidence_0', 'source': 'https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6', 'url': 'https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6', 'content': 'American Cricket Enterprises has issued an RFP for a Digital Transformation Project. This solution will improve the fan experience, optimize commercial opportunities and integrate with existing and new systems for ticketing, merchandise, email marketing, and more whilst also maintaining compliance with relevant data protection and privacy laws. Proposals due on 10 October, 2025.', 'confidence': 0.56, 'collected_at': '2026-02-19T09:04:24.465567+00:00'}]}, {'id': 'mlc_data engineering_20260219090424_1', 'type': 'TECHNOLOGY_ADOPTED', 'subtype': None, 'confidence': 0.52, 'evidence_count': 1, 'first_seen': '2026-02-19T09:04:24.465682+00:00', 'entity_id': 'mlc', 'metadata': {'hypothesis_id': 'mlc_python_data_processing_project', 'hypothesis_statement': 'Major League Cricket is preparing procurement related to Python Data Processing Project', 'hypothesis_category': 'data engineering', 'decision': 'WEAK_ACCEPT', 'confidence_delta': 0.02, 'justification': "The content describes an active RFP for a 'Digital Transformation Project' that includes data processing, analytics, and integration with marketing systems. While this indicates a general digital maturity and technology investment (WEAK_ACCEPT criteria), it does not explicitly mention Python data processing, ETL pipelines, or specific data engineering procurement. The RFP is current and open, meeting temporal requirements.", 'hop_type': 'rfp_page', 'source_url': 'https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6', 'entity_name': 'Major League Cricket', 'yp_service_fit': [], 'budget_range': '', 'positioning_strategy': ''}, 'evidence': [{'id': 'mlc_data engineering_20260219090424_1_evidence_0', 'source': 'https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6', 'url': 'https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6', 'content': 'This solution will improve the fan experience, optimize commercial opportunities and integrate with existing and new systems for ticketing, merchandise, email marketing, and more whilst also maintaining compliance with relevant data protection and privacy laws.', 'confidence': 0.52, 'collected_at': '2026-02-19T09:04:24.465676+00:00'}]}]
  - `total_cost_usd`: 0.002
  - `hops_executed`: {'1': 1, '2': 1}
  - `confidence_progression`: []
  - `decisions`: []

**Details:**

Step 2: Hypothesis-Driven Discovery

Entity: Major League Cricket
Template: yellow_panther_agency
Iterations: 2
Max Depth: 3

Final Confidence: 0.52
Total Cost: $0.0020

Validated Signals: 2
Raw Signal Objects: 2

  - TECHNOLOGY_ADOPTED: 0.56
  - TECHNOLOGY_ADOPTED: 0.52

Hypotheses Generated: 10

Depth Statistics:
  Depth 1: 1 iterations
  Depth 2: 1 iterations


**Logs:**

  - Importing hypothesis_driven_discovery module...
  - Initializing HypothesisDrivenDiscovery...
  - Running discovery for Major League Cricket (max 10 iterations)...
  - Discovery completed: 2 iterations
  - Hypothesis-driven discovery completed successfully

### Step 3: Ralph Loop Validation ✅

**Started:** 2026-02-19T09:04:24.769377+00:00
**Completed:** 2026-02-19T09:04:24.769582+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: mlc
  - `entity_name`: Major League Cricket
  - `entity_type`: SPORT_LEAGUE
  - `signals_count`: 2

**Output:**
  - `pass_1_results`: [{'signal_id': 'mlc_design_20260219090424_0', 'decision': 'REJECT', 'reason': 'Insufficient evidence: 1 < 3'}, {'signal_id': 'mlc_data engineering_20260219090424_1', 'decision': 'REJECT', 'reason': 'Insufficient evidence: 1 < 3'}]
  - `pass_2_results`: [{'signal_id': 'mlc_design_20260219090424_0', 'decision': 'REJECT', 'confidence': 0.56}, {'signal_id': 'mlc_data engineering_20260219090424_1', 'decision': 'REJECT', 'confidence': 0.52}]
  - `pass_3_results`: [{'signal_id': 'mlc_design_20260219090424_0', 'decision': 'REJECT', 'reason': 'Confidence too low: 0.56'}, {'signal_id': 'mlc_data engineering_20260219090424_1', 'decision': 'REJECT', 'reason': 'Confidence too low: 0.52'}]
  - `validated_signals`: []
  - `rejected_count`: 2
  - `validation_rate`: 0.0

**Details:**

Step 3: Ralph Loop Validation

Entity: Major League Cricket
Signals Processed: 2

Pass 1 (Rule-based Filtering): 2 results
  - ACCEPT: 0
  - WEAK_ACCEPT: 0
  - REJECT: 2

Pass 2 (Claude Validation): 2 results
  - Signals forwarded to Pass 3: 0

Pass 3 (Final Confirmation): 2 results
  - Validated: 0
  - Rejected: 2

Validated Signals: 0
Rejected: 2
Validation Rate: 0.0%


**Logs:**

  - Running Ralph Loop validation for 2 signals...
  - Validation complete: 0/2 signals validated
  - Ralph Loop validation completed successfully

### Step 4: Temporal Intelligence ✅

**Started:** 2026-02-19T09:04:24.770346+00:00
**Completed:** 2026-02-19T09:04:25.109455+00:00
**Duration:** 339ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: mlc
  - `entity_name`: Major League Cricket
  - `entity_type`: SPORT_LEAGUE

**Output:**
  - `timeline_episodes`: 2
  - `time_span_days`: 0
  - `patterns_detected`: []
  - `episode_types`: {'OTHER': 2}
  - `similar_entities`: []
  - `temporal_fit_score`: 0.5

**Details:**

Step 4: Temporal Intelligence Analysis

Entity: Major League Cricket
Timeline Episodes: 2
Time Span: 0 days

Patterns Detected:

Episode Types:
  - OTHER: 2

Temporal Fit Score: 0.50
  (Based on RFP history, timeline depth, and pattern diversity)

**Logs:**

  - Fetching entity timeline from Graphiti...
  - Retrieved 2 timeline episodes
  - Temporal analysis complete: fit_score=0.50
  - Temporal intelligence analysis completed successfully

### Step 5: Narrative Builder ✅

**Started:** 2026-02-19T09:04:25.110004+00:00
**Completed:** 2026-02-19T09:04:25.158692+00:00
**Duration:** 48ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: mlc
  - `entity_name`: Major League Cricket
  - `entity_type`: SPORT_LEAGUE
  - `max_tokens`: 2000

**Output:**
  - `narrative`: # Temporal Narrative (2 episodes: 2026-02-19T08:58:17.209157+00:00 to 2026-02-19T09:04:24.465965+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...
- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...

  - `episode_count`: 2
  - `total_episodes`: 2
  - `estimated_tokens`: 93
  - `truncated`: False

**Details:**

Step 5: Narrative Builder

Entity: Major League Cricket
Episodes Available: 2
Episodes Included: 2
Estimated Tokens: 93
Truncated: False

Narrative Preview (first 500 chars):
# Temporal Narrative (2 episodes: 2026-02-19T08:58:17.209157+00:00 to 2026-02-19T09:04:24.465965+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...
- **2026-02-19** (Unknown): Discovery run found 2 signal(s). Final confidence: 0.52. Signals: TECHNOLOGY_ADOPTED, TECHNOLOGY_...
...


**Logs:**

  - Fetching episodes for narrative building...
  - Retrieved 2 episodes
  - Narrative built: 93 tokens
  - Narrative builder completed successfully

### Step 6: Yellow Panther Scoring ✅

**Started:** 2026-02-19T09:04:25.159458+00:00
**Completed:** 2026-02-19T09:04:25.159636+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: mlc
  - `entity_name`: Major League Cricket
  - `entity_type`: SPORT_LEAGUE
  - `signals_count`: 0
  - `temporal_fit`: 0.5

**Output:**
  - `fit_score`: 35.0
  - `priority`: TIER_4
  - `budget_alignment`: MARGINAL
  - `service_alignment`: []
  - `positioning_strategy`: Position based on signal type and entity
  - `recommendations`: ['Monitor for additional signals', 'Add to watch list for future opportunities']
  - `scoring_breakdown`: {'service_match': 0.0, 'budget': 12.5, 'timeline': 7.5, 'entity_size': 8.0, 'geographic': 7.0}

**Details:**

Step 6: Yellow Panther Fit Scoring

Entity: Major League Cricket
Entity Type: SPORT_LEAGUE

YP Fit Score: 35.0/100
Priority Tier: PriorityTier.TIER_4
Budget Alignment: BudgetAlignment.MARGINAL

Service Alignment:

Recommendations:
  - Monitor for additional signals
  - Add to watch list for future opportunities

Scoring Breakdown:
  - service_match: 0.0 points
  - budget: 12.5 points
  - timeline: 7.5 points
  - entity_size: 8.0 points
  - geographic: 7.0 points


**Logs:**

  - Importing yellow_panther_scorer module...
  - Scoring entity against YP profile...
  - YP Fit Score: 35.0/100
  - Priority: PriorityTier.TIER_4
  - Yellow Panther scoring completed successfully

### Sales Recommendations

- {'text': 'Monitor for additional signals'}
- {'text': 'Add to watch list for future opportunities'}


---

## Entity FULHAM-FC: Fulham FC (SPORT_CLUB)

### Summary

- **Entity ID:** fulham-fc
- **Entity Type:** SPORT_CLUB
- **Started:** 2026-02-19T09:04:25.159997+00:00
- **Completed:** 2026-02-19T09:09:05.590977+00:00
- **Duration:** 280.43 seconds
- **Total Cost:** $0.00
- **Final Confidence:** 0.50
- **Confidence Band:** INFORMED
- **Total Signals:** 0
  - Procurement Signals: 0
  - Capability Signals: 0
- **Estimated Value:** $500/entity/month

### Step 1: Question-First Dossier ✅

**Started:** 2026-02-19T09:04:25.160028+00:00
**Completed:** 2026-02-19T09:04:25.160193+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: fulham-fc
  - `entity_name`: Fulham FC
  - `entity_type`: SPORT_CLUB

**Output:**
  - `questions_count`: 7
  - `hypotheses`: [{'hypothesis_id': 'fulham-fc_sc_mobile_fan_platform', 'entity_id': 'fulham-fc', 'entity_name': 'Fulham FC', 'statement': 'Fulham FC will issue mobile app RFP (£80K-£300K budget) within 6-18 months', 'category': 'mobile', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_mobile_fan_platform', 'yp_service_fit': ['MOBILE_APPS', 'FAN_ENGAGEMENT'], 'budget_range': '£80K-£300K', 'yp_advantage': 'Team GB Olympic mobile app delivery, STA Award 2024 winner', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Job postings: Mobile Developer, iOS Developer, Product Manager - Mobile', 'RFP keywords: mobile app, fan app, official app, React Native, RFP, Request for Proposal, tender, procurement, EOI, RFI', 'Announcements: Digital transformation initiatives, fan engagement strategy'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Any mention of mobile platform development or fan app in official channels', 'confidence_boost': 0.15}}, {'hypothesis_id': 'fulham-fc_sc_digital_transformation', 'entity_id': 'fulham-fc', 'entity_name': 'Fulham FC', 'statement': 'Fulham FC is seeking digital transformation partner (£150K-£500K) for modernization project', 'category': 'digital', 'prior_probability': 0.7, 'confidence': 0.7, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_digital_transformation', 'yp_service_fit': ['DIGITAL_TRANSFORMATION'], 'budget_range': '£150K-£500K', 'yp_advantage': '3-year partnership track record (Premier Padel), end-to-end transformation expertise', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Job postings: CTO, CIO, Digital Transformation Manager, Cloud Architect', 'RFP keywords: digital transformation, cloud migration, modernization, RFP, Request for Proposal, tender, ITT, procurement, vendor portal', 'Strategic announcements: Digital modernization, cloud migration, legacy system refresh', 'Partnership announcements: Technology consulting partners'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Mentions of modernization, cloud migration, or technology overhaul initiatives', 'confidence_boost': 0.2}}, {'hypothesis_id': 'fulham-fc_sc_ticketing_ecommerce', 'entity_id': 'fulham-fc', 'entity_name': 'Fulham FC', 'statement': 'Fulham FC will replace ticketing/e-commerce platform (£80K-£250K) within 12 months', 'category': 'ticketing', 'prior_probability': 0.65, 'confidence': 0.65, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_ticketing_ecommerce', 'yp_service_fit': ['ECOMMERCE', 'FAN_ENGAGEMENT'], 'budget_range': '£80K-£250K', 'yp_advantage': 'BNP Paribas Open ticketing platform experience, high-volume e-commerce delivery', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Fan complaints: Ticketing issues, checkout problems, mobile ticketing', 'Job postings: E-commerce Manager, Head of Ticketing, CRM Manager', 'RFP keywords: ticketing system, e-commerce platform, POS system, RFP, Request for Proposal, tender, RFQ, supplier portal', 'Partnership changes: New ticketing provider partnerships'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE'], 'accept_criteria': 'Evidence of ticketing issues or job postings for e-commerce roles', 'confidence_boost': 0.15}}, {'hypothesis_id': 'fulham-fc_sc_analytics_data_platform', 'entity_id': 'fulham-fc', 'entity_name': 'Fulham FC', 'statement': 'Fulham FC will invest in analytics/data platform (£100K-£400K) for performance/fan insights', 'category': 'analytics', 'prior_probability': 0.62, 'confidence': 0.62, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_analytics_data_platform', 'yp_service_fit': ['ANALYTICS'], 'budget_range': '£100K-£400K', 'yp_advantage': 'ISU skating analytics platform, sports analytics expertise', 'positioning_strategy': 'CAPABILITY_PARTNER', 'next_signals': ['Job postings: Data Analyst, Data Engineer, BI Developer, Analytics Manager', 'RFP keywords: analytics platform, BI system, data warehouse, CRM analytics, RFP, Request for Proposal, tender, RFQ', 'Partnerships: Analytics providers, BI platform announcements', 'Strategic mentions: Data-driven decisions, fan insights, performance analytics'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Job postings for analytics roles or data platform announcements', 'confidence_boost': 0.12}}, {'hypothesis_id': 'fulham-fc_sc_fan_engagement_gaps', 'entity_id': 'fulham-fc', 'entity_name': 'Fulham FC', 'statement': 'Fulham FC will seek fan engagement solution (£80K-£300K) to improve supporter experience', 'category': 'fan', 'prior_probability': 0.6, 'confidence': 0.6, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_fan_engagement_gaps', 'yp_service_fit': ['FAN_ENGAGEMENT', 'MOBILE_APPS'], 'budget_range': '£80K-£300K', 'yp_advantage': 'FIBA 3×3 fan engagement platform, multi-federation experience', 'positioning_strategy': 'INNOVATION_PARTNER', 'next_signals': ['Season ticket holder feedback: Engagement complaints, communication issues', 'Job postings: Fan Engagement Manager, Head of Supporter Services', 'RFP keywords: fan engagement platform, CRM system, loyalty platform, RFP, Request for Proposal, tender, EOI', 'Initiatives: Fan experience programs, loyalty scheme launches'], 'hop_types': ['RFP_PAGE', 'CAREERS_PAGE', 'PRESS_RELEASE', 'OFFICIAL_SITE'], 'accept_criteria': 'Fan engagement initiatives or related job postings', 'confidence_boost': 0.1}}, {'hypothesis_id': 'fulham-fc_sc_stadium_technology', 'entity_id': 'fulham-fc', 'entity_name': 'Fulham FC', 'statement': 'Fulham FC will upgrade stadium technology (£100K-£400K) for matchday experience', 'category': 'stadium', 'prior_probability': 0.62, 'confidence': 0.62, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_stadium_technology', 'yp_service_fit': ['MOBILE_APPS', 'UI_UX_DESIGN', 'ECOMMERCE'], 'budget_range': '£100K-£400K', 'yp_advantage': 'Olympic venue app experience, large-scale deployment capability', 'positioning_strategy': 'STRATEGIC_PARTNER', 'next_signals': ['Stadium announcements: WiFi upgrades, mobile ordering, seat upgrades', 'Job postings: Stadium Technology Manager, Venue Operations Director', 'RFP keywords: stadium technology, venue WiFi, mobile ordering, RFP, Request for Proposal, tender, ITT, supplier portal', 'Partnerships: Stadium technology providers, connectivity partners'], 'hop_types': ['RFP_PAGE', 'PRESS_RELEASE', 'CAREERS_PAGE'], 'accept_criteria': 'Stadium technology initiatives or related partnerships', 'confidence_boost': 0.12}}, {'hypothesis_id': 'fulham-fc_sc_legacy_replacement', 'entity_id': 'fulham-fc', 'entity_name': 'Fulham FC', 'statement': 'Fulham FC will initiate legacy system replacement (£150K-£500K) within 6-12 months', 'category': 'legacy', 'prior_probability': 0.6799999999999999, 'confidence': 0.6799999999999999, 'status': 'ACTIVE', 'metadata': {'source': 'entity_type_question_template', 'question_id': 'sc_legacy_replacement', 'yp_service_fit': ['DIGITAL_TRANSFORMATION', 'ANALYTICS'], 'budget_range': '£150K-£500K', 'yp_advantage': 'End-to-end digital transformation, legacy migration expertise', 'positioning_strategy': 'SOLUTION_PROVIDER', 'next_signals': ['Partnership changes: Ending vendor relationships', 'Strategic announcements: System modernization, platform migration', 'RFP keywords: system migration, legacy replacement, platform modernization, RFP, Request for Proposal, tender, ITT, RFQ', 'Job postings: Migration specialists, system architects'], 'hop_types': ['RFP_PAGE', 'PRESS_RELEASE', 'CAREERS_PAGE'], 'accept_criteria': 'Evidence of vendor changes or modernization initiatives', 'confidence_boost': 0.18}}]
  - `yp_service_mappings`: [{'question': 'What mobile app or fan engagement platform investments are planned by {entity}?', 'services': ['MOBILE_APPS', 'FAN_ENGAGEMENT']}, {'question': 'What digital transformation initiatives is {entity} undertaking or planning?', 'services': ['DIGITAL_TRANSFORMATION']}, {'question': 'What ticketing or e-commerce pain points indicate replacement needs at {entity}?', 'services': ['ECOMMERCE', 'FAN_ENGAGEMENT']}, {'question': 'What analytics or data platform needs does {entity} have for performance or fan insights?', 'services': ['ANALYTICS']}, {'question': 'What fan engagement strategy gaps or opportunities exist at {entity}?', 'services': ['FAN_ENGAGEMENT', 'MOBILE_APPS']}, {'question': 'What stadium or venue technology upgrades is {entity} planning?', 'services': ['MOBILE_APPS', 'UI_UX_DESIGN', 'ECOMMERCE']}, {'question': 'What legacy system replacement signals is {entity} showing?', 'services': ['DIGITAL_TRANSFORMATION', 'ANALYTICS']}]
  - `budget_ranges`: []
  - `starting_confidence`: 0.55
  - `yp_profile`: {'ideal_budget_range': '£80K-£500K', 'ideal_timeline': '3-12 months', 'team_size': '2-8 developers', 'case_studies': {'team_gb': {'service': 'MOBILE_APPS', 'description': 'Olympic mobile app delivery', 'achievement': 'STA Award 2024 winner', 'budget': '~£300K', 'relevance': 'Shows Olympic-scale delivery capability'}, 'premier_padel': {'service': 'DIGITAL_TRANSFORMATION', 'description': '3-year strategic partnership', 'achievement': 'End-to-end digital transformation', 'budget': '~£500K/year', 'relevance': 'Long-term federation partnership model'}, 'fiba_3x3': {'service': 'FAN_ENGAGEMENT', 'description': 'FIBA 3×3 Basketball platform', 'achievement': 'Multi-federation engagement platform', 'budget': '~£200K', 'relevance': 'Federation member management experience'}, 'isu': {'service': 'ANALYTICS', 'description': 'International Skating Union data platform', 'achievement': 'Sports analytics implementation', 'budget': '~£150K', 'relevance': 'International federation analytics'}, 'lnb': {'service': 'MOBILE_APPS', 'description': 'Ligue Nationale de Basket mobile platform', 'achievement': 'French basketball federation app', 'budget': '~£250K', 'relevance': 'Federation-wide mobile deployment'}, 'bnpp_paribas': {'service': 'ECOMMERCE', 'description': 'BNP Paribas Open ticketing platform', 'achievement': 'Major event e-commerce delivery', 'budget': '~£200K', 'relevance': 'High-volume ticketing/e-commerce'}}, 'competitive_differentiators': ['Wild Creativity × Boundless Technology approach', 'Agile 2-8 developer team structure', 'Proven sports industry experience', 'Multi-federation partnership track record', 'Olympic-scale delivery capability (Team GB)', 'End-to-end digital transformation expertise']}

**Details:**

Step 1: Question-First Dossier Generation

Entity: Fulham FC (fulham-fc)
Type: SPORT_CLUB

Generated 7 questions:

1. What mobile app or fan engagement platform investments are planned by {entity}?...
2. What digital transformation initiatives is {entity} undertaking or planning?...
3. What ticketing or e-commerce pain points indicate replacement needs at {entity}?...
4. What analytics or data platform needs does {entity} have for performance or fan insights?...
5. What fan engagement strategy gaps or opportunities exist at {entity}?...
6. What stadium or venue technology upgrades is {entity} planning?...
7. What legacy system replacement signals is {entity} showing?...

YP Service Mappings: 7
Budget Indicators: 0
Starting Confidence: 0.55

YP Profile Services: ['team_gb', 'premier_padel', 'fiba_3x3', 'isu', 'lnb', 'bnpp_paribas']


**Logs:**

  - Importing entity_type_dossier_questions module...
  - Generating questions for entity type: SPORT_CLUB
  - Generated 7 questions
  - Generated 7 hypotheses
  - Question-first dossier generation completed successfully

### Step 2: Hypothesis-Driven Discovery ✅

**Started:** 2026-02-19T09:04:25.162151+00:00
**Completed:** 2026-02-19T09:09:05.339173+00:00
**Duration:** 280177ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: fulham-fc
  - `entity_name`: Fulham FC
  - `entity_type`: SPORT_CLUB
  - `hypotheses_count`: 7
  - `max_iterations`: 10

**Output:**
  - `final_confidence`: 0.5
  - `iterations_completed`: 4
  - `validated_signals`: []
  - `total_cost_usd`: 0.004
  - `hops_executed`: {'1': 5, '2': 5}
  - `confidence_progression`: []
  - `decisions`: []

**Details:**

Step 2: Hypothesis-Driven Discovery

Entity: Fulham FC
Template: yellow_panther_agency
Iterations: 4
Max Depth: 3

Final Confidence: 0.50
Total Cost: $0.0040

Validated Signals: 0
Raw Signal Objects: 0


Hypotheses Generated: 10

Depth Statistics:
  Depth 1: 5 iterations
  Depth 2: 5 iterations


**Logs:**

  - Importing hypothesis_driven_discovery module...
  - Initializing HypothesisDrivenDiscovery...
  - Running discovery for Fulham FC (max 10 iterations)...
  - Discovery completed: 4 iterations
  - Hypothesis-driven discovery completed successfully

### Step 3: Ralph Loop Validation ✅

**Started:** 2026-02-19T09:09:05.341605+00:00
**Completed:** 2026-02-19T09:09:05.341727+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: fulham-fc
  - `entity_name`: Fulham FC
  - `entity_type`: SPORT_CLUB
  - `signals_count`: 0

**Output:**
  - `pass_1_results`: []
  - `pass_2_results`: []
  - `pass_3_results`: []
  - `validated_signals`: []
  - `rejected_count`: 0
  - `validation_rate`: 0

**Details:**

Step 3: Ralph Loop Validation

Entity: Fulham FC
Signals Processed: 0

Pass 1 (Rule-based Filtering): 0 results
  - ACCEPT: 0
  - WEAK_ACCEPT: 0
  - REJECT: 0

Pass 2 (Claude Validation): 0 results
  - Signals forwarded to Pass 3: 0

Pass 3 (Final Confirmation): 0 results
  - Validated: 0
  - Rejected: 0

Validated Signals: 0
Rejected: 0
Validation Rate: 0.0%


**Logs:**

  - Running Ralph Loop validation for 0 signals...
  - Validation complete: 0/0 signals validated
  - Ralph Loop validation completed successfully

### Step 4: Temporal Intelligence ✅

**Started:** 2026-02-19T09:09:05.342148+00:00
**Completed:** 2026-02-19T09:09:05.528015+00:00
**Duration:** 185ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: fulham-fc
  - `entity_name`: Fulham FC
  - `entity_type`: SPORT_CLUB

**Output:**
  - `timeline_episodes`: 5
  - `time_span_days`: 0
  - `patterns_detected`: []
  - `episode_types`: {'OTHER': 5}
  - `similar_entities`: []
  - `temporal_fit_score`: 0.5

**Details:**

Step 4: Temporal Intelligence Analysis

Entity: Fulham FC
Timeline Episodes: 5
Time Span: 0 days

Patterns Detected:

Episode Types:
  - OTHER: 5

Temporal Fit Score: 0.50
  (Based on RFP history, timeline depth, and pattern diversity)

**Logs:**

  - Fetching entity timeline from Graphiti...
  - Retrieved 5 timeline episodes
  - Temporal analysis complete: fit_score=0.50
  - Temporal intelligence analysis completed successfully

### Step 5: Narrative Builder ✅

**Started:** 2026-02-19T09:09:05.531974+00:00
**Completed:** 2026-02-19T09:09:05.584398+00:00
**Duration:** 52ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: fulham-fc
  - `entity_name`: Fulham FC
  - `entity_type`: SPORT_CLUB
  - `max_tokens`: 2000

**Output:**
  - `narrative`: # Temporal Narrative (5 episodes: 2026-02-19T03:23:59.444084+00:00 to 2026-02-19T09:09:03.764241+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run completed with 4 iterations. Final confidence: 0.50. No signals detected.
- **2026-02-19** (Unknown): Discovery run completed with 6 iterations. Final confidence: 0.53. No signals detected.
- **2026-02-19** (Unknown): Discovery run completed with 6 iterations. Final confidence: 0.53. No signals detected.
- **2026-02-19** (Unknown): Discovery run completed with 0 iterations. Final confidence: 0.20. No signals detected.
- **2026-02-19** (Unknown): Discovery run completed with 3 iterations. Final confidence: 0.53. No signals detected.

  - `episode_count`: 5
  - `total_episodes`: 5
  - `estimated_tokens`: 173
  - `truncated`: False

**Details:**

Step 5: Narrative Builder

Entity: Fulham FC
Episodes Available: 5
Episodes Included: 5
Estimated Tokens: 173
Truncated: False

Narrative Preview (first 500 chars):
# Temporal Narrative (5 episodes: 2026-02-19T03:23:59.444084+00:00 to 2026-02-19T09:09:03.764241+00:00)

## Other

- **2026-02-19** (Unknown): Discovery run completed with 4 iterations. Final confidence: 0.50. No signals detected.
- **2026-02-19** (Unknown): Discovery run completed with 6 iterations. Final confidence: 0.53. No signals detected.
- **2026-02-19** (Unknown): Discovery run completed with 6 iterations. Final confidence: 0.53. No signals detected.
- **2026-02-19** (Unknown): Discovery...


**Logs:**

  - Fetching episodes for narrative building...
  - Retrieved 5 episodes
  - Narrative built: 173 tokens
  - Narrative builder completed successfully

### Step 6: Yellow Panther Scoring ✅

**Started:** 2026-02-19T09:09:05.585548+00:00
**Completed:** 2026-02-19T09:09:05.586406+00:00
**Duration:** 0ms
**Cost:** $0.00
**Status:** SUCCESS

**Input:**
  - `entity_id`: fulham-fc
  - `entity_name`: Fulham FC
  - `entity_type`: SPORT_CLUB
  - `signals_count`: 0
  - `temporal_fit`: 0.5

**Output:**
  - `fit_score`: 35.0
  - `priority`: TIER_4
  - `budget_alignment`: MARGINAL
  - `service_alignment`: []
  - `positioning_strategy`: Position based on signal type and entity
  - `recommendations`: ['Monitor for additional signals', 'Add to watch list for future opportunities']
  - `scoring_breakdown`: {'service_match': 0.0, 'budget': 12.5, 'timeline': 7.5, 'entity_size': 8.0, 'geographic': 7.0}

**Details:**

Step 6: Yellow Panther Fit Scoring

Entity: Fulham FC
Entity Type: SPORT_CLUB

YP Fit Score: 35.0/100
Priority Tier: PriorityTier.TIER_4
Budget Alignment: BudgetAlignment.MARGINAL

Service Alignment:

Recommendations:
  - Monitor for additional signals
  - Add to watch list for future opportunities

Scoring Breakdown:
  - service_match: 0.0 points
  - budget: 12.5 points
  - timeline: 7.5 points
  - entity_size: 8.0 points
  - geographic: 7.0 points


**Logs:**

  - Importing yellow_panther_scorer module...
  - Scoring entity against YP profile...
  - YP Fit Score: 35.0/100
  - Priority: PriorityTier.TIER_4
  - Yellow Panther scoring completed successfully

### Sales Recommendations

- {'text': 'Monitor for additional signals'}
- {'text': 'Add to watch list for future opportunities'}


---

## Cross-Entity Analysis

### Confidence Comparison

| Entity | Type | Confidence | Band | Signals | Duration | Cost |
|--------|------|------------|------|---------|----------|------|
| Arsenal FC | SPORT_CLUB | 0.56 | INFORMED | 0 | 87.3s | $0.00 |
| International Canoe Federation | SPORT_FEDERATION | 0.52 | INFORMED | 0 | 35.9s | $0.00 |
| Major League Cricket | SPORT_LEAGUE | 0.52 | INFORMED | 0 | 16.5s | $0.00 |
| Fulham FC | SPORT_CLUB | 0.50 | INFORMED | 0 | 280.4s | $0.00 |

### Entity Type Breakdown

#### SPORT_CLUB

- **Count:** 2
- **Avg Confidence:** 0.53
- **Total Signals:** 0
- **Total Cost:** $0.00

#### SPORT_FEDERATION

- **Count:** 1
- **Avg Confidence:** 0.52
- **Total Signals:** 0
- **Total Cost:** $0.00

#### SPORT_LEAGUE

- **Count:** 1
- **Avg Confidence:** 0.52
- **Total Signals:** 0
- **Total Cost:** $0.00

### Scalability Demonstration

The system successfully processed three different entity types without
any manual configuration or template updates:

- ✅ Arsenal FC (SPORT_CLUB) - 0 signals detected
- ✅ International Canoe Federation (SPORT_FEDERATION) - 0 signals detected
- ✅ Major League Cricket (SPORT_LEAGUE) - 0 signals detected
- ✅ Fulham FC (SPORT_CLUB) - 0 signals detected

This demonstrates that the Question-First system scales across all
entity types in the taxonomy using entity-type-specific question templates.

---

## Technical Appendix

### System Components

| Component | File | Purpose |
|-----------|------|---------|
| Question-First Dossier | `entity_type_dossier_questions.py` | Generate hypotheses from entity type |
| Hypothesis-Driven Discovery | `hypothesis_driven_discovery.py` | Single-hop validation via web searches |
| Ralph Loop | `ralph_loop.py` | 3-pass signal validation governance |
| Temporal Intelligence | `graphiti_service.py` | Timeline analysis and pattern recognition |
| Narrative Builder | `narrative_builder.py` | Token-bounded episode compression |
| Yellow Panther Scorer | `yellow_panther_scorer.py` | Fit scoring and positioning |

### Data Flow

```
Entity Name + Type
        │
        ▼
Question-First Dossier → Hypotheses (prior_confidence ~0.50)
        │
        ▼
Hypothesis-Driven Discovery → Validated Signals (confidence 0.00-1.00)
        │
        ▼
Ralph Loop (3-pass) → Governed Signals (>0.7 threshold)
        │
        ▼
Temporal Intelligence → Timeline + Patterns
        │
        ▼
Narrative Builder → Compressed Narrative (max_tokens)
        │
        ▼
Yellow Panther Scoring → Fit Score + Recommendations
```

### External APIs Used

| Service | Purpose | Cost Model |
|---------|---------|------------|
| Anthropic Claude | AI reasoning | Per-token pricing |
| BrightData SDK | Web scraping | Pay-per-success |
| FalkorDB | Graph database | Self-hosted |
| Supabase | Cache layer | Usage-based |

---

## Business Metrics Summary

### Value Demonstration

- **Total System Cost:** $0.00
- **Total Opportunity Value Identified:** £0K
- **ROI Multiple:** 0.0x

### Signal Breakdown

- **Procurement Signals:** 0
  - High-confidence indicators of upcoming RFPs/tenders
- **Capability Signals:** 0
  - Evidence of digital maturity without immediate procurement intent
- **Total Signals:** 0

### Actionable Insights
