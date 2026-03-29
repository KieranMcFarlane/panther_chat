"""
Universal Entity Dossier Prompts for Hypothesis-Driven Discovery

STRATEGIC PURPOSE:
1. Scale across 3,000+ entities with tiered generation
2. Surface procurement/capability signals for RFP detection
3. Provide structured intelligence for AI reasoning + human decision-making
4. Identify Yellow Panther service fit with actionable confidence scores

QUESTION-FIRST REASONING (Updated 2026-02):
- Each dossier question generates a TESTABLE HYPOTHESIS
- Questions vary by entity type (SPORT_CLUB vs SPORT_FEDERATION vs SPORT_LEAGUE)
- Each hypothesis includes validation strategy (next_signals, hop_types)
- Yellow Panther service mapping for opportunity filtering

OUTPUT STRUCTURE:
- Designed to feed directly into hypothesis generation
- Each section includes: signals, confidence, recommendations, next_steps
- Metadata tags for filtering and prioritization
- YP service fit tags for each opportunity
"""

from typing import Dict, List, Any, Optional, Literal
from datetime import datetime
import json

# Yellow Panther Service Context (imported from entity_type_dossier_questions)
YELLOW_PANTHER_SERVICE_CONTEXT = """
YELLOW PANTHER SERVICES & CAPABILITIES:

Service Categories:
- MOBILE_APPS: iOS/Android, React Native, Flutter, native apps, fan apps
  Budget: £80K-£300K | Timeline: 3-6 months
  Case Studies: Team GB (Olympic app, STA Award 2024), LNB (French basketball)

- DIGITAL_TRANSFORMATION: Modernization, cloud migration, legacy system upgrades
  Budget: £150K-£500K | Timeline: 6-12 months
  Case Study: Premier Padel (3-year strategic partnership)

- FAN_ENGAGEMENT: Fan platforms, supporter experience, fan communication
  Budget: £80K-£300K | Timeline: 3-6 months
  Case Studies: FIBA 3×3, ISU

- ANALYTICS: Data platforms, BI, reporting, sports analytics
  Budget: £100K-£400K | Timeline: 3-9 months
  Case Study: ISU (International Skating Union analytics platform)

- ECOMMERCE: Ticketing, merchandise, retail platforms, hospitality
  Budget: £80K-£250K | Timeline: 3-6 months
  Case Study: BNP Paribas Open (ticketing platform)

- UI_UX_DESIGN: User experience, website redesign, app design
  Budget: £50K-£200K | Timeline: 2-4 months

Ideal Project Profile: £80K-£500K budget, 3-12 months timeline, 2-8 developers

Positioning Strategies (Signal-Based):
1. SOLUTION_PROVIDER: For RFP signals - respond to specific procurement needs
2. STRATEGIC_PARTNER: For digital initiatives - advisory relationship
3. CAPABILITY_PARTNER: For hiring signals - tool timing, scale with team
4. INNOVATION_PARTNER: For partnership seeking - co-creation mode
5. TRUSTED_ADVISOR: For mutual connections - referral mode

Competitive Differentiators:
- Olympic mobile app delivery (Team GB)
- STA Award 2024 winner for mobile innovation
- 3-year partnership track record (Premier Padel)
- Multi-federation experience (FIBA 3×3, ISU, LNB)
- Wild Creativity × Boundless Technology approach
- Agile 2-8 developer team structure
"""

ENTITY_TYPE_QUESTION_CONTEXT = """
QUESTION-FIRST REASONING - By Entity Type:

SPORT_CLUB Questions (7):
1. Mobile app/fan platform investments? → MOBILE_APPS, FAN_ENGAGEMENT
2. Digital transformation initiatives? → DIGITAL_TRANSFORMATION
3. Ticketing/e-commerce pain points? → ECOMMERCE
4. Analytics/data platform needs? → ANALYTICS
5. Fan engagement strategy gaps? → FAN_ENGAGEMENT
6. Stadium/venue technology upgrades? → MOBILE_APPS, UI_UX
7. Legacy system replacement signals? → DIGITAL_TRANSFORMATION

SPORT_FEDERATION Questions (6):
1. Member federation platform/app? → MOBILE_APPS, DIGITAL_TRANSFORMATION
2. Officiating/tech for major events? → ANALYTICS, MOBILE_APPS
3. Certification system modernization? → DIGITAL_TRANSFORMATION
4. Event management platform needs? → ECOMMERCE, FAN_ENGAGEMENT
5. Digital member communication? → FAN_ENGAGEMENT, MOBILE_APPS
6. Analytics/performance data platform? → ANALYTICS

SPORT_LEAGUE Questions (5):
1. League-wide mobile app? → MOBILE_APPS, FAN_ENGAGEMENT
2. Digital transformation of operations? → DIGITAL_TRANSFORMATION
3. Centralized analytics platform? → ANALYTICS
4. E-commerce/ticketing platform? → ECOMMERCE
5. Broadcast/streaming enhancements? → MOBILE_APPS, UI_UX

HYPOTHESIS GENERATION FROM QUESTIONS:
Each question should produce:
- Statement: "{entity} will seek [solution] by [date]"
- YP Service Fit: [MOBILE_APPS/DIGITAL_TRANSFORMATION/etc]
- Budget Range: £XX-£XXX
- Validation: What signals to detect (job titles, RFP keywords)
- Hop Types: RFP_PAGE, CAREERS_PAGE, PRESS_RELEASE
- Accept Criteria: What constitutes strong evidence
"""

CONTACT_VALIDATION_RULES = """
CONTACT DATA VALIDATION (CRITICAL):

REQUIREMENTS FOR VALID CONTACTS:
- Real names only (NO placeholders like {FEDERATION PRESIDENT})
- Specific titles (e.g., "Commercial Director" not "Director")
- Contact URLs (LinkedIn, email)
- Decision-making scope (what they control)

INVALID CONTACT EXAMPLES (DO NOT USE):
- "{FEDERATION PRESIDENT}"
- "{TECHNOLOGY DIRECTOR}"
- "Director" (too generic)
- "Manager" without qualifier

VALID CONTACT EXAMPLES:
- "Juliet Slot - Commercial Director"
- "Edu Gaspar - Technical Director"
- "Tim Lewis - Head of Digital"
- "Sarah Jenkins - CRM Manager"

VALIDATION PROCESS:
1. Check for placeholder tokens ({ }, [ ])
2. Verify title specificity (needs qualifier)
3. Require LinkedIn URL or email
4. Confirm decision-making scope
"""


# =============================================================================
# SCORE CONTEXT TEMPLATE
# =============================================================================

SCORE_CONTEXT_TEMPLATE = """
When providing scores, ALWAYS include:

1. **The Score**: Numeric value (0-100)
2. **What It Means**: Plain English explanation
3. **Why This Score**: Evidence-based reasoning
4. **Comparison**: Industry benchmark or context
5. **What To Do**: Actionable next step

Example format:
"Digital Maturity: 72/100 (High)
- **Meaning**: This entity has advanced digital capabilities with integrated systems
- **Why**: Recent CRM platform announcement, active social media, job postings for data analysts
- **Benchmark**: Above industry average (most clubs: 55-65)
- **Action**: Position Yellow Panther as strategic partner for next-phase optimization, not foundational implementation"

CRITICAL: Every score in the dossier MUST include these 4 elements.
"""


# =============================================================================
# OUTREACH STRATEGY PROMPT TEMPLATE
# =============================================================================

OUTREACH_STRATEGY_PROMPT = """
Generate outreach strategy with conversation trees for {entity_name}.

AVAILABLE DATA:
- Official Site Content: {official_site_summary}
- Recent Job Postings: {job_postings_summary}
- Press Releases: {press_releases_summary}
- Leadership Analysis: {leadership_data}
- Digital Maturity: {digital_maturity_score}
- Hypotheses: {hypotheses_data}

OUTPUT STRUCTURE:
{{
  "connection_intelligence": {{
    "approach_type": "warm|lukewarm|cold",
    "mutual_connections": ["names if available"],
    "conversation_starters": [
      {{
        "topic": "specific topic",
        "relevance": "why this matters",
        "talking_points": ["point 1", "point 2"],
        "risk_level": "low|medium|high"
      }}
    ],
    "current_providers": [
      {{
        "provider": "company name",
        "service": "what they provide",
        "satisfaction_indicators": "signs of satisfaction or friction",
        "replacement_opportunity": "why Yellow Panther could replace"
      }}
    ]
  }},
  "conversation_trees": [
    {{
      "scenario": "specific outreach scenario (e.g., 'Digital Transformation Discovery')",
      "opening_message": {{
        "subject_line": "email subject",
        "body": "opening message text",
        "personalization_tokens": ["{{recent_initiative}}", "{{specific_technology}}"],
        "expected_response_rate": "estimated %"
      }},
      "response_branches": [
        {{
          "response_type": "interested|neutral|negative|questioning",
          "probability": 0-100,
          "follow_up_strategy": {{
            "message": "follow-up text",
            "timing": "when to send",
            "channel": "email|linkedin|phone",
            "goal": "what this achieves"
          }}
        }}
      ],
      "depth": 3,
      "success_criteria": "what constitutes successful engagement",
      "anti_patterns": ["mistakes to avoid"]
    }}
  ],
  "recommended_approach": {{
    "primary_channel": "email|linkedin|warm_intro|phone",
    "messaging_angle": "how to frame Yellow Panther value",
    "timing": "when to reach out",
    "confidence": 0-100,
    "confidence_explanation": "why we're confident this approach will work",
    "next_actions": ["step 1", "step 2", "step 3"]
  }}
}}

RULES:
1. Each conversation tree must have 2-4 response branches
2. Include specific examples from scraped data (job postings, press releases)
3. Provide context for all scores (meaning, why, benchmark, action)
4. Flag anti-patterns (generic language, aggressive timing, etc.)
5. Make messages conversational, not salesy
"""


# =============================================================================
# CORE DOSSIER PROMPTS
# =============================================================================

# Use format placeholders that will be filled during prompt generation
UNIVERSAL_CLUB_DOSSIER_PROMPT_TEMPLATE = """
You are a business intelligence analyst generating entity dossiers for an automated RFP discovery system.

YELLOW_PANTHER_SERVICE_CONTEXT:
{YELLOW_PANTHER_SERVICE_CONTEXT}

ENTITY_TYPE_QUESTION_CONTEXT:
{ENTITY_TYPE_QUESTION_CONTEXT}

CONTACT_VALIDATION_RULES:
{CONTACT_VALIDATION_RULES}

TARGET ENTITY:
Name: {name}
Type: {type}
Industry: {industry}
Current Data: {current_data}

OBJECTIVE:
Generate a comprehensive dossier that identifies:
1. PROCUREMENT SIGNALS: Indicators of upcoming purchasing decisions
2. CAPABILITY SIGNALS: Technology gaps and digital maturity levels
3. TIMING SIGNALS: Contract windows, strategic cycles, budget availability
4. CONTACT SIGNALS: Decision makers, influence mapping, optimal introduction paths

QUESTION-FIRST REASONING APPROACH:
For each entity type, answer the specific questions listed above to generate
testable hypotheses. Each question should produce:

HYPOTHESIS OUTPUT FORMAT:
{{
  "statement": "{entity} will seek [solution] by [date]",
  "confidence": 0.50-0.70,
  "signal_type": "[PROCUREMENT]|[CAPABILITY]|[TIMING]|[CONTACT]",
  "yp_service_fit": ["MOBILE_APPS", "DIGITAL_TRANSFORMATION", etc],
  "budget_range": "£XX-£XXX",
  "positioning_strategy": "SOLUTION_PROVIDER|STRATEGIC_PARTNER|etc",
  "validation_strategy": {{
    "next_signals": ["Job postings: Mobile Developer", "RFP keywords: mobile app"],
    "hop_types": ["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
    "accept_criteria": "What constitutes strong evidence"
  }}
}}

CRITICAL REQUIREMENTS:
- DO NOT copy example content literally
- Generate entity-specific analysis using ONLY the provided entity data
- Use "unknown" when specific information is unavailable (NOT placeholders)
- Use REAL contact names only (reject {FEDERATION PRESIDENT} style placeholders)
- Assign confidence scores (0-100) to all assertions WITH explanations
- For EVERY score, include: meaning, why, benchmark, action (see SCORE_CONTEXT_TEMPLATE)
- Tag each insight with signal type: [PROCUREMENT] [CAPABILITY] [TIMING] [CONTACT]
- Tag each opportunity with YP service fit: MOBILE_APPS, DIGITAL_TRANSFORMATION, etc
- Include positioning strategy for each opportunity: SOLUTION_PROVIDER, STRATEGIC_PARTNER, etc

OUTPUT STRUCTURE:
{{
  "metadata": {{
    "entity_id": "{name}",
    "generated_at": "timestamp",
    "data_freshness": "score_0_100",
    "confidence_overall": "score_0_100",
    "priority_signals": ["array of signal tags"]
  }},
  "executive_summary": {{
    "overall_assessment": {{
      "digital_maturity": {{
        "score": 0-100,
        "trend": "improving|stable|declining",
        "key_strengths": ["specific to entity"],
        "key_gaps": ["specific to entity"]
      }},
      "procurement_readiness": {{
        "budget_availability": "unknown|low|medium|high",
        "decision_horizon": "immediate|0-3months|3-6months|6-12months|12+months",
        "strategic_fit": "score_0_100"
      }},
      "yellow_panther_opportunity": {{
        "service_fit": ["specific Yellow Panther services that match entity needs"],
        "entry_point": "pilot|partnership|vendor replacement|new initiative",
        "competitive_advantage": "why Yellow Panther vs alternatives",
        "estimated_probability": "score_0_100"
      }}
    }},
    "quick_actions": [
      {{
        "action": "specific next step",
        "priority": "HIGH|MEDIUM|LOW",
        "timeline": "specific timeframe",
        "owner": "who should act",
        "success_criteria": "measurable outcome"
      }}
    ],
    "key_insights": [
      {{
        "insight": "specific observation about entity",
        "signal_type": "[PROCUREMENT]|[CAPABILITY]|[TIMING]|[CONTACT]",
        "confidence": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "source": "specific data point or observation",
        "hypothesis_ready": true/false
      }}
    ]
  }},
  "digital_infrastructure": {{
    "current_tech_stack": {{
      "website_platform": "specific if known, otherwise 'unknown'",
      "crm_system": "specific if known, otherwise 'unknown'",
      "analytics_platform": "specific if known, otherwise 'unknown'",
      "mobile_apps": "yes/no/partial",
      "ecommerce": "yes/no/partial",
      "data_infrastructure": "description if available"
    }},
    "vendor_relationships": [
      {{
        "vendor": "specific company name if known",
        "services": "what they provide",
        "contract_duration": "if known",
        "renewal_window": "estimated if available",
        "satisfaction_indicator": "signs of satisfaction or friction"
      }}
    ],
    "digital_maturity_metrics": {{
      "transformation_score": 0-100,
      "innovation_velocity": "low|medium|high",
      "data_sophistication": "basic|intermediate|advanced",
      "customer_obsession": "score_0_100",
      "integration_readiness": "score_0_100"
    }},
    "capability_gaps": [
      {{
        "gap": "specific missing capability",
        "urgency": "immediate|near-term|long-term",
        "yellow_panther_fit": "which Yellow Panther service addresses this",
        "procurement_likelihood": "score_0_100"
      }}
    ]
  }},
  "procurement_signals": {{
    "upcoming_opportunities": [
      {{
        "opportunity": "specific initiative or project",
        "type": "new_project|renewal|expansion|replacement",
        "estimated_budget": "unknown|low|medium|high|specific",
        "timeline": "specific window",
        "decision_makers": ["roles"],
        "rfp_probability": 0-100,
        "yellow_panther_fit": {{
          "services": ["relevant offerings"],
          "competitive_positioning": "why Yellow Panther",
          "win_probability": 0-100
        }},
        "next_actions": ["concrete steps"],
        "hypothesis_id": "auto-generated unique identifier"
      }}
    ],
    "budget_indicators": [
      {{
        "indicator": "specific sign of budget allocation",
        "confidence": 0-100,
        "relevance": "HIGH|MEDIUM|LOW",
        "source": "where observed"
      }}
    ],
    "strategic_initiatives": [
      {{
        "initiative": "named strategic effort",
        "description": "what it entails",
        "phase": "announcement|planning|execution|expansion",
        "technology_needs": ["specific requirements"],
        "partnership_opportunities": ["vendor types needed"]
      }}
    ]
  }},
  "leadership_analysis": {{
    "decision_makers": [
      {{
        "name": "REAL NAME REQUIRED - Use 'unknown' if not available, NEVER use placeholders like {{ROLE}}",
        "title": "specific title with qualifier (e.g., 'Commercial Director' not 'Director')",
        "responsibility_scope": "what they control",
        "influence_level": "HIGH|MEDIUM|LOW",
        "communication_style": "analytical|relationship|story-driven|direct",
        "tech_savviness": "low|medium|high",
        "risk_appetite": "conservative|moderate|aggressive",
        "decision_criteria": ["what matters to them"],
        "contact_method": {{
          "channel": "email|linkedin|intro|cold|conference",
          "messaging": "what resonates",
          "timing": "when to approach",
          "contact_url": "LinkedIn profile or email if available"
        }},
        "yellow_panther_angle": {{
          "value_proposition": "how to frame YP value",
          "service_fit": ["relevant YP services"],
          "positioning": "SOLUTION_PROVIDER|STRATEGIC_PARTNER|CAPABILITY_PARTNER|INNOVATION_PARTNER",
          "case_study": "relevant YP case study reference"
        }}
      }}
    ],
    "influence_network": {{
      "internal_champions": ["roles who would advocate"],
      "blockers": ["roles who might resist"],
      "decision_process": "how decisions get made",
      "approval_chain": ["roles in order"]
    }}
  }},
  "timing_analysis": {{
    "contract_windows": [
      {{
        "contract": "specific if known",
        "vendor": "current provider if known",
        "renewal_date": "estimated if known",
        "rfp_window": "when RFP likely",
        "probability": 0-100,
        "action_deadline": "when to engage"
      }}
    ],
    "strategic_cycles": {{
      "budget_cycle": "when fiscal planning happens",
      "planning_horizon": "how far out they plan",
      "procurement_peaks": ["times of year with more activity"]
    }},
    "urgency_indicators": [
      {{
        "indicator": "specific urgency signal",
        "type": "deadline|pressure|opportunity|threat",
        "window": "timeframe",
        "action_required": "what to do"
      }}
    ]
  }},
  "risk_assessment": {{
    "implementation_risks": [
      {{
        "risk": "specific challenge",
        "probability": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "mitigation": "how to address",
        "yellow_panther_differentiation": "how YP mitigates this"
      }}
    ],
    "competitive_landscape": {{
      "incumbent_vendors": ["who already has relationships"],
      "alternative_providers": ["who else competes"],
      "switching_costs": "barriers to change",
      "yellow_panther_advantages": ["where YP wins"]
    }}
  }},
  "recommended_approach": {{
    "immediate_actions": [
      {{
        "action": "specific step",
        "priority": "HIGH|MEDIUM|LOW",
        "timeline": "when",
        "responsible": "who",
        "success_criteria": "measurable outcome",
        "hypothesis_to_test": "what this validates"
      }}
    ],
    "hypothesis_generation": {{
      "primary_hypothesis": {{
        "statement": "testable assertion about procurement likelihood",
        "confidence": 0-100,
        "validation_strategy": "how to test",
        "success_metrics": ["what to measure"],
        "next_signals": ["what to look for next"]
      }},
      "secondary_hypotheses": [
        {{
          "statement": "alternative hypothesis",
          "confidence": 0-100,
          "relationship_to_primary": "support|contradict|independent"
        }}
      ]
    }},
    "resource_allocation": {{
      "sales_effort": "hours_per_week",
      "technical_preparation": "what needs building",
      "partnership_leverage": "who else can help",
      "budget_required": "estimated investment"
    }}
  }},
  "outreach_strategy": {{
    "connection_intelligence": {{
      "approach_type": "warm|lukewarm|cold",
      "mutual_connections": ["list if available"],
      "conversation_starters": [
        {{
          "topic": "specific discussion topic",
          "relevance": "why this matters to them",
          "talking_points": ["point 1", "point 2", "point 3"],
          "risk_level": "low|medium|high"
        }}
      ],
      "current_providers": [
        {{
          "provider": "company name",
          "service": "what they provide",
          "satisfaction_indicators": "signs of satisfaction or friction",
          "replacement_opportunity": "why Yellow Panther could replace them"
        }}
      ]
    }},
    "conversation_trees": [
      {{
        "scenario": "specific outreach scenario name",
        "opening_message": {{
          "subject_line": "compelling email subject",
          "body": "opening message text (conversational, not salesy)",
          "personalization_tokens": ["{{recent_initiative}}", "{{specific_technology}}"],
          "expected_response_rate": 0-100
        }},
        "response_branches": [
          {{
            "response_type": "interested|neutral|negative|questioning",
            "probability": 0-100,
            "follow_up_strategy": {{
              "message": "follow-up message text",
              "timing": "when to send (e.g., '2 days later', 'same week')",
              "channel": "email|linkedin|phone",
              "goal": "what this follow-up achieves"
            }}
          }}
        ],
        "depth": 3,
        "success_criteria": "what constitutes successful engagement",
        "anti_patterns": ["generic mistake 1 to avoid", "mistake 2"]
      }}
    ],
    "recommended_approach": {{
      "primary_channel": "email|linkedin|warm_intro|phone",
      "messaging_angle": "how to frame Yellow Panther value proposition",
      "timing": "when to reach out (specific timeframe)",
      "confidence": 0-100,
      "confidence_explanation": "why we're confident this approach will work based on collected intelligence",
      "next_actions": ["immediate step 1", "step 2", "step 3"]
    }}
  }},
  "next_steps": {{
    "monitoring_triggers": [
      {{
        "signal": "what event to watch for",
        "source": "where to look",
        "frequency": "how often to check",
        "alert_threshold": "when to take action"
      }}
    ],
    "data_gaps": [
      {{
        "missing_info": "what we don't know",
        "importance": "why it matters",
        "collection_method": "how to get it",
        "priority": "HIGH|MEDIUM|LOW"
      }}
    ],
    "engagement_sequence": [
      {{
        "step": 1,
        "action": "specific outreach or activity",
        "timing": "when",
        "channel": "how",
        "messaging": "key points",
        "success_indicator": "what constitutes progress"
      }}
    ]
  }}
}}

GENERATION RULES:

1. ENTITY-SPECIFIC CONTENT:
   - Every insight must be about THIS entity, not a template
   - Use "unknown" when data is missing (NEVER use placeholders like {{ROLE}})
   - Never copy Arsenal or any other club's data literally
   - Reference actual observations from the entity data provided

2. QUESTION-FIRST HYPOTHESIS GENERATION:
   - Answer entity-type-specific questions (see ENTITY_TYPE_QUESTION_CONTEXT above)
   - Each question generates a TESTABLE HYPOTHESIS with validation strategy
   - Include YP service fit for each opportunity
   - Map next_signals to hop_types (RFP_PAGE, CAREERS_PAGE, PRESS_RELEASE)
   - Specify accept_criteria for strong evidence

3. YELLOW PANTHER INTEGRATION:
   - Tag opportunities with YP service categories (MOBILE_APPS, DIGITAL_TRANSFORMATION, etc)
   - Include budget range estimates (aligned with YP ideal: £80K-£500K)
   - Specify positioning strategy (SOLUTION_PROVIDER for RFP, STRATEGIC_PARTNER for digital initiatives)
   - Reference relevant YP case studies (Team GB, Premier Padel, FIBA 3×3, ISU, LNB)

4. CONTACT DATA VALIDATION:
   - Use REAL names only (reject {FEDERATION PRESIDENT}, {TECHNOLOGY DIRECTOR})
   - Require specific titles (e.g., "Commercial Director" not "Director")
   - Include LinkedIn URLs or emails when available
   - Mark as "unknown" if contact cannot be identified

5. CONFIDENCE SCORING:
   - Base confidence on data availability and recency
   - Explicitly state uncertainty
   - Distinguish between "observed" vs "inferred" insights
   - Flag assumptions requiring validation
   - FOR EVERY SCORE: Include meaning, why, benchmark, action (SCORE_CONTEXT_TEMPLATE)

6. SIGNAL TAGGING:
   - [PROCUREMENT]: Active buying signals, RFP likelihood, budget movement
   - [CAPABILITY]: Tech gaps, digital maturity, infrastructure needs
   - [TIMING]: Contract windows, strategic cycles, urgency indicators
   - [CONTACT]: Decision makers, influence mapping, introduction paths

7. HYPOTHESIS-TO-HOP MAPPING:
   - Each hypothesis should specify which discovery hops validate it
   - Job postings → CAREERS_PAGE hop
   - RFP mentions → RFP_PAGE, TENDERS_PAGE hops
   - Strategic announcements → PRESS_RELEASE hop
   - Technology info → OFFICIAL_SITE hop

Remember: This dossier will feed into an automated hypothesis-driven discovery system that scans 3,000+ entities for RFP opportunities. Every insight should help prioritize which entities deserve human sales attention and automated monitoring.

Generate the dossier now for {name}.
"""


# =============================================================================
# TIERED GENERATION PROMPTS
# =============================================================================

BASIC_DOSSIER_PROMPT = """
Generate BASIC tier dossier for {name} (3 sections, ~5s, ~$0.0004):

{YELLOW_PANTHER_SERVICE_CONTEXT}

{CONTACT_VALIDATION_RULES}

Focus on:
1. Core entity information (name, type, industry, website, size)
2. Quick opportunity assessment (priority score 0-100, key signals)
3. Immediate next steps (1-2 actions, monitoring triggers)

Use UNIVERSAL_CLUB_DOSSIER_PROMPT structure but limit to:
- metadata
- executive_summary.overall_assessment (brief)
- executive_summary.quick_actions (top 3 only)
- next_steps.monitoring_triggers (5 high-priority signals)

Confidence scores required. Skip unavailable data - use "unknown".
Tag opportunities with YP service fit: MOBILE_APPS, DIGITAL_TRANSFORMATION, etc.
"""


STANDARD_DOSSIER_PROMPT = """
Generate STANDARD tier dossier for {name} (7 sections, ~15s, ~$0.0095):

{YELLOW_PANTHER_SERVICE_CONTEXT}

{CONTACT_VALIDATION_RULES}

Include:
1. Core entity information
2. Executive summary with key insights (include YP service fit)
3. Digital infrastructure overview
4. Procurement signals (opportunities + budget indicators, tag with YP services)
5. Leadership analysis (top 3 decision makers, use REAL names only)
6. Risk assessment (major risks only)
7. Recommended approach (primary hypothesis + next steps)

Use UNIVERSAL_CLUB_DOSSIER_PROMPT structure. Skip unavailable data.
"""


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

DossierTier = Literal['BASIC', 'STANDARD', 'PREMIUM']


def generate_dossier_prompt(
    tier: DossierTier,
    entity_name: str,
    entity_type: str,
    industry: str,
    current_data: Dict[str, Any],
    entity_subtype: Optional[str] = None
) -> str:
    """
    Generate dossier prompt with entity-specific interpolation and YP context.

    Args:
        tier: Dossier complexity level (BASIC/STANDARD/PREMIUM)
        entity_name: Name of the entity
        entity_type: Type of entity (ORG, PERSON, PRODUCT, etc.)
        industry: Industry sector
        current_data: Existing data about the entity
        entity_subtype: Optional subtype (SPORT_CLUB, SPORT_FEDERATION, etc.)

    Returns:
        Fully interpolated prompt string ready for LLM
    """
    prompts = {
        'BASIC': BASIC_DOSSIER_PROMPT,
        'STANDARD': STANDARD_DOSSIER_PROMPT,
        'PREMIUM': UNIVERSAL_CLUB_DOSSIER_PROMPT_TEMPLATE
    }

    base_prompt = prompts[tier]
    current_data_json = json.dumps(current_data, indent=2)

    # Determine entity subtype for question context
    if entity_subtype is None:
        # Try to infer from entity_type and metadata
        if 'club' in str(entity_type).lower() or any(club in entity_name.lower() for club in ['fc', 'club']):
            entity_subtype = 'SPORT_CLUB'
        elif 'federation' in str(entity_type).lower() or 'federation' in entity_name.lower():
            entity_subtype = 'SPORT_FEDERATION'
        elif 'league' in str(entity_type).lower() or 'league' in entity_name.lower():
            entity_subtype = 'SPORT_LEAGUE'
        else:
            entity_subtype = 'SPORT_CLUB'  # Default

    # Get YP and question contexts
    yp_context = YELLOW_PANTHER_SERVICE_CONTEXT
    question_context = get_question_context_for_subtype(entity_subtype, entity_name)
    contact_rules = CONTACT_VALIDATION_RULES

    return base_prompt.format(
        name=entity_name,
        type=entity_type,
        industry=industry,
        current_data=current_data_json,
        YELLOW_PANTHER_SERVICE_CONTEXT=yp_context,
        ENTITY_TYPE_QUESTION_CONTEXT=question_context,
        CONTACT_VALIDATION_RULES=contact_rules
    )


def get_question_context_for_subtype(entity_subtype: str, entity_name: str) -> str:
    """
    Get question context for a specific entity subtype

    Args:
        entity_subtype: SPORT_CLUB, SPORT_FEDERATION, or SPORT_LEAGUE
        entity_name: Name of entity for context

    Returns:
        Formatted question context string
    """
    try:
        from entity_type_dossier_questions import (
            get_questions_for_entity_type,
            get_yp_service_summary
        )
    except ImportError:
        # Fallback if module not available
        return f"Generate hypotheses for {entity_name} ({entity_subtype})"

    questions = get_questions_for_entity_type(entity_subtype)

    context = f"""
ENTITY TYPE: {entity_subtype}
ENTITY NAME: {entity_name}

QUESTIONS TO ANSWER (each generates a testable hypothesis with YP service mapping):

"""

    for i, q in enumerate(questions[:5], 1):  # Limit to top 5 for prompt brevity
        context += f"""
{i}. {q.question.format(entity=entity_name)}
   → YP Services: {', '.join([s.value for s in q.yp_service_fit])}
   → Budget: {q.budget_range}
   → Positioning: {q.positioning_strategy.value}
"""

    return context


def extract_hypotheses_from_dossier(dossier_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract hypothesis-ready insights from completed dossier.

    Args:
        dossier_dict: Complete dossier JSON structure

    Returns:
        List of hypothesis dictionaries with statement, confidence, type
    """
    hypotheses = []

    # Extract from executive summary insights marked as hypothesis_ready
    key_insights = dossier_dict.get('executive_summary', {}).get('key_insights', [])
    for insight in key_insights:
        if insight.get('hypothesis_ready', False):
            hypotheses.append({
                'statement': insight['insight'],
                'signal_type': insight['signal_type'],
                'confidence': insight['confidence'],
                'impact': insight['impact'],
                'source': insight['source'],
                'entity_id': dossier_dict['metadata']['entity_id'],
                'section': 'executive_summary'
            })

    # Extract primary and secondary hypotheses
    hypothesis_gen = dossier_dict.get('recommended_approach', {}).get('hypothesis_generation', {})

    if hypothesis_gen.get('primary_hypothesis'):
        primary = hypothesis_gen['primary_hypothesis']
        hypotheses.append({
            **primary,
            'entity_id': dossier_dict['metadata']['entity_id'],
            'type': 'PRIMARY',
            'section': 'hypothesis_generation'
        })

    for secondary in hypothesis_gen.get('secondary_hypotheses', []):
        hypotheses.append({
            **secondary,
            'entity_id': dossier_dict['metadata']['entity_id'],
            'type': 'SECONDARY',
            'section': 'hypothesis_generation'
        })

    # Extract from procurement opportunities with high RFP probability
    opportunities = dossier_dict.get('procurement_signals', {}).get('upcoming_opportunities', [])
    for opp in opportunities:
        if opp.get('rfp_probability', 0) > 50:
            hypotheses.append({
                'statement': f"RFP likely for {opp['opportunity']} ({opp['type']})",
                'signal_type': '[PROCUREMENT]',
                'confidence': opp['rfp_probability'],
                'opportunity_type': opp['type'],
                'timeline': opp.get('timeline'),
                'yellow_panther_fit': opp.get('yellow_panther_fit'),
                'entity_id': dossier_dict['metadata']['entity_id'],
                'type': 'OPPORTUNITY',
                'section': 'procurement_signals'
            })

    return hypotheses


def extract_signals_from_dossier(dossier_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Pull tagged signals for filtering and prioritization.

    Args:
        dossier_dict: Complete dossier JSON structure

    Returns:
        List of signal dictionaries with type, insight, confidence
    """
    signals = []

    # Executive summary signals
    key_insights = dossier_dict.get('executive_summary', {}).get('key_insights', [])
    for insight in key_insights:
        signals.append({
            'type': insight['signal_type'],
            'insight': insight['insight'],
            'confidence': insight['confidence'],
            'impact': insight['impact'],
            'source': insight['source'],
            'entity_id': dossier_dict['metadata']['entity_id'],
            'section': 'executive_summary'
        })

    # Procurement signals
    opportunities = dossier_dict.get('procurement_signals', {}).get('upcoming_opportunities', [])
    for opp in opportunities:
        signals.append({
            'type': '[PROCUREMENT]',
            'insight': f"Opportunity: {opp['opportunity']}",
            'confidence': opp['rfp_probability'],
            'timeline': opp.get('timeline'),
            'entity_id': dossier_dict['metadata']['entity_id'],
            'section': 'procurement_signals'
        })

    # Timing signals
    contract_windows = dossier_dict.get('timing_analysis', {}).get('contract_windows', [])
    for window in contract_windows:
        signals.append({
            'type': '[TIMING]',
            'insight': f"Contract renewal: {window['contract']}",
            'confidence': window['probability'],
            'deadline': window.get('action_deadline'),
            'entity_id': dossier_dict['metadata']['entity_id'],
            'section': 'timing_analysis'
        })

    # Contact signals
    decision_makers = dossier_dict.get('leadership_analysis', {}).get('decision_makers', [])
    for leader in decision_makers:
        signals.append({
            'type': '[CONTACT]',
            'insight': f"Decision maker: {leader['name']} - {leader['title']}",
            'influence': leader['influence_level'],
            'channel': leader.get('contact_preferences', {}).get('channel'),
            'entity_id': dossier_dict['metadata']['entity_id'],
            'section': 'leadership_analysis'
        })

    return signals


def calculate_dossier_tier(priority_score: int) -> DossierTier:
    """
    Determine dossier tier based on entity priority score.

    Args:
        priority_score: Entity priority score (0-100)

    Returns:
        Appropriate dossier tier (BASIC/STANDARD/PREMIUM)
    """
    if priority_score <= 20:
        return 'BASIC'      # 3 sections, ~5s
    elif priority_score <= 50:
        return 'STANDARD'   # 7 sections, ~15s
    else:
        return 'PREMIUM'     # 11 sections, ~30s


def estimate_dossier_cost(tier: DossierTier) -> float:
    """
    Estimate cost for dossier generation.

    Args:
        tier: Dossier complexity level

    Returns:
        Estimated cost in USD
    """
    costs = {
        'BASIC': 0.0004,
        'STANDARD': 0.0095,
        'PREMIUM': 0.057
    }
    return costs[tier]


# =============================================================================
# BATCH CONFIGURATION
# =============================================================================

BATCH_CONFIG = {
    # Cost per tier (in USD)
    'tier_costs': {
        'BASIC': 0.0004,
        'STANDARD': 0.0095,
        'PREMIUM': 0.057
    },

    # Time per tier (in seconds)
    'tier_times': {
        'BASIC': 5,
        'STANDARD': 15,
        'PREMIUM': 30
    },

    # Batch size limits (for parallel processing)
    'max_concurrent': 10,
    'batch_size': 50,

    # Priority distribution (estimate for 3,000 entities)
    'priority_distribution': {
        'BASIC': 0.60,      # 1,800 entities @ $0.72 total
        'STANDARD': 0.30,   # 900 entities @ $8.55 total
        'PREMIUM': 0.10     # 300 entities @ $17.10 total
    },

    # Total estimated cost for 3,000 entities
    'total_cost_estimate': 26.37,  # USD
    'total_time_estimate': 14.5     # hours (assuming 10 concurrent)
}


def estimate_batch_cost(
    num_entities: int,
    priority_distribution: Optional[Dict[DossierTier, float]] = None
) -> Dict[str, Any]:
    """
    Estimate cost and time for batch dossier generation.

    Args:
        num_entities: Number of entities to process
        priority_distribution: Optional custom distribution of tiers

    Returns:
        Dictionary with cost, time, and entity breakdown estimates
    """
    dist = priority_distribution or BATCH_CONFIG['priority_distribution']
    costs = BATCH_CONFIG['tier_costs']
    times = BATCH_CONFIG['tier_times']

    entity_breakdown = {
        tier: int(num_entities * dist[tier])
        for tier in ['BASIC', 'STANDARD', 'PREMIUM']
    }

    total_cost = sum(
        entity_breakdown[tier] * costs[tier]
        for tier in ['BASIC', 'STANDARD', 'PREMIUM']
    )

    total_time_seconds = sum(
        entity_breakdown[tier] * times[tier]
        for tier in ['BASIC', 'STANDARD', 'PREMIUM']
    )

    # Assuming 10 concurrent workers
    total_time_hours = (total_time_seconds / BATCH_CONFIG['max_concurrent']) / 3600

    return {
        'num_entities': num_entities,
        'entity_breakdown': entity_breakdown,
        'total_cost_usd': round(total_cost, 2),
        'total_time_hours': round(total_time_hours, 2),
        'cost_per_entity': round(total_cost / num_entities, 4)
    }


def create_dossier_metadata(
    entity_id: str,
    data_freshness: int,
    confidence_overall: int,
    priority_signals: List[str]
) -> Dict[str, Any]:
    """
    Create standardized metadata section for dossier.

    Args:
        entity_id: Unique entity identifier
        data_freshness: Score 0-100 for data recency
        confidence_overall: Score 0-100 for overall confidence
        priority_signals: List of high-priority signal tags

    Returns:
        Metadata dictionary matching dossier schema
    """
    return {
        'entity_id': entity_id,
        'generated_at': datetime.utcnow().isoformat(),
        'data_freshness': data_freshness,
        'confidence_overall': confidence_overall,
        'priority_signals': priority_signals
    }


def validate_dossier_structure(dossier_dict: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate dossier structure for completeness.

    Args:
        dossier_dict: Dossier to validate

    Returns:
        Tuple of (is_valid, list_of_missing_fields)
    """
    required_sections = [
        'metadata',
        'executive_summary',
        'digital_infrastructure',
        'procurement_signals',
        'leadership_analysis',
        'timing_analysis',
        'risk_assessment',
        'recommended_approach',
        'next_steps'
    ]

    missing_fields = []
    for section in required_sections:
        if section not in dossier_dict:
            missing_fields.append(section)

    return (len(missing_fields) == 0, missing_fields)


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    # Prompts
    'UNIVERSAL_CLUB_DOSSIER_PROMPT',
    'BASIC_DOSSIER_PROMPT',
    'STANDARD_DOSSIER_PROMPT',

    # Functions
    'generate_dossier_prompt',
    'extract_hypotheses_from_dossier',
    'extract_signals_from_dossier',
    'calculate_dossier_tier',
    'estimate_dossier_cost',
    'estimate_batch_cost',
    'create_dossier_metadata',
    'validate_dossier_structure',

    # Config
    'BATCH_CONFIG',

    # Types
    'DossierTier'
]
